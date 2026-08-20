import { mkdirSync, writeFileSync } from "node:fs";
import type { CoachConfig } from "../config.js";
import { coachPaths } from "../storage/paths.js";
import { loadCorpusFile } from "../sources/corpusFile.js";
import { appendMessages, loadCorpus } from "./store.js";
import { buildCoachingProfile } from "./diagnostics.js";
import { windowCorpus } from "./flywheel.js";

/**
 * Generic import LEARN job (CLI: `npm run learn:import -- <file>`).
 * Unlike `learn` (which diagnoses ONLY the given file), this appends the
 * file's messages to the persistent corpus (deduped) and regenerates the
 * profile from everything stored — so one-off exports (email dumps, old call
 * transcripts) accumulate instead of replacing each other.
 */
export async function runImportIngest(config: CoachConfig, file: string): Promise<{ added: number }> {
  const paths = coachPaths(config.dataDir);

  const messages = loadCorpusFile(file);
  const added = appendMessages(paths, messages);
  console.log(`Imported ${messages.length} messages from ${file}, ${added} new.`);

  if (added === 0) {
    console.log("Nothing new — profile unchanged.");
    return { added };
  }

  const corpus = loadCorpus(paths);
  console.log(`Diagnosing across ${corpus.length} stored messages…`);
  const profile = await buildCoachingProfile(config, windowCorpus(corpus));

  mkdirSync(paths.dataDir, { recursive: true });
  writeFileSync(paths.profileFile, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Updated ${paths.profileFile}.`);
  return { added };
}
