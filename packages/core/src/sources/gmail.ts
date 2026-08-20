import type { Message, Source } from "./types.js";

/**
 * Email feeder (priority 2). Pulls your SENT mail — your highest-stakes writing.
 * See docs/capture-channels.md §2.
 *
 * Mechanism (when wired): Gmail API, label SENT. Backfill via
 * users.messages.list(labelIds=['SENT']); stay current via users.watch + Pub/Sub.
 * Scope gmail.readonly is enough to diagnose.
 *
 * Not implemented yet — needs Google OAuth. Stubbed to document the structure.
 */
export function gmailSource(): Source {
  return {
    name: "email",
    async fetch(): Promise<Message[]> {
      throw new Error(
        "Gmail source not wired yet — set up Google OAuth and pull the SENT label (see docs/capture-channels.md §2).",
      );
    },
  };
}
