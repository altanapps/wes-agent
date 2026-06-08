import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "../config.js";
import { slackSource } from "../sources/slack.js";
import { appendMessages, loadCorpus, readCursor, writeCursor } from "./store.js";
import { buildCoachingProfile } from "./diagnostics.js";
import { PROFILE_DIR, PROFILE_PATH } from "./run.js";

/**
 * `npm run learn:slack`
 * Pull your sent Slack messages since the last run, add them to the corpus,
 * regenerate the coaching profile. Run it on a schedule (cron / the /loop
 * skill) to get the "record everything I send + periodically update me" loop.
 */
export async function runSlackIngest(): Promise<void> {
  if (!config.slack.userToken) {
    console.error("SLACK_USER_TOKEN not set. See docs/slack-setup.md.");
    process.exit(1);
  }

  const cursor = readCursor("slack");
  console.log(cursor ? `Pulling Slack messages since ${cursor}…` : "First run — pulling recent Slack history…");

  const messages = await slackSource({
    token: config.slack.userToken,
    sinceTs: cursor,
  }).fetch();

  const added = appendMessages(messages);
  console.log(`Captured ${messages.length} of your messages, ${added} new.`);

  // Advance the cursor to the newest message ts we saw (Slack ts == epoch seconds).
  const newest = messages
    .map((m) => (m.date ? String(Math.floor(new Date(m.date).getTime() / 1000)) : ""))
    .filter(Boolean)
    .sort()
    .at(-1);
  if (newest) writeCursor("slack", `${newest}.000000`);

  const corpus = loadCorpus();
  if (corpus.length === 0) {
    console.log("No messages captured yet — nothing to diagnose.");
    return;
  }

  console.log(`Diagnosing across ${corpus.length} stored messages…`);
  const profile = await buildCoachingProfile(corpus);

  mkdirSync(PROFILE_DIR, { recursive: true });
  writeFileSync(PROFILE_PATH, profile + "\n", "utf8");

  console.log(`\n${profile}\n`);
  console.log(`✓ Updated ${PROFILE_PATH} — the coach now reflects your latest Slack patterns.`);
}
