import { mkdirSync, writeFileSync } from "node:fs";
import type { CoachConfig } from "../config.js";
import { coachPaths } from "../storage/paths.js";
import { loadCorpus } from "./store.js";
import { buildCoachingProfile } from "./diagnostics.js";
import { windowCorpus } from "./flywheel.js";

/**
 * Regenerate the coaching profile from the corpus already on disk
 * (CLI: `npm run learn:refresh`). For when a previous run ingested messages
 * but the diagnosis step failed (billing, network), or after tweaking the
 * diagnostic prompt.
 */
export async function runRefresh(config: CoachConfig): Promise<void> {
  const paths = coachPaths(config.dataDir);
  const corpus = loadCorpus(paths);
  if (corpus.length === 0) {
    throw new Error("Corpus is empty — run learn:slack, learn:granola, or learn:import first.");
  }

  console.log(`Diagnosing across ${corpus.length} stored messages…`);
  const profile = await buildCoachingProfile(config, windowCorpus(corpus));

  mkdirSync(paths.dataDir, { recursive: true });
  writeFileSync(paths.profileFile, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Updated ${paths.profileFile}.`);
}
