import { app, safeStorage } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Effort, PublicSettings, SettingsPatch, WhisperModelId } from "../shared/ipc.js";

/**
 * App settings at <userData>/settings.json. Non-secrets are plain JSON; the
 * Anthropic key is encrypted with safeStorage (Keychain-backed on macOS) and
 * stored as base64 — it never leaves the main process in plaintext.
 */
interface StoredSettings {
  model: string;
  effort: Effort;
  character: string;
  whisperModel: WhisperModelId;
  meetingNudge: boolean;
  apiKeyEncrypted?: string;
  granolaKeyEncrypted?: string;
}

const DEFAULTS: StoredSettings = {
  model: "claude-opus-4-8",
  effort: "high",
  character: "wes",
  whisperModel: "small.en",
  meetingNudge: true,
};

function settingsFile(): string {
  return join(app.getPath("userData"), "settings.json");
}

let cache: StoredSettings | null = null;

function load(): StoredSettings {
  if (cache) return cache;
  const file = settingsFile();
  if (existsSync(file)) {
    try {
      cache = { ...DEFAULTS, ...(JSON.parse(readFileSync(file, "utf8")) as StoredSettings) };
      return cache;
    } catch {
      // Corrupt settings — fall back to defaults rather than refusing to start.
    }
  }
  cache = { ...DEFAULTS };
  return cache;
}

function persist(s: StoredSettings): void {
  cache = s;
  writeFileSync(settingsFile(), JSON.stringify(s, null, 2) + "\n", "utf8");
}

export function getPublicSettings(): PublicSettings {
  const s = load();
  return {
    model: s.model,
    effort: s.effort,
    character: s.character,
    whisperModel: s.whisperModel,
    meetingNudge: s.meetingNudge,
    hasApiKey: Boolean(s.apiKeyEncrypted) || Boolean(process.env.ANTHROPIC_API_KEY),
    hasGranolaKey: Boolean(s.granolaKeyEncrypted) || Boolean(process.env.GRANOLA_API_KEY),
  };
}

export function applySettingsPatch(patch: SettingsPatch): PublicSettings {
  const s = { ...load() };
  if (patch.model !== undefined) s.model = patch.model;
  if (patch.effort !== undefined) s.effort = patch.effort;
  if (patch.whisperModel !== undefined) s.whisperModel = patch.whisperModel;
  if (patch.meetingNudge !== undefined) s.meetingNudge = patch.meetingNudge;
  if (patch.apiKey !== undefined && patch.apiKey.trim()) {
    s.apiKeyEncrypted = encryptSecret(patch.apiKey.trim());
  }
  if (patch.granolaApiKey !== undefined && patch.granolaApiKey.trim()) {
    s.granolaKeyEncrypted = encryptSecret(patch.granolaApiKey.trim());
  }
  persist(s);
  return getPublicSettings();
}

function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption is not available on this system — cannot store the key safely.");
  }
  return safeStorage.encryptString(value).toString("base64");
}

function decryptSecret(encrypted: string | undefined): string {
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    } catch {
      // Key stored on another machine/keychain — treat as absent.
    }
  }
  return "";
}

/** Decrypted key for main-process use only. Dev fallback: ANTHROPIC_API_KEY env. */
export function getApiKey(): string {
  return decryptSecret(load().apiKeyEncrypted) || (process.env.ANTHROPIC_API_KEY ?? "");
}

/** Decrypted Granola key for main-process use only. Dev fallback: GRANOLA_API_KEY env. */
export function getGranolaKey(): string {
  return decryptSecret(load().granolaKeyEncrypted) || (process.env.GRANOLA_API_KEY ?? "");
}

export function getStoredModelAndEffort(): { model: string; effort: Effort; character: string } {
  const s = load();
  return { model: s.model, effort: s.effort, character: s.character };
}

export function getStoredWhisperModel(): WhisperModelId {
  return load().whisperModel;
}

export function getMeetingNudgeEnabled(): boolean {
  return load().meetingNudge;
}
