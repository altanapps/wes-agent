/** Speech-side types: what a recorded call becomes on its way to coaching. */

export type Speaker = "me" | "them";
export type CaptureMode = "mic+system" | "mic-only";

/** One whisper segment, session-absolute timestamps. */
export interface TranscriptSegment {
  speaker: Speaker;
  startMs: number;
  endMs: number;
  text: string;
}

/** Consecutive same-speaker segments coalesced into a spoken turn. */
export interface Turn {
  speaker: Speaker;
  startMs: number;
  endMs: number;
  text: string;
  wordCount: number;
}

export interface CallTranscript {
  captureMode: CaptureMode;
  durationMs: number;
  segments: TranscriptSegment[];
  turns: Turn[];
}

/** Deterministic per-call metrics — computed from the transcript, no LLM. */
export interface CallMetrics {
  schemaVersion: 1;
  captureMode: CaptureMode;
  durationMs: number;
  talk: {
    meMs: number;
    themMs: number | null;
    /** meMs / (meMs + themMs); null in mic-only mode. */
    ratioMe: number | null;
    turnCountMe: number;
    turnCountThem: number | null;
    longestMonologueMe: { startMs: number; durationMs: number; words: number } | null;
    medianTurnDurationMeMs: number | null;
  };
  pace: {
    wpmOverall: number | null;
    /** WPM per quarter of the call — catches pace collapse. */
    wpmPerQuartile: (number | null)[];
    wordCountMe: number;
  };
  fillers: {
    per100Words: number;
    total: number;
    counts: Record<string, number>;
    note: "lower bound; STT under-reports fillers";
  };
  interruptions: {
    byMe: number | null;
    byThem: number | null;
    backchannelsByMe: number | null;
  };
  pauses: {
    avgResponseLatencyMs: number | null;
    intraTurnPausesOver2sMe: number;
    longestSilenceMs: number | null;
  };
  rambling: {
    turnsOver60sMe: number;
    avgWordsPerTurnMe: number | null;
  };
}

/** Wes's per-call review — validated LLM output (schema in callReview.ts). */
export interface CoachingReport {
  scores: {
    salesBeforeLogistics: number;
    punchlineFirst: number;
    density: number;
    signposting: number;
    accurateConfidence: number;
    mooHandled: number;
    total: number;
  };
  summaryLine: string;
  moments: {
    atMs: number;
    quote: string;
    problem: string;
    framework: string;
    instead: string;
  }[];
  recurring: string | null;
  drill: string;
}

/** All timing knobs in one place — tunable, documented, testable. */
export const METRIC_THRESHOLDS = {
  /** Same-speaker segments closer than this coalesce into one turn. */
  turnCoalesceGapMs: 1500,
  /** My segment must start this far into a them-turn to count as an interruption. */
  interruptionGraceMs: 300,
  /** …and the them-turn must have at least this much left. */
  interruptionRemainingMs: 1000,
  /** My overlapping segments shorter than this are backchannels ("yeah"), not interruptions. */
  backchannelMaxMs: 1500,
  /** Dead air inside my own turn that counts as losing the thread. */
  intraTurnPauseMs: 2000,
  /** A me-turn longer than this counts toward the rambling proxy. */
  monologueMs: 60_000,
} as const;

export const FILLER_PHRASES = [
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "um",
  "uh",
  "like",
  "basically",
  "actually",
  "literally",
] as const;
