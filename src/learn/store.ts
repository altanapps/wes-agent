import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Message } from "../sources/types.js";

/**
 * Local, append-only corpus store. Each channel feeder appends here over time,
 * so the coaching profile accumulates and trajectory ("are you improving?")
 * becomes possible. Everything lives under .coach/ (gitignored, your data).
 */
const DIR = ".coach";
const CORPUS = join(DIR, "corpus.jsonl");

function ensureDir(): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

/** Append messages, de-duplicated against what's already stored. */
export function appendMessages(messages: Message[]): number {
  ensureDir();
  const existing = new Set(loadCorpus().map(keyOf));
  const fresh = messages.filter((m) => !existing.has(keyOf(m)));
  if (fresh.length) {
    appendFileSync(CORPUS, fresh.map((m) => JSON.stringify(m)).join("\n") + "\n", "utf8");
  }
  return fresh.length;
}

export function loadCorpus(): Message[] {
  if (!existsSync(CORPUS)) return [];
  return readFileSync(CORPUS, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Message);
}

const keyOf = (m: Message) => `${m.channel}|${m.date ?? ""}|${m.text.slice(0, 80)}`;

/** Per-source incremental cursor (e.g. the last Slack ts seen). */
export function readCursor(name: string): string | undefined {
  const path = join(DIR, `${name}.cursor`);
  return existsSync(path) ? readFileSync(path, "utf8").trim() || undefined : undefined;
}

export function writeCursor(name: string, value: string): void {
  ensureDir();
  writeFileSync(join(DIR, `${name}.cursor`), value, "utf8");
}
