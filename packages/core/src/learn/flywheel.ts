import type { Message } from "../sources/types.js";
import type { Turn } from "../coach/types.js";

/**
 * The calls → corpus flywheel. After a call is transcribed, YOUR spoken turns
 * become corpus messages (channel "call"), so the coaching profile learns how
 * you speak — and the next review can say "you did it again" with receipts.
 * Backchannels and short interjections carry no diagnostic signal; skip them.
 */
export function callTurnsToMessages(
  turns: Turn[],
  callDate: string,
  callTitle: string,
  minWords = 25,
): Message[] {
  return turns
    .filter((t) => t.speaker === "me" && t.wordCount >= minWords)
    .map((t) => ({
      text: t.text,
      channel: "call" as const,
      date: callDate,
      audience: callTitle,
    }));
}

/**
 * Cost ceiling for profile regeneration: the diagnosis prompt gets the most
 * recent N messages per channel, not the entire corpus. Keeps regeneration
 * flat as the corpus grows; incremental profiles are the eventual replacement.
 */
export function windowCorpus(messages: Message[], maxPerChannel = 80): Message[] {
  const byChannel = new Map<string, Message[]>();
  for (const m of messages) {
    const list = byChannel.get(m.channel) ?? [];
    list.push(m);
    byChannel.set(m.channel, list);
  }

  const kept = new Set<Message>();
  for (const list of byChannel.values()) {
    // Undated messages sort first (treated as oldest), preserving append order.
    const sorted = [...list].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    for (const m of sorted.slice(-maxPerChannel)) kept.add(m);
  }
  // Preserve the corpus's original order for the prompt.
  return messages.filter((m) => kept.has(m));
}
