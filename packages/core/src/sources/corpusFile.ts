import { readFileSync } from "node:fs";
import type { Message } from "./types.js";

/**
 * Load a corpus from a local file. Works today — no credentials.
 * Accepts either:
 *   • a JSON array of Message objects ([{text, channel, date, audience}, ...]), or
 *   • plain text with messages separated by blank lines (treated as "manual").
 *
 * This is the bridge: Slack/email/call exporters write this format, and the
 * diagnostic engine reads it. Same pipe, any channel.
 */
export function loadCorpusFile(path: string): Message[] {
  const raw = readFileSync(path, "utf8").trim();

  if (raw.startsWith("[")) {
    const parsed = JSON.parse(raw) as Message[];
    return parsed.filter((m) => m.text && m.text.trim());
  }

  return raw
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text, channel: "manual" as const }));
}
