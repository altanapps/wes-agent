import type { Message, Source } from "./types.js";

/**
 * Calls feeder (priority 3, Granola-style). Turns your *spoken* turns in call
 * transcripts into the corpus, so the coach can diagnose verbal habits
 * (rambling, no signposting, burying the ask out loud). See docs/capture-channels.md §3.
 *
 * Mechanism (when wired): on-device mic + system-audio capture (no meeting bot),
 * diarize by source (your mic = you), transcribe → feed only YOUR turns here.
 *
 * Not implemented yet — needs the capture/STT layer. Stubbed for structure.
 */
export function transcriptsSource(): Source {
  return {
    name: "call",
    async fetch(): Promise<Message[]> {
      throw new Error(
        "Call transcripts source not wired yet — needs on-device capture + STT (see docs/capture-channels.md §3).",
      );
    },
  };
}
