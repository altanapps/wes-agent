import {
  type CallMetrics,
  type CallTranscript,
  type Turn,
  FILLER_PHRASES,
  METRIC_THRESHOLDS,
} from "./types.js";
import { countWords } from "./merge.js";

/**
 * Deterministic speech metrics — pure functions over the transcript, no LLM.
 * Everything is re-computable forever from stored segments (audio is gone).
 * Mic-only capture nulls the two-party fields rather than fabricating them.
 */
export function computeMetrics(t: CallTranscript): CallMetrics {
  const micOnly = t.captureMode === "mic-only";
  const me = t.turns.filter((x) => x.speaker === "me");
  const them = t.turns.filter((x) => x.speaker === "them");

  const meMs = sumDuration(me);
  const themMs = sumDuration(them);
  const wordCountMe = me.reduce((n, x) => n + x.wordCount, 0);

  return {
    schemaVersion: 1,
    captureMode: t.captureMode,
    durationMs: t.durationMs,
    talk: {
      meMs,
      themMs: micOnly ? null : themMs,
      ratioMe: micOnly || meMs + themMs === 0 ? null : round(meMs / (meMs + themMs), 3),
      turnCountMe: me.length,
      turnCountThem: micOnly ? null : them.length,
      longestMonologueMe: longestMonologue(me),
      medianTurnDurationMeMs: median(me.map((x) => x.endMs - x.startMs)),
    },
    pace: {
      wpmOverall: meMs > 0 ? Math.round(wordCountMe / (meMs / 60_000)) : null,
      wpmPerQuartile: wpmPerQuartile(me, t.durationMs),
      wordCountMe,
    },
    fillers: countFillers(me),
    interruptions: micOnly
      ? { byMe: null, byThem: null, backchannelsByMe: null }
      : countInterruptions(t),
    pauses: {
      avgResponseLatencyMs: micOnly ? null : responseLatency(t.turns),
      intraTurnPausesOver2sMe: intraTurnPauses(t, "me"),
      longestSilenceMs: micOnly ? null : longestSilence(t),
    },
    rambling: {
      turnsOver60sMe: me.filter((x) => x.endMs - x.startMs > METRIC_THRESHOLDS.monologueMs).length,
      avgWordsPerTurnMe: me.length ? Math.round(wordCountMe / me.length) : null,
    },
  };
}

function sumDuration(turns: Turn[]): number {
  return turns.reduce((n, t) => n + (t.endMs - t.startMs), 0);
}

function longestMonologue(me: Turn[]) {
  let best: Turn | null = null;
  for (const t of me) {
    if (!best || t.endMs - t.startMs > best.endMs - best.startMs) best = t;
  }
  return best
    ? { startMs: best.startMs, durationMs: best.endMs - best.startMs, words: best.wordCount }
    : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function wpmPerQuartile(me: Turn[], durationMs: number): (number | null)[] {
  if (durationMs <= 0) return [null, null, null, null];
  const q = durationMs / 4;
  return [0, 1, 2, 3].map((i) => {
    const from = i * q;
    const to = (i + 1) * q;
    let words = 0;
    let ms = 0;
    for (const t of me) {
      const overlap = Math.min(t.endMs, to) - Math.max(t.startMs, from);
      if (overlap <= 0) continue;
      const frac = overlap / (t.endMs - t.startMs || 1);
      words += t.wordCount * frac;
      ms += overlap;
    }
    return ms > 0 ? Math.round(words / (ms / 60_000)) : null;
  });
}

/** Case-insensitive lexicon match over my words. Multiword phrases first so
 *  "you know" doesn't double-count as stray "you"s. Lower bound by nature. */
export function countFillers(me: Turn[]): CallMetrics["fillers"] {
  const counts: Record<string, number> = {};
  let total = 0;
  let words = 0;
  for (const turn of me) {
    let text = ` ${turn.text.toLowerCase()} `;
    words += turn.wordCount;
    for (const phrase of FILLER_PHRASES) {
      const re = new RegExp(`(?<=[\\s.,!?;:—-])${phrase.replace(" ", "\\s+")}(?=[\\s.,!?;:—-])`, "g");
      const found = text.match(re)?.length ?? 0;
      if (found) {
        counts[phrase] = (counts[phrase] ?? 0) + found;
        total += found;
        // Blank out matches so "sort of" doesn't later feed a stray "of"/"sort".
        text = text.replace(re, " ".repeat(phrase.length));
      }
    }
  }
  return {
    per100Words: words ? round((total / words) * 100, 1) : 0,
    total,
    counts,
    note: "lower bound; STT under-reports fillers",
  };
}

function countInterruptions(t: CallTranscript): CallMetrics["interruptions"] {
  const th = METRIC_THRESHOLDS;
  let byMe = 0;
  let byThem = 0;
  let backchannelsByMe = 0;

  const count = (interrupter: "me" | "them") => {
    const other = interrupter === "me" ? "them" : "me";
    let n = 0;
    let backchannels = 0;
    for (const seg of t.segments.filter((s) => s.speaker === interrupter)) {
      const host = t.turns.find(
        (turn) =>
          turn.speaker === other &&
          seg.startMs > turn.startMs + th.interruptionGraceMs &&
          seg.startMs < turn.endMs - th.interruptionRemainingMs,
      );
      if (!host) continue;
      if (seg.endMs - seg.startMs < th.backchannelMaxMs) backchannels++;
      else n++;
    }
    return { n, backchannels };
  };

  const mine = count("me");
  byMe = mine.n;
  backchannelsByMe = mine.backchannels;
  byThem = count("them").n;
  return { byMe, byThem, backchannelsByMe };
}

function responseLatency(turns: Turn[]): number | null {
  const gaps: number[] = [];
  for (let i = 1; i < turns.length; i++) {
    if (turns[i - 1].speaker === "them" && turns[i].speaker === "me") {
      const gap = turns[i].startMs - turns[i - 1].endMs;
      if (gap >= 0) gaps.push(gap);
    }
  }
  return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
}

/** Gaps ≥ threshold between segments INSIDE one of my turns — dead air while holding the floor. */
function intraTurnPauses(t: CallTranscript, speaker: "me" | "them"): number {
  let n = 0;
  const segs = t.segments.filter((s) => s.speaker === speaker);
  for (const turn of t.turns.filter((x) => x.speaker === speaker)) {
    const inTurn = segs.filter((s) => s.startMs >= turn.startMs && s.endMs <= turn.endMs);
    for (let i = 1; i < inTurn.length; i++) {
      if (inTurn[i].startMs - inTurn[i - 1].endMs >= METRIC_THRESHOLDS.intraTurnPauseMs) n++;
    }
  }
  return n;
}

function longestSilence(t: CallTranscript): number | null {
  if (t.segments.length < 2) return null;
  let longest = 0;
  for (let i = 1; i < t.segments.length; i++) {
    const gap = t.segments[i].startMs - t.segments[i - 1].endMs;
    if (gap > longest) longest = gap;
  }
  return longest;
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export { countWords };
