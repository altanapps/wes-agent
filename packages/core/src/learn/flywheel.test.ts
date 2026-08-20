import { describe, expect, it } from "vitest";
import { callTurnsToMessages, windowCorpus } from "./flywheel.js";
import type { Message } from "../sources/types.js";
import type { Turn } from "../coach/types.js";

const turn = (speaker: "me" | "them", words: number): Turn => {
  const text = Array.from({ length: words }, (_, i) => `w${i}`).join(" ");
  return { speaker, startMs: 0, endMs: 1000, text, wordCount: words };
};

describe("callTurnsToMessages", () => {
  it("keeps only my substantial turns, tagged as call channel", () => {
    const msgs = callTurnsToMessages(
      [turn("me", 40), turn("them", 60), turn("me", 5), turn("me", 25)],
      "2026-08-20T10:00:00Z",
      "Call — pricing",
    );
    expect(msgs).toHaveLength(2);
    expect(msgs.every((m) => m.channel === "call")).toBe(true);
    expect(msgs[0].audience).toBe("Call — pricing");
    expect(msgs[0].date).toBe("2026-08-20T10:00:00Z");
  });
});

describe("windowCorpus", () => {
  const msg = (channel: Message["channel"], date: string, text: string): Message => ({
    text,
    channel,
    date,
  });

  it("keeps the most recent N per channel, preserving original order", () => {
    const corpus: Message[] = [
      msg("email", "2026-01-01", "old email"),
      msg("call", "2026-01-02", "old call"),
      msg("email", "2026-02-01", "new email 1"),
      msg("email", "2026-03-01", "new email 2"),
      msg("call", "2026-03-02", "new call"),
    ];
    const windowed = windowCorpus(corpus, 2);
    expect(windowed.map((m) => m.text)).toEqual([
      "old call",
      "new email 1",
      "new email 2",
      "new call",
    ]);
  });

  it("passes everything through when under the cap", () => {
    const corpus = [msg("slack", "2026-01-01", "a"), msg("slack", "2026-01-02", "b")];
    expect(windowCorpus(corpus, 80)).toHaveLength(2);
  });
});
