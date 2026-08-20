import type { CallMetrics, CaptureMode, CoachingReport, TranscriptSegment } from "@wes/core";

/**
 * The single source of truth for the main ⇄ renderer IPC surface.
 * Main registers handlers for `Invoke` channels; preload exposes them as
 * `window.wes`; renderer calls them typed.
 */

export type Effort = "low" | "medium" | "high" | "max";

/** Settings safe to show the renderer. Keys themselves never cross the bridge. */
export interface PublicSettings {
  model: string;
  effort: Effort;
  character: string;
  hasApiKey: boolean;
  hasGranolaKey: boolean;
  whisperModel: WhisperModelId;
  meetingNudge: boolean;
}

/** What the renderer may write. Keys are write-only: stored encrypted, never read back. */
export interface SettingsPatch {
  model?: string;
  effort?: Effort;
  apiKey?: string;
  granolaApiKey?: string;
  whisperModel?: WhisperModelId;
  meetingNudge?: boolean;
}

/** Which capture lane a PCM chunk belongs to — diarization by source. */
export type CaptureLane = "mic" | "system";

export interface CaptureTestResult {
  files: string[];
  lanes: Partial<Record<CaptureLane, { seconds: number; rms: number }>>;
}

/* ---- Calls / recording ---- */

export type CallStatus =
  | "recording"
  | "transcribing"
  | "reviewing"
  | "reviewed"
  | "review_failed";

export interface CallSummary {
  id: string;
  startedAt: number;
  durationMs: number | null;
  status: CallStatus;
  title: string;
  captureMode: CaptureMode;
  /** One-line hook for the list: Wes's summaryLine, or a metric while pending. */
  headline: string | null;
}

export interface CallDetail extends CallSummary {
  segments: TranscriptSegment[];
  metrics: CallMetrics | null;
  report: CoachingReport | null;
  reviewError: string | null;
}

export interface RecordingStatus {
  state: "idle" | "starting" | "recording" | "finishing";
  callId: string | null;
  startedAt: number | null;
  captureMode: CaptureMode | null;
  error: string | null;
}

/* ---- Whisper models ---- */

export type WhisperModelId = "tiny.en" | "base.en" | "small.en";

/* ---- Trends / flywheel ---- */

export interface TrendPoint {
  callId: string;
  startedAt: number;
  wpm: number | null;
  fillersPer100: number | null;
  talkRatio: number | null;
  rubricTotal: number | null;
}

export interface TrendsData {
  series: TrendPoint[];
  profile: string | null;
  corpusCounts: Record<string, number>;
}

export interface ProfileStatus {
  status: "regenerating" | "updated" | "failed";
  detail?: string;
}

export interface WhisperModelState {
  id: WhisperModelId;
  label: string;
  sizeMb: number;
  installed: boolean;
  downloadingPct: number | null;
}

export const IPC = {
  chatSend: "chat:send",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  captureBegin: "capture:begin",
  captureChunk: "capture:chunk",
  captureEnd: "capture:end",
  /** Capture renderer → main: which lanes actually opened / fatal failure. */
  captureMode: "capture:mode",
  granolaImport: "granola:import",
  recordingStart: "recording:start",
  recordingStop: "recording:stop",
  recordingStatus: "recording:status",
  callsList: "calls:list",
  callGet: "calls:get",
  callDelete: "calls:delete",
  modelsState: "models:state",
  modelsDownload: "models:download",
  trendsGet: "trends:get",
  profileRefresh: "profile:refresh",
  nudgeTest: "nudge:test",
  nudgeDismiss: "nudge:dismiss",
  // main → renderer push events
  evRecordingStatus: "ev:recording-status",
  evCallUpdated: "ev:call-updated",
  evModelProgress: "ev:model-progress",
  evProfileStatus: "ev:profile-status",
} as const;

/** The API preload exposes on window.wes. */
export interface WesApi {
  chat(conversationId: string, text: string): Promise<string>;
  getSettings(): Promise<PublicSettings>;
  setSettings(patch: SettingsPatch): Promise<PublicSettings>;
  /** Capture self-check (onboarding) — records both lanes to WAVs. */
  captureBegin(): Promise<void>;
  captureChunk(lane: CaptureLane, pcm: ArrayBuffer, startMs: number): void;
  captureEnd(): Promise<CaptureTestResult>;
  /** Capture renderer only: report which mode the lanes opened in, or a fatal error. */
  reportCaptureMode(mode: CaptureMode | "fatal", message?: string): void;
  granolaImport(): Promise<{ added: number }>;

  recordingStart(title?: string): Promise<RecordingStatus>;
  recordingStop(): Promise<RecordingStatus>;
  /** Pull the current status — a window opened mid-recording must not assume idle. */
  recordingStatus(): Promise<RecordingStatus>;
  /** Nudge pill only: hide the pill (never stops a recording). */
  nudgeDismiss(): Promise<void>;
  callsList(): Promise<CallSummary[]>;
  callGet(id: string): Promise<CallDetail | null>;
  callDelete(id: string): Promise<void>;

  modelsState(): Promise<WhisperModelState[]>;
  modelsDownload(id: WhisperModelId): Promise<void>;

  trendsGet(): Promise<TrendsData>;
  profileRefresh(): Promise<void>;
  /** Fire the exact meeting-nudge notification path, for verifying visibility. */
  nudgeTest(): Promise<void>;

  onRecordingStatus(cb: (s: RecordingStatus) => void): () => void;
  onCallUpdated(cb: (id: string) => void): () => void;
  onModelProgress(cb: (p: { id: WhisperModelId; pct: number }) => void): () => void;
  onProfileStatus(cb: (s: ProfileStatus) => void): () => void;
}

declare global {
  interface Window {
    wes: WesApi;
  }
}
