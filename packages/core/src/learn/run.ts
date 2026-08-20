import { mkdirSync, writeFileSync } from "node:fs";
import type { CoachConfig } from "../config.js";
import { coachPaths } from "../storage/paths.js";
import { loadCorpusFile } from "../sources/corpusFile.js";
import { buildCoachingProfile } from "./diagnostics.js";

/**
 * The one-shot LEARN job (CLI: `npm run learn -- <corpus-file>`).
 * Diagnose your recurring weaknesses from a corpus of sent messages and write
 * the coaching profile to <dataDir>/profile.md, which the coach auto-loads.
 * Throws on bad input — the host decides how to report and exit.
 */
export async function runLearn(config: CoachConfig, file: string): Promise<void> {
  const paths = coachPaths(config.dataDir);
  const messages = loadCorpusFile(file);
  console.log(`Diagnosing ${messages.length} messages…`);

  const profile = await buildCoachingProfile(config, messages);

  mkdirSync(paths.dataDir, { recursive: true });
  writeFileSync(paths.profileFile, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Saved to ${paths.profileFile} — the coach now targets these patterns.`);
}
