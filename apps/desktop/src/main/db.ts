import { app } from "electron";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { CallMetrics, CaptureMode, CoachingReport, TranscriptSegment } from "@wes/core";
import type { CallDetail, CallStatus, CallSummary } from "../shared/ipc.js";

/**
 * Local store for calls. Segments are committed transactionally as whisper
 * produces them, so a crash mid-call loses at most the window being
 * transcribed — never the whole session. Audio itself is never stored.
 */
let db: Database.Database | null = null;

function conn(): Database.Database {
  if (db) return db;
  db = new Database(join(app.getPath("userData"), "wes.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      capture_mode TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcript_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      speaker TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_segments_call ON transcript_segments(call_id, start_ms);
    CREATE TABLE IF NOT EXISTS call_reviews (
      call_id TEXT PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
      metrics_json TEXT,
      report_json TEXT,
      review_error TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function createCall(id: string, title: string, captureMode: CaptureMode): void {
  conn()
    .prepare("INSERT INTO calls (id, started_at, status, title, capture_mode) VALUES (?, ?, 'recording', ?, ?)")
    .run(id, Date.now(), title, captureMode);
}

export function setCallStatus(id: string, status: CallStatus): void {
  conn().prepare("UPDATE calls SET status = ? WHERE id = ?").run(status, id);
}

export function setCallCaptureMode(id: string, mode: CaptureMode): void {
  conn().prepare("UPDATE calls SET capture_mode = ? WHERE id = ?").run(mode, id);
}

export function endCall(id: string): void {
  conn().prepare("UPDATE calls SET ended_at = ? WHERE id = ?").run(Date.now(), id);
}

export function addSegments(callId: string, segments: TranscriptSegment[]): void {
  const insert = conn().prepare(
    "INSERT INTO transcript_segments (call_id, speaker, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)",
  );
  const tx = conn().transaction((rows: TranscriptSegment[]) => {
    for (const s of rows) insert.run(callId, s.speaker, s.startMs, s.endMs, s.text);
  });
  tx(segments);
}

export function getSegments(callId: string): TranscriptSegment[] {
  return conn()
    .prepare(
      "SELECT speaker, start_ms AS startMs, end_ms AS endMs, text FROM transcript_segments WHERE call_id = ? ORDER BY start_ms",
    )
    .all(callId) as TranscriptSegment[];
}

export function saveReview(
  callId: string,
  metrics: CallMetrics | null,
  report: CoachingReport | null,
  reviewError: string | null,
): void {
  conn()
    .prepare(
      `INSERT INTO call_reviews (call_id, metrics_json, report_json, review_error, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(call_id) DO UPDATE SET metrics_json=excluded.metrics_json,
         report_json=excluded.report_json, review_error=excluded.review_error,
         created_at=excluded.created_at`,
    )
    .run(
      callId,
      metrics ? JSON.stringify(metrics) : null,
      report ? JSON.stringify(report) : null,
      reviewError,
      Date.now(),
    );
}

interface CallRow {
  id: string;
  started_at: number;
  ended_at: number | null;
  status: CallStatus;
  title: string;
  capture_mode: CaptureMode;
  metrics_json: string | null;
  report_json: string | null;
  review_error: string | null;
}

function toSummary(row: CallRow): CallSummary {
  const report = row.report_json ? (JSON.parse(row.report_json) as CoachingReport) : null;
  const metrics = row.metrics_json ? (JSON.parse(row.metrics_json) as CallMetrics) : null;
  const headline =
    report?.summaryLine ??
    (metrics
      ? `${metrics.pace.wpmOverall ?? "–"} wpm · ${metrics.fillers.per100Words} fillers/100w`
      : null);
  return {
    id: row.id,
    startedAt: row.started_at,
    durationMs: row.ended_at ? row.ended_at - row.started_at : null,
    status: row.status,
    title: row.title,
    captureMode: row.capture_mode,
    headline,
  };
}

const SELECT_CALLS = `
  SELECT c.*, r.metrics_json, r.report_json, r.review_error
  FROM calls c LEFT JOIN call_reviews r ON r.call_id = c.id`;

export function listCalls(): CallSummary[] {
  const rows = conn().prepare(`${SELECT_CALLS} ORDER BY c.started_at DESC`).all() as CallRow[];
  return rows.map(toSummary);
}

export function getCall(id: string): CallDetail | null {
  const row = conn().prepare(`${SELECT_CALLS} WHERE c.id = ?`).get(id) as CallRow | undefined;
  if (!row) return null;
  return {
    ...toSummary(row),
    segments: getSegments(id),
    metrics: row.metrics_json ? (JSON.parse(row.metrics_json) as CallMetrics) : null,
    report: row.report_json ? (JSON.parse(row.report_json) as CoachingReport) : null,
    reviewError: row.review_error,
  };
}

export function getTrendSeries(): import("../shared/ipc.js").TrendPoint[] {
  const rows = conn()
    .prepare(
      `${SELECT_CALLS} WHERE r.metrics_json IS NOT NULL ORDER BY c.started_at ASC`,
    )
    .all() as CallRow[];
  return rows.map((row) => {
    const m = row.metrics_json ? (JSON.parse(row.metrics_json) as CallMetrics) : null;
    const r = row.report_json ? (JSON.parse(row.report_json) as CoachingReport) : null;
    return {
      callId: row.id,
      startedAt: row.started_at,
      wpm: m?.pace.wpmOverall ?? null,
      fillersPer100: m?.fillers.per100Words ?? null,
      talkRatio: m?.talk.ratioMe ?? null,
      rubricTotal: r?.scores.total ?? null,
    };
  });
}

export function deleteCall(id: string): void {
  const c = conn();
  c.prepare("DELETE FROM transcript_segments WHERE call_id = ?").run(id);
  c.prepare("DELETE FROM call_reviews WHERE call_id = ?").run(id);
  c.prepare("DELETE FROM calls WHERE id = ?").run(id);
}
