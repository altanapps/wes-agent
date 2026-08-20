import { mkdirSync, writeFileSync } from "node:fs";
import type { CoachConfig } from "../config.js";
import { coachPaths } from "../storage/paths.js";
import { slackSource } from "../sources/slack.js";
import { appendMessages, loadCorpus, readCursor, writeCursor } from "./store.js";
import { buildCoachingProfile } from "./diagnostics.js";
import { windowCorpus } from "./flywheel.js";

/**
 * The incremental Slack LEARN job (CLI: `npm run learn:slack`).
 * Pull your sent Slack messages since the last run, add them to the corpus,
 * regenerate the coaching profile. Run it on a schedule (cron / the desktop
 * app's scheduler) to get the "record everything I send + periodically update
 * me" loop. Throws when Slack isn't configured — the host reports and exits.
 */
export async function runSlackIngest(config: CoachConfig): Promise<void> {
  if (!config.slack.userToken) {
    throw new Error("SLACK_USER_TOKEN not set. See docs/slack-setup.md.");
  }
  const paths = coachPaths(config.dataDir);

  const cursor = readCursor(paths, "slack");
  console.log(cursor ? `Pulling Slack messages since ${cursor}…` : "First run — pulling recent Slack history…");

  const messages = await slackSource({
    token: config.slack.userToken,
    sinceTs: cursor,
  }).fetch();

  const added = appendMessages(paths, messages);
  console.log(`Captured ${messages.length} of your messages, ${added} new.`);

  // Advance the cursor to the newest message ts we saw (Slack ts == epoch seconds).
  const newest = messages
    .map((m) => (m.date ? String(Math.floor(new Date(m.date).getTime() / 1000)) : ""))
    .filter(Boolean)
    .sort()
    .at(-1);
  if (newest) writeCursor(paths, "slack", `${newest}.000000`);

  const corpus = loadCorpus(paths);
  if (corpus.length === 0) {
    console.log("No messages captured yet — nothing to diagnose.");
    return;
  }

  console.log(`Diagnosing across ${corpus.length} stored messages…`);
  const profile = await buildCoachingProfile(config, windowCorpus(corpus));

  mkdirSync(paths.dataDir, { recursive: true });
  writeFileSync(paths.profileFile, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Updated ${paths.profileFile} — the coach now reflects your latest Slack patterns.`);
}
