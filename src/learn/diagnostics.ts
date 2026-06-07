import Anthropic from "@anthropic-ai/sdk";
import { config, requireAnthropicKey } from "../config.js";
import type { Message } from "../sources/types.js";

/**
 * The coaching profile — the real asset of an all-living coach.
 *
 * NOT a voice clone. Takes a corpus of your *actual* sent messages (from Slack,
 * email, calls) and diagnoses your RECURRING WEAKNESSES against Wes's frameworks,
 * so coaching targets the habits you actually have — and so progress can be
 * tracked over time. A single draft can't reveal a pattern; a hundred can.
 */

const COACH_DIAGNOST = `You are an executive-communication coach (Wes Kao's frameworks) analyzing a batch of messages a person actually sent — across Slack, email, and calls.

Your job is NOT to imitate their voice. It is to diagnose their RECURRING weaknesses so coaching can target them, and to track whether they're improving. Be specific, evidence-based, and honest — name the rough edges.

Score against these dimensions/frameworks: sales-then-logistics, buried punchline / information hierarchy, density (concise = dense, not short), signposting, accurate confidence (no false absolutes, no over-hedging), MOO (pre-empting the obvious objection), strategy-not-self-expression (in feedback).

Produce this markdown profile:

## Recurring weaknesses (ranked, most frequent first)
For each: the pattern · which framework it violates · rough frequency (e.g. "~6 of 10 emails") · one verbatim example from the corpus.

## By channel
Where each weakness concentrates (e.g. "buries the ask in email, fine on Slack").

## Trajectory
If the messages span time (use the dates), whether each weakness is improving, flat, or worsening. If there isn't enough time spread, say so plainly — don't invent a trend.

## Drill next
The single highest-leverage habit to fix first, and a one-line drill for it.

Under ~450 words. Evidence over adjectives. This profile is injected into the live coach so it can say "you did X again" and report progress — write it for that use.`;

function render(messages: Message[]): string {
  return messages
    .map((m, i) => {
      const meta = [m.channel, m.date, m.audience ? `to ${m.audience}` : ""]
        .filter(Boolean)
        .join(" · ");
      return `--- message ${i + 1} [${meta}] ---\n${m.text.trim()}`;
    })
    .join("\n\n");
}

export async function buildCoachingProfile(messages: Message[]): Promise<string> {
  requireAnthropicKey();
  if (messages.length === 0) throw new Error("Empty corpus — nothing to diagnose.");

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2200,
    system: COACH_DIAGNOST,
    thinking: { type: "adaptive" },
    output_config: { effort: config.effort },
    messages: [
      {
        role: "user",
        content: `Here are ${messages.length} messages this person sent. Diagnose their recurring weaknesses.\n\n${render(messages)}`,
      },
    ],
  });

  const profile = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const channels = [...new Set(messages.map((m) => m.channel))].join(", ");
  const stamp = `<!-- coaching profile · ${messages.length} messages · channels: ${channels} · generated ${new Date().toISOString().slice(0, 10)} -->`;
  return `${stamp}\n\n# Coaching profile (your recurring patterns)\n\n${profile}`;
}
