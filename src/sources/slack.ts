import type { Message, Source } from "./types.js";

/**
 * Slack feeder (priority 1). Pulls YOUR sent messages so the coach can diagnose
 * your Slack-specific patterns. See docs/capture-channels.md for scopes.
 *
 * Mechanism (when wired): a user token (xoxp-) with channels:history /
 * groups:history / im:history → conversations.list + conversations.history,
 * filtered to messages where user === your id. Events API keeps it current.
 *
 * Not implemented yet — needs SLACK_USER_TOKEN. Stubbed so the multi-channel
 * structure is real and the wiring is obvious.
 */
export function slackSource(): Source {
  return {
    name: "slack",
    async fetch(): Promise<Message[]> {
      throw new Error(
        "Slack source not wired yet — set SLACK_USER_TOKEN and implement the conversations.history pull (see docs/capture-channels.md §1).",
      );
    },
  };
}
