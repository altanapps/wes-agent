import { useCallback, useEffect, useState } from "react";
import type { CallDetail, CallSummary, RecordingStatus } from "../../shared/ipc.js";

const IDLE: RecordingStatus = {
  state: "idle",
  callId: null,
  startedAt: null,
  captureMode: null,
  error: null,
};

export function CallsPane() {
  const [recording, setRecording] = useState<RecordingStatus>(IDLE);
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const refreshList = useCallback(() => {
    void window.wes.callsList().then(setCalls);
  }, []);

  useEffect(() => {
    refreshList();
    const offStatus = window.wes.onRecordingStatus(setRecording);
    const offCall = window.wes.onCallUpdated((id) => {
      refreshList();
      setDetail((d) => {
        if (d?.id === id || selectedId === id) {
          void window.wes.callGet(id).then((next) => next && setDetail(next));
        }
        return d;
      });
    });
    return () => {
      offStatus();
      offCall();
    };
  }, [refreshList, selectedId]);

  useEffect(() => {
    if (recording.state !== "recording" || !recording.startedAt) return;
    const t = setInterval(() => setElapsed(Date.now() - recording.startedAt!), 1000);
    return () => clearInterval(t);
  }, [recording.state, recording.startedAt]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void window.wes.callGet(selectedId).then(setDetail);
  }, [selectedId]);

  const busy = recording.state === "starting" || recording.state === "finishing";

  return (
    <div className="panel calls">
      <div className="calls-list">
        <div className="calls-head">
          {recording.state === "recording" ? (
            <button className="btn danger-ghost" onClick={() => void window.wes.recordingStop()}>
              <span className="rec-dot" />
              Stop · {clock(elapsed)}
            </button>
          ) : (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void window.wes.recordingStart()}
            >
              {busy ? "…" : "● Record call"}
            </button>
          )}
        </div>
        {recording.error && <p className="status pad">⚠️ {recording.error}</p>}
        {recording.captureMode === "mic-only" && recording.state === "recording" && (
          <p className="status pad">Mic-only — no system audio (your side is still coached).</p>
        )}
        <div className="calls-scroll">
          {calls.length === 0 && (
            <p className="status pad">
              No calls yet. Hit record during your next meeting — no bot joins, audio never
              leaves this Mac.
            </p>
          )}
          {calls.map((c) => (
            <button
              key={c.id}
              className={`call-item ${selectedId === c.id ? "active" : ""}`}
              onClick={() => setSelectedId(c.id)}
            >
              <span className="row1">
                <span className="title">{c.title}</span>
                <span className="dur">{c.durationMs ? clock(c.durationMs) : ""}</span>
              </span>
              <span className="row2">
                {c.status === "reviewed" && c.headline ? (
                  <span className="headline">{c.headline}</span>
                ) : (
                  <span className={`chip status-${c.status}`}>{statusLabel(c.status)}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="call-detail">
        {!detail ? (
          <div className="empty-state">
            <div className="glyph">◉</div>
            <h2>Select a call</h2>
            <p>Transcript, speech metrics, and Wes's review live here after each recording.</p>
          </div>
        ) : (
          <CallDetailView detail={detail} onDelete={() => {
            void window.wes.callDelete(detail.id).then(() => {
              setSelectedId(null);
              refreshList();
            });
          }} />
        )}
      </div>
    </div>
  );
}

function CallDetailView({ detail, onDelete }: { detail: CallDetail; onDelete: () => void }) {
  const [tab, setTab] = useState<"feedback" | "transcript">("feedback");
  const m = detail.metrics;
  const r = detail.report;

  return (
    <div className="detail-inner">
      <div className="detail-head">
        <div>
          <h2>{detail.title}</h2>
          <p className="status">
            {new Date(detail.startedAt).toLocaleString()} ·{" "}
            {detail.durationMs ? clock(detail.durationMs) : "—"} · {detail.captureMode}
          </p>
        </div>
        <div className="detail-tabs">
          <button className={tab === "feedback" ? "active" : ""} onClick={() => setTab("feedback")}>
            Feedback
          </button>
          <button
            className={tab === "transcript" ? "active" : ""}
            onClick={() => setTab("transcript")}
          >
            Transcript
          </button>
          <button className="delete" onClick={onDelete} title="Delete this call and its transcript">
            Delete
          </button>
        </div>
      </div>

      {tab === "feedback" ? (
        <div className="feedback">
          {m && (
            <div className="chips">
              <Chip label="pace" value={m.pace.wpmOverall ? `${m.pace.wpmOverall} wpm` : "—"} />
              <Chip label="fillers" value={`${m.fillers.per100Words}/100w`} />
              <Chip
                label="talk time"
                value={m.talk.ratioMe != null ? `${Math.round(m.talk.ratioMe * 100)}%` : "—"}
              />
              <Chip
                label="longest monologue"
                value={m.talk.longestMonologueMe ? clock(m.talk.longestMonologueMe.durationMs) : "—"}
              />
              {m.interruptions.byMe != null && (
                <Chip label="interruptions" value={String(m.interruptions.byMe)} />
              )}
            </div>
          )}
          {detail.status === "reviewed" && r ? (
            <>
              <p className="summary-line">“{r.summaryLine}”</p>
              <div className="score">Rubric: {r.scores.total}/30</div>
              {r.moments.map((mo, i) => (
                <div className="moment card" key={i}>
                  <span className="ts">{clock(mo.atMs)} — {mo.framework}</span>
                  <blockquote>“{mo.quote}”</blockquote>
                  <p className="problem">{mo.problem}</p>
                  <p className="instead">
                    <strong>Say instead:</strong> “{mo.instead}”
                  </p>
                </div>
              ))}
              {r.recurring && <p className="recurring">↻ {r.recurring}</p>}
              <div className="drill card">
                <span className="ts">Drill for your next call</span>
                <p>{r.drill}</p>
              </div>
            </>
          ) : detail.status === "review_failed" ? (
            <p className="status">
              ⚠️ Review didn't complete: {detail.reviewError ?? "unknown error"}. Metrics above
              still stand.
            </p>
          ) : (
            <p className="status">
              {statusLabel(detail.status)}… feedback appears here when Wes is done.
            </p>
          )}
        </div>
      ) : (
        <div className="transcript">
          {detail.segments.length === 0 && <p className="status">No speech transcribed yet.</p>}
          {toTurns(detail).map((t, i) => (
            <div key={i} className={`turn ${t.speaker}`}>
              <span className="who">
                [{clock(t.startMs)}] {t.speaker === "me" ? "Me" : "Them"}
              </span>
              <p>{t.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="chip">
      {label} <b>{value}</b>
    </span>
  );
}

/** Light client-side coalescing for display (metrics use the core version). */
function toTurns(detail: CallDetail) {
  const turns: { speaker: string; startMs: number; endMs: number; text: string }[] = [];
  for (const s of detail.segments) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === s.speaker && s.startMs - last.endMs <= 1500) {
      last.endMs = Math.max(last.endMs, s.endMs);
      last.text += ` ${s.text}`;
    } else {
      turns.push({ ...s });
    }
  }
  return turns;
}

function statusLabel(status: CallSummary["status"]): string {
  return {
    recording: "Recording",
    transcribing: "Transcribing",
    reviewing: "Wes is reviewing",
    reviewed: "Reviewed",
    review_failed: "Review failed",
  }[status];
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
