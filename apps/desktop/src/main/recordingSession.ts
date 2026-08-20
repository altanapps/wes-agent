import { BrowserWindow } from "electron";
import { join } from "node:path";
import {
  buildCallReview,
  computeMetrics,
  mergeTranscript,
  type CaptureMode,
  type TranscriptSegment,
} from "@wes/core";
import type { CaptureLane, RecordingStatus } from "../shared/ipc.js";
import * as db from "./db.js";
import { whisperManager } from "./whisper/manager.js";
import { isInstalled, modelPath } from "./whisper/models.js";
import { buildDesktopConfig } from "./coach.js";
import { getStoredWhisperModel } from "./settings.js";
import { ingestCall } from "./profileManager.js";

/**
 * One recording session: hidden capture window → PCM windows → whisper →
 * SQLite segments → (on stop) metrics + Wes review. Audio exists only in
 * memory, per ~20s window, and is dropped the moment its transcript commits.
 */

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
/** Flush a lane window at this length even mid-speech. */
const MAX_WINDOW_MS = 30_000;
/** From this length on, flush at the next quiet chunk. */
const MIN_WINDOW_MS = 15_000;
/** A 0.5s chunk below this RMS counts as quiet (Int16 scale). */
const QUIET_RMS = 350;

type Emit = (status: RecordingStatus) => void;
type CallChanged = (id: string) => void;

interface LaneBuffer {
  chunks: Buffer[];
  bytes: number;
  windowStartMs: number | null;
}

class RecordingSession {
  private state: RecordingStatus["state"] = "idle";
  private callId: string | null = null;
  private startedAt: number | null = null;
  private captureMode: CaptureMode | null = null;
  private lastError: string | null = null;
  private captureWindow: BrowserWindow | null = null;
  private lanes: Record<CaptureLane, LaneBuffer> = {
    mic: { chunks: [], bytes: 0, windowStartMs: null },
    system: { chunks: [], bytes: 0, windowStartMs: null },
  };
  private pendingJobs = 0;
  private emit: Emit = () => {};
  private callChanged: CallChanged = () => {};

  wire(emit: Emit, callChanged: CallChanged): void {
    this.emit = emit;
    this.callChanged = callChanged;
  }

  status(): RecordingStatus {
    return {
      state: this.state,
      callId: this.callId,
      startedAt: this.startedAt,
      captureMode: this.captureMode,
      error: this.lastError,
    };
  }

  isActive(): boolean {
    return this.state === "starting" || this.state === "recording";
  }

