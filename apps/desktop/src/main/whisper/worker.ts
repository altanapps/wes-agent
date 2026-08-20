import { Whisper } from "smart-whisper";

/**
 * Whisper utilityProcess entry. Isolated so a native crash kills this
 * process, not the app; the manager respawns and re-queues.
 *
 * Protocol (parentPort messages):
 *   in : {type:"init", modelPath}
 *        {type:"job", id, offsetMs, pcm: ArrayBuffer (Int16, 16kHz mono)}
 *        {type:"shutdown"}
 *   out: {type:"ready"} | {type:"result", id, segments:[{startMs,endMs,text}]}
 *        | {type:"error", id?, message}
 */

// Bias whisper toward emitting fillers — it suppresses them by default, and
// fillers are part of what we measure. Counts remain a lower bound.
const FILLER_PROMPT = "Um, uh, you know, like, I mean, so, actually, basically.";

let whisper: Whisper | null = null;

const port = process.parentPort;

port.on("message", (e) => {
  void handle(e.data as WorkerMessage);
});

interface WorkerMessage {
  type: "init" | "job" | "shutdown";
  id?: number;
  modelPath?: string;
  offsetMs?: number;
  pcm?: ArrayBuffer;
}

async function handle(msg: WorkerMessage): Promise<void> {
  try {
    if (msg.type === "init") {
      whisper = new Whisper(msg.modelPath!, { gpu: true });
      port.postMessage({ type: "ready" });
      return;
    }
    if (msg.type === "shutdown") {
      await whisper?.free().catch(() => {});
      process.exit(0);
    }
    if (msg.type === "job") {
      if (!whisper) throw new Error("whisper not initialized");
      const int16 = new Int16Array(msg.pcm!);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      const task = await whisper.transcribe(float32, {
        language: "en",
        // Not all bindings expose every whisper.cpp param — pass through what we can.
        ...({ initial_prompt: FILLER_PROMPT, suppress_non_speech_tokens: false } as object),
      });
      const result = (await task.result) as { from: number; to: number; text: string }[];

      const offset = msg.offsetMs ?? 0;
      const segments = result
        .map((r) => ({
          startMs: offset + r.from,
          endMs: offset + r.to,
          text: cleanText(r.text),
        }))
        .filter((s) => s.text.length > 0);

      port.postMessage({ type: "result", id: msg.id, segments });
    }
  } catch (err) {
    port.postMessage({ type: "error", id: msg.id, message: (err as Error).message });
  }
}

/** Drop whisper's non-speech annotations like [BLANK_AUDIO], (music), ♪. */
function cleanText(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)|♪/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
