import { utilityProcess, type UtilityProcess } from "electron";
import { join } from "node:path";

/**
 * Owns the whisper utilityProcess: spawn, serialized job queue, respawn on
 * crash (jobs are only resolved after a result arrives, so the in-flight job
 * is retried once on a fresh worker; worst case loses one ~20s window).
 */
interface Job {
  id: number;
  offsetMs: number;
  pcm: ArrayBuffer;
  attempts: number;
  resolve: (segments: { startMs: number; endMs: number; text: string }[]) => void;
  reject: (err: Error) => void;
}

const MAX_RESPAWNS = 3;
const MAX_ATTEMPTS_PER_JOB = 2;

export class WhisperManager {
  private worker: UtilityProcess | null = null;
  private ready = false;
  private readyWaiters: (() => void)[] = [];
  private queue: Job[] = [];
  private inFlight: Job | null = null;
  private nextId = 1;
  private respawns = 0;
  private modelPath: string | null = null;

  async ensureReady(modelPath: string): Promise<void> {
    if (this.worker && this.ready && this.modelPath === modelPath) return;
    if (this.worker && this.modelPath !== modelPath) this.shutdown();
    this.modelPath = modelPath;
    if (!this.worker) this.spawn();
    if (!this.ready) {
      await new Promise<void>((resolve) => this.readyWaiters.push(resolve));
    }
  }

  private spawn(): void {
    const entry = join(import.meta.dirname, "whisperWorker.js");
    this.worker = utilityProcess.fork(entry, [], { serviceName: "wes-whisper" });
    this.ready = false;

    this.worker.on("message", (msg: WorkerReply) => {
      if (msg.type === "ready") {
        this.ready = true;
        this.respawns = 0;
        for (const w of this.readyWaiters.splice(0)) w();
        this.pump();
        return;
      }
      const job = this.inFlight;
      this.inFlight = null;
      if (!job || msg.id !== job.id) {
        this.pump();
        return;
      }
      if (msg.type === "result") job.resolve(msg.segments ?? []);
      else job.reject(new Error(msg.message ?? "whisper error"));
      this.pump();
    });

    this.worker.on("exit", () => {
      this.worker = null;
      this.ready = false;
      const dropped = this.inFlight;
      this.inFlight = null;
      if (dropped) {
        dropped.attempts += 1;
        if (dropped.attempts < MAX_ATTEMPTS_PER_JOB) this.queue.unshift(dropped);
        else dropped.reject(new Error("whisper worker crashed on this window"));
      }
      if (this.respawns < MAX_RESPAWNS && (this.queue.length || this.readyWaiters.length)) {
        this.respawns += 1;
        this.spawn();
      } else {
        for (const j of this.queue.splice(0)) j.reject(new Error("whisper worker unavailable"));
      }
    });

    this.worker.postMessage({ type: "init", modelPath: this.modelPath });
  }

  transcribe(
    pcm: ArrayBuffer,
    offsetMs: number,
  ): Promise<{ startMs: number; endMs: number; text: string }[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, offsetMs, pcm, attempts: 0, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    if (!this.worker || !this.ready || this.inFlight) return;
    const job = this.queue.shift();
    if (!job) return;
    this.inFlight = job;
    this.worker.postMessage({ type: "job", id: job.id, offsetMs: job.offsetMs, pcm: job.pcm });
  }

  /** Resolves when every queued/in-flight job has settled. */
  async drain(): Promise<void> {
    while (this.queue.length || this.inFlight) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  shutdown(): void {
    this.worker?.postMessage({ type: "shutdown" });
    this.worker?.kill();
    this.worker = null;
    this.ready = false;
  }
}

interface WorkerReply {
  type: "ready" | "result" | "error";
  id?: number;
  segments?: { startMs: number; endMs: number; text: string }[];
  message?: string;
}

export const whisperManager = new WhisperManager();
