import { mkdirSync, writeFileSync } from "node:fs";
import type { CoachConfig } from "../config.js";
import { coachPaths } from "../storage/paths.js";
import { granolaSource } from "../sources/granola.js";
import { appendMessages, loadCorpus, readCursor, writeCursor } from "./store.js";
import { buildCoachingProfile } from "./diagnostics.js";

/**
 * The Granola LEARN job (CLI: `npm run learn:granola`).
 * Pull your spoken turns from Granola meeting transcripts since the last run,
 * add them to the corpus, regenerate the coaching profile. The zero-capture
 * path to verbal coaching: if Granola already records your calls, this makes
 * Wes coach how you *speak* without our native capture pipeline.
 */
export async function runGranolaIngest(config: CoachConfig): Promise<{ added: number }> {
  if (!config.granola.apiKey) {
    throw new Error("GRANOLA_API_KEY not set. Granola → Settings → Connectors → API keys (Business plan).");
  }
  const paths = coachPaths(config.dataDir);

  const cursor = readCursor(paths, "granola");
  console.log(
    cursor ? `Pulling Granola meetings since ${cursor}…` : "First run — pulling your Granola meeting history…",
  );

  const source = granolaSource({ apiKey: config.granola.apiKey, createdAfter: cursor });
  const messages = await source.fetch();

  const added = appendMessages(paths, messages);
  console.log(`Captured ${messages.length} spoken turns from your meetings, ${added} new.`);

  const newest = source.newestCreatedAt();
  if (newest) writeCursor(paths, "granola", newest);

  if (added === 0) {
    console.log("Nothing new — profile unchanged.");
    return { added };
  }

  const corpus = loadCorpus(paths);
  console.log(`Diagnosing across ${corpus.length} stored messages…`);
  const profile = await buildCoachingProfile(config, corpus);

  mkdirSync(paths.dataDir, { recursive: true });
  writeFileSync(paths.profileFile, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Updated ${paths.profileFile} — Wes now coaches how you speak, not just how you write.`);
  return { added };
}
