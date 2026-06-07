import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCorpusFile } from "../sources/corpusFile.js";
import { buildCoachingProfile } from "./diagnostics.js";

export const PROFILE_DIR = ".coach";
export const PROFILE_PATH = join(PROFILE_DIR, "profile.md");

/**
 * `npm run learn -- <corpus-file>`
 * Diagnose your recurring weaknesses from a corpus of sent messages and write
 * the coaching profile to .coach/profile.md, which the coach auto-loads.
 */
export async function runLearn(file?: string): Promise<void> {
  if (!file) {
    console.error(
      "Usage: npm run learn -- <corpus-file>\n  (JSON array of {text,channel,date,audience} or blank-line-separated text)",
    );
    process.exit(1);
  }

  const messages = loadCorpusFile(file);
  console.log(`Diagnosing ${messages.length} messages…`);

  const profile = await buildCoachingProfile(messages);

  mkdirSync(PROFILE_DIR, { recursive: true });
  writeFileSync(PROFILE_PATH, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Saved to ${PROFILE_PATH} — the coach now targets these patterns.`);
}
