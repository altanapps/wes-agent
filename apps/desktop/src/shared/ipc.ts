/**
 * The single source of truth for the main ⇄ renderer IPC surface.
 * Main registers handlers for `Invoke` channels; preload exposes them as
 * `window.wes`; renderer calls them typed. Push events (main → renderer)
 * will join here in M1 (recording:status, transcript:segment, …).
 */

export type Effort = "low" | "medium" | "high" | "max";

/** Settings safe to show the renderer. The API key itself never crosses the bridge. */
export interface PublicSettings {
  model: string;
  effort: Effort;
  character: string;
  hasApiKey: boolean;
  hasGranolaKey: boolean;
}

/** What the renderer may write. Keys are write-only: stored encrypted, never read back. */
export interface SettingsPatch {
  model?: string;
  effort?: Effort;
  apiKey?: string;
  granolaApiKey?: string;
}

/** Which capture lane a PCM chunk belongs to — diarization by source. */
export type CaptureLane = "mic" | "system";

export interface CaptureTestResult {
  files: string[];
  lanes: Partial<Record<CaptureLane, { seconds: number; rms: number }>>;
}

export const IPC = {
  chatSend: "chat:send",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  captureBegin: "capture:begin",
  captureChunk: "capture:chunk",
  captureEnd: "capture:end",
  granolaImport: "granola:import",
} as const;

/** The API preload exposes on window.wes. */
export interface WesApi {
  chat(conversationId: string, text: string): Promise<string>;
  getSettings(): Promise<PublicSettings>;
  setSettings(patch: SettingsPatch): Promise<PublicSettings>;
  /** Spike A / onboarding self-check: record both lanes to WAVs for inspection. */
  captureBegin(): Promise<void>;
  captureChunk(lane: CaptureLane, pcm: ArrayBuffer): void;
  captureEnd(): Promise<CaptureTestResult>;
  /** Pull your spoken turns from Granola meetings into the corpus + refresh the profile. */
  granolaImport(): Promise<{ added: number }>;
}

declare global {
  interface Window {
    wes: WesApi;
  }
}
