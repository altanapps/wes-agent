import { describe, expect, it } from "vitest";
import { coalesceTurns, mergeTranscript } from "./merge.js";
import { computeMetrics, countFillers } from "./metrics.js";
import { renderTranscript } from "./callReview.js";
import type { TranscriptSegment, Turn } from "./types.js";

const seg = (
  speaker: "me" | "them",
  startMs: number,
  endMs: number,
  text: string,
): TranscriptSegment => ({ speaker, startMs, endMs, text });

describe("coalesceTurns", () => {
  it("merges same-speaker segments within the gap and splits on speaker change", () => {
    const turns = coalesceTurns([
      seg("me", 0, 2000, "So the pricing change"),
      seg("me", 2500, 5000, "is what I want to cover."),
      seg("them", 5200, 7000, "Go ahead."),
      seg("me", 7300, 9000, "Great."),
    ]);
    expect(turns.map((t) => t.speaker)).toEqual(["me", "them", "me"]);
    expect(turns[0].text).toBe("So the pricing change is what I want to cover.");
    expect(turns[0].endMs).toBe(5000);
  });

  it("does not merge across a gap larger than the threshold", () => {
    const turns = coalesceTurns([
      seg("me", 0, 1000, "First point."),
      seg("me", 4000, 5000, "Unrelated later point."),
    ]);
    expect(turns).toHaveLength(2);
  });
});

describe("computeMetrics", () => {
  const transcript = mergeTranscript(
    [
      // them holds the floor 0–10s
      seg("them", 0, 10_000, "Let me walk you through the quarter and where we landed."),
      // me interrupts at 3s with a real cut-in (2s long)
      seg("me", 3000, 5000, "Sorry, can I jump in on that number first?"),
      // me backchannels at 7s (short)
      seg("me", 7000, 7500, "Right."),
      // my proper turn afterwards
      seg("me", 11_000, 21_000, "Here is my ask. We move the tier change to March, um, because renewals clear then."),
    ],
    "mic+system",
    30_000,
  );
  const m = computeMetrics(transcript);

  it("separates interruptions from backchannels", () => {
    expect(m.interruptions.byMe).toBe(1);
    expect(m.interruptions.backchannelsByMe).toBe(1);
    expect(m.interruptions.byThem).toBe(0);
  });

  it("computes talk ratio from turn durations", () => {
    expect(m.talk.turnCountThem).toBe(1);
    expect(m.talk.ratioMe).not.toBeNull();
    expect(m.talk.ratioMe!).toBeGreaterThan(0);
    expect(m.talk.ratioMe!).toBeLessThan(1);
  });

  it("counts fillers with word boundaries", () => {
    expect(m.fillers.counts["um"]).toBe(1);
  });

  it("nulls two-party fields in mic-only mode", () => {
    const solo = computeMetrics(
      mergeTranscript([seg("me", 0, 5000, "Just me talking, you know, alone.")], "mic-only", 5000),
    );
    expect(solo.talk.ratioMe).toBeNull();
    expect(solo.talk.themMs).toBeNull();
    expect(solo.interruptions.byMe).toBeNull();
    expect(solo.pauses.avgResponseLatencyMs).toBeNull();
    expect(solo.fillers.counts["you know"]).toBe(1);
  });
});

describe("countFillers", () => {
  const turn = (text: string): Turn => ({
    speaker: "me",
    startMs: 0,
    endMs: 1000,
    text,
    wordCount: text.split(/\s+/).length,
  });

  it("does not match fillers inside words", () => {
    const f = countFillers([turn("The umbrella was likely act one.")]);
    expect(f.total).toBe(0);
  });

  it("counts multiword phrases once, not their parts", () => {
    const f = countFillers([turn("It was, you know, sort of fine.")]);
    expect(f.counts["you know"]).toBe(1);
    expect(f.counts["sort of"]).toBe(1);
    expect(f.total).toBe(2);
  });
});

describe("renderTranscript long-call policy", () => {
  it("keeps my turns verbatim and compresses theirs when over budget", () => {
    const myText = "My exact words stay. ".repeat(30).trim();
    const theirLong = `First sentence here. ${"Padding sentence follows. ".repeat(4000)}`.trim();
    const t = mergeTranscript(
      [seg("them", 0, 60_000, theirLong), seg("me", 61_000, 120_000, myText)],
      "mic+system",
      120_000,
    );
    const rendered = renderTranscript(t);
    expect(rendered).toContain(myText);
    expect(rendered).toContain("First sentence here. […]");
    expect(rendered).not.toContain("Padding sentence follows. Padding");
  });
});
