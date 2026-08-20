import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import type { Message } from "../sources/types.js";
import { type CoachPaths } from "../storage/paths.js";

/**
 * Local, append-only corpus store. Each channel feeder appends here over time,
 * so the coaching profile accumulates and trajectory ("are you improving?")
 * becomes possible. Everything lives under the host's dataDir (gitignored
 * .coach/ on CLI, Electron userData on desktop — your data either way).
 */
function ensureDir(paths: CoachPaths): void {
  if (!existsSync(paths.dataDir)) mkdirSync(paths.dataDir, { recursive: true });
}

/** Append messages, de-duplicated against what's already stored. */
export function appendMessages(paths: CoachPaths, messages: Message[]): number {
  ensureDir(paths);
  const existing = new Set(loadCorpus(paths).map(keyOf));
  const fresh = messages.filter((m) => !existing.has(keyOf(m)));
  if (fresh.length) {
    appendFileSync(paths.corpusFile, fresh.map((m) => JSON.stringify(m)).join("\n") + "\n", "utf8");
  }
  return fresh.length;
}

export function loadCorpus(paths: CoachPaths): Message[] {
  if (!existsSync(paths.corpusFile)) return [];
  return readFileSync(paths.corpusFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Message);
}

const keyOf = (m: Message) => `${m.channel}|${m.date ?? ""}|${m.text.slice(0, 80)}`;

/** Per-source incremental cursor (e.g. the last Slack ts seen). */
export function readCursor(paths: CoachPaths, name: string): string | undefined {
  const path = paths.cursorFile(name);
  return existsSync(path) ? readFileSync(path, "utf8").trim() || undefined : undefined;
}

export function writeCursor(paths: CoachPaths, name: string, value: string): void {
  ensureDir(paths);
  writeFileSync(paths.cursorFile(name), value, "utf8");
}
