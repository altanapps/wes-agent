import { app } from "electron";
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { WhisperModelId, WhisperModelState } from "../../shared/ipc.js";

/**
 * GGML whisper models, downloaded on demand from the official whisper.cpp
 * repo on Hugging Face — never bundled in the app binary.
 */
const CATALOG: Record<WhisperModelId, { label: string; sizeMb: number }> = {
  "tiny.en": { label: "Tiny (fastest, rough)", sizeMb: 75 },
  "base.en": { label: "Base (fast)", sizeMb: 142 },
  "small.en": { label: "Small (recommended)", sizeMb: 466 },
};

const downloading = new Map<WhisperModelId, number>();

function modelsDir(): string {
  const dir = join(app.getPath("userData"), "models");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function modelPath(id: WhisperModelId): string {
  return join(modelsDir(), `ggml-${id}.bin`);
}

export function isInstalled(id: WhisperModelId): boolean {
  // Guard against truncated files from an interrupted rename-less download.
  return existsSync(modelPath(id)) && statSync(modelPath(id)).size > 10_000_000;
}

/** The preferred model if installed, else the best installed one (larger =
 *  better), else null. Recording with a smaller model beats not recording. */
export function bestInstalledModel(preferred: WhisperModelId): WhisperModelId | null {
  const order: WhisperModelId[] = [preferred, "small.en", "base.en", "tiny.en"];
  return order.find(isInstalled) ?? null;
}

export function modelsState(): WhisperModelState[] {
  return (Object.keys(CATALOG) as WhisperModelId[]).map((id) => ({
    id,
    label: CATALOG[id].label,
    sizeMb: CATALOG[id].sizeMb,
    installed: isInstalled(id),
    downloadingPct: downloading.get(id) ?? null,
  }));
}

export async function downloadModel(
  id: WhisperModelId,
  onProgress: (pct: number) => void,
): Promise<void> {
  if (isInstalled(id) || downloading.has(id)) return;
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${id}.bin`;
  const partPath = `${modelPath(id)}.part`;
  downloading.set(id, 0);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body) {
      throw new Error(`Model download failed: ${res.status} ${res.statusText}`);
    }
    const total = Number(res.headers.get("content-length") ?? 0);
    let received = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        received += chunk.byteLength;
        if (total > 0) {
          const pct = Math.round((received / total) * 100);
          if (pct !== downloading.get(id)) {
            downloading.set(id, pct);
            onProgress(pct);
          }
        }
        controller.enqueue(chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(res.body.pipeThrough(counter) as import("node:stream/web").ReadableStream),
      createWriteStream(partPath),
    );
    renameSync(partPath, modelPath(id));
  } catch (err) {
    try {
      unlinkSync(partPath);
    } catch {
      // nothing to clean
    }
    throw err;
  } finally {
    downloading.delete(id);
  }
}
