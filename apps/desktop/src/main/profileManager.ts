import { app } from "electron";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  appendMessages,
  buildCoachingProfile,
  callTurnsToMessages,
  coachPaths,
  loadCorpus,
  windowCorpus,
  type CallTranscript,
} from "@wes/core";
import { buildDesktopConfig, resetWes } from "./coach.js";

/**
 * The flywheel, desktop side: after each transcribed call, my spoken turns
 * join the corpus; every REGEN_EVERY_CALLS calls (and on demand) the coaching
 * profile regenerates, so the next review and every chat can say "again".
 */
const REGEN_EVERY_CALLS = 3;

interface FlywheelState {
  callsSinceRegen: number;
}

type ProfileEvent = (status: "regenerating" | "updated" | "failed", detail?: string) => void;
let notify: ProfileEvent = () => {};
let regenInFlight = false;

export function onProfileEvent(cb: ProfileEvent): void {
  notify = cb;
}

function stateFile(): string {
  return join(app.getPath("userData"), "flywheel.json");
}

function loadState(): FlywheelState {
  try {
    if (existsSync(stateFile())) {
      return JSON.parse(readFileSync(stateFile(), "utf8")) as FlywheelState;
    }
  } catch {
    // corrupt state — start over
  }
  return { callsSinceRegen: 0 };
}

function saveState(s: FlywheelState): void {
  writeFileSync(stateFile(), JSON.stringify(s), "utf8");
}

/** Called after a call is transcribed (independent of whether the LLM review
 *  succeeded — the turns are valid corpus either way). */
export function ingestCall(transcript: CallTranscript, callDate: string, title: string): number {
  const config = buildDesktopConfig();
  const paths = coachPaths(config.dataDir);
  const messages = callTurnsToMessages(transcript.turns, callDate, title);
  if (!messages.length) return 0;
  const added = appendMessages(paths, messages);

  if (added > 0) {
    const state = loadState();
    state.callsSinceRegen += 1;
    if (state.callsSinceRegen >= REGEN_EVERY_CALLS && config.anthropicApiKey) {
      state.callsSinceRegen = 0;
      saveState(state);
      void regenerateProfile();
    } else {
      saveState(state);
    }
  }
  return added;
}

export async function regenerateProfile(): Promise<void> {
  if (regenInFlight) return;
  regenInFlight = true;
  notify("regenerating");
  try {
    const config = buildDesktopConfig();
    const paths = coachPaths(config.dataDir);
    const corpus = loadCorpus(paths);
    if (!corpus.length) throw new Error("Corpus is empty — record a call or import a source first.");
    const profile = await buildCoachingProfile(config, windowCorpus(corpus));
    mkdirSync(paths.dataDir, { recursive: true });
    writeFileSync(paths.profileFile, profile + "\n", "utf8");
    saveState({ callsSinceRegen: 0 });
    resetWes(); // chat + the next call review pick up the new profile
    notify("updated");
  } catch (err) {
    notify("failed", (err as Error).message);
  } finally {
    regenInFlight = false;
  }
}

export function readProfile(): string | null {
  const paths = coachPaths(buildDesktopConfig().dataDir);
  if (!existsSync(paths.profileFile)) return null;
  return readFileSync(paths.profileFile, "utf8").trim() || null;
}

export function corpusCounts(): Record<string, number> {
  const paths = coachPaths(buildDesktopConfig().dataDir);
  const counts: Record<string, number> = {};
  for (const m of loadCorpus(paths)) counts[m.channel] = (counts[m.channel] ?? 0) + 1;
  return counts;
}
