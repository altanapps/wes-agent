import { app } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureLane, CaptureTestResult } from "../shared/ipc.js";

/**
 * Spike A harness: collect 16 kHz mono Int16 PCM per lane during a capture
 * test and write each lane to a WAV in <userData>/capture-test/ so lane
 * cleanliness (AEC, diarization-by-source) can be verified by ear.
 * Audio on disk is acceptable HERE ONLY — this is the explicit capture test;
 * the product pipeline transcribes and deletes.
 */
const SAMPLE_RATE = 16000;

let active = false;
let buffers: Record<CaptureLane, Buffer[]> = { mic: [], system: [] };

export function isCaptureTestActive(): boolean {
  return active;
}

export function beginCaptureTest(): void {
  buffers = { mic: [], system: [] };
  active = true;
}

export function addCaptureChunk(lane: CaptureLane, chunk: ArrayBuffer): void {
  if (!active) return;
  buffers[lane].push(Buffer.from(chunk));
}

export function endCaptureTest(): CaptureTestResult {
  active = false;
  const dir = join(app.getPath("userData"), "capture-test");
  mkdirSync(dir, { recursive: true });

  const result: CaptureTestResult = { files: [], lanes: {} };
  for (const lane of ["mic", "system"] as CaptureLane[]) {
    const pcm = Buffer.concat(buffers[lane]);
    const seconds = pcm.length / 2 / SAMPLE_RATE;
    const rms = pcmRms(pcm);
    result.lanes[lane] = { seconds: Number(seconds.toFixed(1)), rms: Number(rms.toFixed(4)) };
    if (pcm.length) {
      const file = join(dir, `${lane}.wav`);
      writeFileSync(file, wavFromPcm16(pcm, SAMPLE_RATE));
      result.files.push(file);
    }
  }
  buffers = { mic: [], system: [] };
  return result;
}

function pcmRms(pcm: Buffer): number {
  const samples = pcm.length / 2;
  if (!samples) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const v = pcm.readInt16LE(i * 2) / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / samples);
}

function wavFromPcm16(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
