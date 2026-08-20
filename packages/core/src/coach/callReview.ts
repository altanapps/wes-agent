import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { type CoachConfig, requireAnthropicKey } from "../config.js";
import { readCharacterFiles } from "../character.js";
import { existsSync, readFileSync } from "node:fs";
import { coachPaths } from "../storage/paths.js";
import type { CallMetrics, CallTranscript, CoachingReport } from "./types.js";

/**
 * Wes's per-call review: ONE Anthropic call per call-end.
 * Input: the merged transcript (my turns verbatim — they're the diagnostic
 * substrate), the deterministic metrics JSON, the speech rubric + frameworks,
 * and the current coaching profile (so "again" language is possible).
 * Output: schema-validated CoachingReport — no markdown scraping.
 */

const score = z.number().int().min(1).max(5);

const ReportSchema = z.object({
  scores: z.object({
    salesBeforeLogistics: score,
    punchlineFirst: score,
    density: score,
    signposting: score,
    accurateConfidence: score,
    mooHandled: score,
    total: z.number().int().min(6).max(30),
  }),
  summaryLine: z
    .string()
    .describe("One blunt sentence — the single most important thing about how they spoke."),
  moments: z
    .array(
      z.object({
        atMs: z.number().int().describe("Timestamp (ms) of the quoted moment"),
        quote: z.string().describe("VERBATIM quote from one of MY turns in the transcript"),
        problem: z.string(),
        framework: z.string().describe("Which framework it violates"),
        instead: z.string().describe("The exact spoken sentence to say instead"),
      }),
    )
    .min(1)
    .max(3),
  recurring: z
    .string()
    .nullable()
    .describe("If this repeats a pattern from the coaching profile, name it; else null."),
  drill: z.string().describe("ONE drill for the next call, one line."),
});

/** ~60 min of speech; beyond this we compress the other side, never mine. */
const FULL_TRANSCRIPT_WORD_BUDGET = 10_000;

export async function buildCallReview(
  config: CoachConfig,
  transcript: CallTranscript,
  metrics: CallMetrics,
): Promise<CoachingReport> {
  requireAnthropicKey(config);
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const knowledge = readCharacterFiles(config, ["frameworks.md", "speech-protocol.md"]);
  const profile = loadProfile(config);

  const response = await client.messages.parse({
    model: config.model,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: `You are Wes, an executive-communication coach reviewing how this person SPOKE on a call they just finished. Be specific, evidence-based, and blunt in a caring way. Quote only from THEIR turns (labeled "Me"). Timestamps are milliseconds from call start.\n\n${knowledge}`,
        cache_control: { type: "ephemeral" },
      },
      // Separate block: profile churn must not bust the frameworks cache above.
      {
        type: "text",
        text: profile
          ? `# Their coaching profile (recurring patterns from their real messages)\n\n${profile}`
          : "# Their coaching profile\n\n(none yet — this may be their first reviewed communication)",
      },
    ],
    output_config: {
      effort: config.effort,
      format: zodOutputFormat(ReportSchema),
    },
    messages: [
      {
        role: "user",
        content: `Review this call.\n\n## Metrics (deterministic, from the transcript)\n${JSON.stringify(metrics)}\n\n## Transcript (${transcript.captureMode})\n${renderTranscript(transcript)}`,
      },
    ],
  });

  const report = response.parsed_output;
  if (!report) {
    throw new Error("Call review did not return a valid report.");
  }
  return report;
}

function loadProfile(config: CoachConfig): string | null {
  const path = coachPaths(config.dataDir).profileFile;
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8").trim();
  return body || null;
}

/**
 * Long-call policy: my turns are ALWAYS verbatim (they're what gets judged and
 * quoted); when the call exceeds the word budget, them-turns compress to their
 * first sentence. Never the other way around.
 */
export function renderTranscript(t: CallTranscript): string {
  const totalWords = t.turns.reduce((n, x) => n + x.wordCount, 0);
  const compressThem = totalWords > FULL_TRANSCRIPT_WORD_BUDGET;

  return t.turns
    .map((turn) => {
      const stamp = msToClock(turn.startMs);
      const who = turn.speaker === "me" ? "Me" : "Them";
      const text =
        compressThem && turn.speaker === "them" ? firstSentence(turn.text) : turn.text;
      return `[${stamp}] ${who}: ${text}`;
    })
    .join("\n");
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  const first = match ? match[0] : text.split(/\s+/).slice(0, 25).join(" ");
  return first.length < text.length ? `${first} […]` : first;
}

export function msToClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