  async start(): Promise<RecordingStatus> {
    if (this.state !== "idle") return this.status();
    this.lastError = null;

    const whisperModel = getStoredWhisperModel();
    if (!isInstalled(whisperModel)) {
      this.lastError = `Whisper model "${whisperModel}" is not downloaded — Settings → Transcription.`;
      return this.status();
    }

    this.state = "starting";
    this.push();
    try {
      await whisperManager.ensureReady(modelPath(whisperModel));

      this.callId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      this.startedAt = Date.now();
      const title = `Call — ${new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      // Assume both lanes until the capture renderer reports otherwise.
      this.captureMode = "mic+system";
      db.createCall(this.callId, title, this.captureMode);
      this.callChanged(this.callId);

      this.openCaptureWindow();
      this.state = "recording";
    } catch (err) {
      this.lastError = (err as Error).message;
      this.state = "idle";
      this.callId = null;
    }
    this.push();
    return this.status();
  }

  private openCaptureWindow(): void {
    this.captureWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(import.meta.dirname, "../preload/index.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl) {
      void this.captureWindow.loadURL(`${devUrl}/capture.html`);
    } else {
      void this.captureWindow.loadFile(join(import.meta.dirname, "../renderer/capture.html"));
    }
  }

  /** Capture renderer reports which lanes actually opened. */
  reportMode(mode: CaptureMode | "fatal", message?: string): void {
    if (!this.isActive() || !this.callId) return;
    if (mode === "fatal") {
      this.lastError = message ?? "Capture failed.";
      void this.stop();
      return;
    }
    this.captureMode = mode;
    db.setCallCaptureMode(this.callId, mode);
    this.push();
  }

  /** A ~0.5s Int16 PCM chunk from the capture renderer. */
  onChunk(lane: CaptureLane, pcm: ArrayBuffer, startMs: number): void {
    if (this.state !== "recording" || !this.callId) return;
    const buf = this.lanes[lane];
    if (buf.windowStartMs === null) buf.windowStartMs = startMs;
    const chunk = Buffer.from(pcm);
    buf.chunks.push(chunk);
    buf.bytes += chunk.byteLength;

    const windowMs = (buf.bytes / BYTES_PER_SAMPLE / SAMPLE_RATE) * 1000;
    const quiet = rmsInt16(chunk) < QUIET_RMS;
    if (windowMs >= MAX_WINDOW_MS || (windowMs >= MIN_WINDOW_MS && quiet)) {
      this.flushLane(lane);
    }
  }

  private flushLane(lane: CaptureLane): void {
    const buf = this.lanes[lane];
    if (!buf.chunks.length || buf.windowStartMs === null || !this.callId) return;
    const pcm = Buffer.concat(buf.chunks);
    const offsetMs = buf.windowStartMs;
    const callId = this.callId;
    this.lanes[lane] = { chunks: [], bytes: 0, windowStartMs: null };

    // Skip windows that are essentially silence — no reason to run whisper.
    if (rmsInt16(pcm) < QUIET_RMS / 2) return;

    this.pendingJobs += 1;
    whisperManager
      .transcribe(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength), offsetMs)
      .then((segments) => {
        const speaker = lane === "mic" ? "me" : "them";
        const rows: TranscriptSegment[] = segments.map((s) => ({ ...s, speaker }));
        if (rows.length) {
          db.addSegments(callId, rows);
          this.callChanged(callId);
        }
      })
      .catch((err) => {
        // One lost window is survivable; the session continues.
        console.error(`[whisper] window failed (${lane} @${offsetMs}ms):`, (err as Error).message);
      })
      .finally(() => {
        this.pendingJobs -= 1;
      });
  }

  async stop(): Promise<RecordingStatus> {
    if (!this.isActive() || !this.callId) return this.status();
    const callId = this.callId;
    this.state = "finishing";
    this.push();

    this.captureWindow?.destroy();
    this.captureWindow = null;

    this.flushLane("mic");
    this.flushLane("system");
    db.setCallStatus(callId, "transcribing");
    this.callChanged(callId);

    await whisperManager.drain();
    while (this.pendingJobs > 0) await new Promise((r) => setTimeout(r, 100));
    db.endCall(callId);

    const mode = this.captureMode ?? "mic+system";
    this.state = "idle";
    this.callId = null;
    this.startedAt = null;
    this.captureMode = null;
    this.push();

    // Review runs after the session is idle so a new recording can start.
    void this.review(callId, mode);
    return this.status();
  }

  private async review(callId: string, mode: CaptureMode): Promise<void> {
    let metrics: ReturnType<typeof computeMetrics> | null = null;
    try {
      const segments = db.getSegments(callId);
      const call = db.getCall(callId);
      const durationMs = call?.durationMs ?? 0;
      const transcript = mergeTranscript(segments, mode, durationMs);
      metrics = computeMetrics(transcript);
      db.saveReview(callId, metrics, null, null);
      db.setCallStatus(callId, "reviewing");
      this.callChanged(callId);

      // Flywheel: my spoken turns join the corpus whether or not the LLM
      // review below succeeds — the words are valid evidence either way.
      ingestCall(transcript, new Date(call?.startedAt ?? Date.now()).toISOString(), call?.title ?? "Call");

      if (!transcript.turns.some((t) => t.speaker === "me")) {
        db.saveReview(callId, metrics, null, "Nothing from your side was transcribed.");
        db.setCallStatus(callId, "review_failed");
        this.callChanged(callId);
        return;
      }

      const report = await buildCallReview(buildDesktopConfig(), transcript, metrics);
      db.saveReview(callId, metrics, report, null);
      db.setCallStatus(callId, "reviewed");
    } catch (err) {
      // Keep whatever metrics we managed to compute; only the review failed.
      db.saveReview(callId, metrics, null, (err as Error).message);
      db.setCallStatus(callId, "review_failed");
    }
    this.callChanged(callId);
  }

  private push(): void {
    this.emit(this.status());
  }
}

function rmsInt16(buf: Buffer): number {
  const samples = buf.length / 2;
  if (!samples) return 0;
  let sum = 0;
  // Sample every 4th value — plenty for an energy gate, quarter the cost.
  for (let i = 0; i < samples; i += 4) {
    const v = buf.readInt16LE(i * 2);
    sum += v * v;
  }
  return Math.sqrt(sum / Math.ceil(samples / 4));
}

export const recordingSession = new RecordingSession();
