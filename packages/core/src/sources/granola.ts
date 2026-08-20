import type { Message, Source } from "./types.js";

/**
 * Granola feeder — the "easiest to grab" calls source. If the user already
 * records meetings with Granola, we don't double-record: pull their meeting
 * transcripts via Granola's public API and keep only THEIR spoken turns.
 *
 * Diarization is by capture source, same model as our native pipeline:
 * `speaker.source === "microphone"` is the user; `"speaker"` (system audio)
 * is everyone else. See https://docs.granola.ai (API keys: Business plan,
 * Settings → Connectors → API keys, `grn_…`).
 */

const BASE_URL = "https://public-api.granola.ai/v1";

export interface GranolaOptions {
  /** Granola API key (grn_…). */
  apiKey: string;
  /** Only pull notes created after this ISO timestamp (incremental runs). */
  createdAfter?: string;
  /** Skip spoken turns shorter than this many words (backchannels: "yeah", "right"). */
  minWordsPerTurn?: number;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
}

interface GranolaNote {
  id: string;
  title?: string;
  created_at?: string;
}

interface TranscriptSegment {
  speaker?: { source?: string; diarization_label?: string };
  text?: string;
}

export function granolaSource(opts: GranolaOptions): Source & {
  /** Newest note created_at seen in the last fetch — the next run's cursor. */
  newestCreatedAt(): string | undefined;
} {
  let newest: string | undefined;
  const minWords = opts.minWordsPerTurn ?? 25;
  const doFetch = opts.fetchImpl ?? fetch;

  async function api<T>(path: string): Promise<T> {
    const res = await doFetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Granola rejected the API key. Keys need a Business-plan workspace (Granola → Settings → Connectors → API keys).",
      );
    }
    if (!res.ok) {
      throw new Error(`Granola API ${path} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async function fetchTranscript(noteId: string): Promise<TranscriptSegment[]> {
    try {
      const note = await api<{ transcript?: TranscriptSegment[] }>(
        `/notes/${noteId}?include=transcript`,
      );
      if (note.transcript) return note.transcript;
    } catch (err) {
      // 413 TRANSCRIPT_TOO_LARGE → dedicated endpoint below; other errors rethrow.
      if (!(err as Error).message.includes("413")) throw err;
    }
    return api<TranscriptSegment[]>(`/notes/${noteId}/transcript`);
  }

  return {
    name: "call",
    newestCreatedAt: () => newest,

    async fetch(): Promise<Message[]> {
      if (!opts.apiKey) {
        throw new Error("Granola API key not set (GRANOLA_API_KEY or desktop Settings).");
      }

      // Page through notes (cursor pagination), newest state tracked for incremental runs.
      const notes: GranolaNote[] = [];
      let cursor: string | undefined;
      do {
        const params = new URLSearchParams();
        if (opts.createdAfter) params.set("created_after", opts.createdAfter);
        if (cursor) params.set("cursor", cursor);
        const qs = params.size ? `?${params}` : "";
        const page = await api<{ notes?: GranolaNote[]; hasMore?: boolean; cursor?: string }>(
          `/notes${qs}`,
        );
        notes.push(...(page.notes ?? []));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);

      const out: Message[] = [];
      for (const note of notes) {
        if (note.created_at && (!newest || note.created_at > newest)) newest = note.created_at;
        let segments: TranscriptSegment[];
        try {
          segments = await fetchTranscript(note.id);
        } catch {
          continue; // note without accessible transcript — skip, keep the run alive
        }
        for (const turn of myTurns(segments, minWords)) {
          out.push({
            text: turn,
            channel: "call",
            date: note.created_at,
            audience: note.title ? `meeting: ${note.title}` : "meeting",
          });
        }
      }
      return out;
    },
  };
}

/**
 * Coalesce consecutive microphone segments into spoken turns and drop short
 * backchannels. Exported for tests.
 */
export function myTurns(segments: TranscriptSegment[], minWords: number): string[] {
  const turns: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const text = current.join(" ").replace(/\s+/g, " ").trim();
    if (text && text.split(" ").length >= minWords) turns.push(text);
    current = [];
  };

  for (const seg of segments) {
    if (seg.speaker?.source === "microphone" && seg.text?.trim()) {
      current.push(seg.text.trim());
    } else {
      flush();
    }
  }
  flush();
  return turns;
}
