import {
  type CallTranscript,
  type CaptureMode,
  type TranscriptSegment,
  type Turn,
  METRIC_THRESHOLDS,
} from "./types.js";

/**
 * Merge the two capture lanes into one timeline. Diarization is by source
 * (mic = me, system audio = them), so the only work is ordering and coalescing.
 * Cross-lane overlaps are preserved deliberately — overlap IS signal
 * (interruptions, backchannels); metrics.ts reads it.
 */
export function mergeTranscript(
  segments: TranscriptSegment[],
  captureMode: CaptureMode,
  durationMs: number,
): CallTranscript {
  const sorted = [...segments]
    .filter((s) => s.text.trim().length > 0)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  return {
    captureMode,
    durationMs,
    segments: sorted,
    turns: coalesceTurns(sorted),
  };
}

/** Consecutive same-speaker segments with small gaps become one spoken turn. */
export function coalesceTurns(sorted: TranscriptSegment[]): Turn[] {
  const turns: Turn[] = [];
  for (const seg of sorted) {
    const last = turns[turns.length - 1];
    if (
      last &&
      last.speaker === seg.speaker &&
      seg.startMs - last.endMs <= METRIC_THRESHOLDS.turnCoalesceGapMs
    ) {
      last.endMs = Math.max(last.endMs, seg.endMs);
      last.text = `${last.text} ${seg.text.trim()}`.replace(/\s+/g, " ");
      last.wordCount = countWords(last.text);
    } else {
      const text = seg.text.trim().replace(/\s+/g, " ");
      turns.push({
        speaker: seg.speaker,
        startMs: seg.startMs,
        endMs: seg.endMs,
        text,
        wordCount: countWords(text),
      });
    }
  }
  return turns;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
