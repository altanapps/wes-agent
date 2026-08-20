import { app } from "electron";
import { createConfig, Wes, type CoachConfig } from "@wes/core";
import { getApiKey, getGranolaKey, getStoredModelAndEffort } from "./settings.js";

/**
 * The Wes instance for the desktop host. Data (corpus, profile, later the
 * SQLite db) lives under Electron's userData dir — the packaged-app equivalent
 * of the repo's .coach/. Rebuilt lazily whenever settings change.
 */
let instance: Wes | null = null;

export function buildDesktopConfig(): CoachConfig {
  const { model, effort, character } = getStoredModelAndEffort();
  return createConfig({
    anthropicApiKey: getApiKey(),
    model,
    effort,
    character,
    dataDir: app.getPath("userData"),
    granola: { apiKey: getGranolaKey() },
  });
}

export function getWes(): Wes {
  if (!instance) instance = new Wes(buildDesktopConfig());
  return instance;
}

/** Call after settings change so the next chat uses the new key/model. */
export function resetWes(): void {
  instance = null;
}
