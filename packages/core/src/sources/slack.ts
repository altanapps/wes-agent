import { WebClient } from "@slack/web-api";
import type { Message, Source } from "./types.js";

/**
 * Slack feeder (priority 1). Pulls YOUR sent messages across the channels and
 * DMs you're in, so the coach can diagnose your real Slack communication.
 *
 * Uses a user token (xoxp-): it sees what you see. We enumerate your
 * conversations (`users.conversations`), pull history since the last run, and
 * keep only messages you authored. See docs/slack-setup.md for the app + scopes.
 *
 * Note: this captures messages *after* you send them (the LEARN job). Warning
 * you *before* send is not possible via the Slack API (no compose hook) — that
 * needs the macOS Accessibility API, tracked separately.
 */

export interface SlackOptions {
  token: string;
  /** Only pull messages newer than this Slack ts (e.g. "1700000000.000000"). */
  sinceTs?: string;
  /** Max messages per conversation per run (rate-limit guard). */
  maxPerConversation?: number;
}

function tsToISODate(ts: string): string {
  const seconds = Number(ts.split(".")[0]);
  return new Date(seconds * 1000).toISOString();
}

export function slackSource(opts: SlackOptions): Source {
  return {
    name: "slack",
    async fetch(): Promise<Message[]> {
      if (!opts.token) {
        throw new Error("SLACK_USER_TOKEN not set — see docs/slack-setup.md.");
      }
      const web = new WebClient(opts.token);

      const auth = await web.auth.test();
      const myId = auth.user_id as string;

      const out: Message[] = [];

      // Conversations the authenticated user is a member of.
      for await (const page of web.paginate("users.conversations", {
        types: "public_channel,private_channel,im,mpim",
        exclude_archived: true,
        limit: 200,
      })) {
        const channels = (page as { channels?: SlackChannel[] }).channels ?? [];
        for (const ch of channels) {
          if (!ch.id) continue;
          try {
            const hist = await web.conversations.history({
              channel: ch.id,
              oldest: opts.sinceTs,
              limit: opts.maxPerConversation ?? 200,
            });
            for (const m of hist.messages ?? []) {
              // Only your own real messages — skip joins, bot posts, edits, etc.
              if (m.user === myId && m.text && !m.subtype && m.ts) {
                out.push({
                  text: m.text,
                  channel: "slack",
                  date: tsToISODate(m.ts),
                  audience: ch.is_im ? "dm" : `#${ch.name ?? ch.id}`,
                });
              }
            }
          } catch {
            // No access / archived / rate-limited on this channel — skip it.
          }
        }
      }

      return out;
    },
  };
}

interface SlackChannel {
  id?: string;
  name?: string;
  is_im?: boolean;
}
