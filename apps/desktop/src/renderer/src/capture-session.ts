import type { CaptureLane } from "../../shared/ipc.js";
import { loadPcmWorklet } from "./pcmWorklet.js";

/**
 * Recording-session audio graph (runs in the hidden capture window).
 * Two lanes, diarization by source: mic = me, system loopback = them.
 * Each lane: MediaStream → 16 kHz AudioContext (Chromium resamples) →
 * pcm-worklet (0.5 s Int16 chunks) → main via wes.captureChunk with a
 * per-lane clock derived from cumulative samples.
 *
 * If the system lane can't open (permission, macOS < 14.2, in-person meeting),
 * we degrade to mic-only and tell main — never fail the whole session for it.
 */
const SAMPLE_RATE = 16000;

// One epoch for BOTH lanes. Each lane's sample counter gives intra-lane
// precision, but the system lane opens 0.5–2s after the mic (getDisplayMedia
// latency) — without a shared anchor, "them" timestamps skew earlier than
// "me" by that delay, right inside the interruption/backchannel windows the
// metrics depend on.
const sessionEpoch = performance.now();

async function openLane(lane: CaptureLane): Promise<void> {
  const stream =
    lane === "mic"
      ? await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        })
      : await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });

  if (lane === "system") {
    for (const t of stream.getVideoTracks()) t.stop();
    if (stream.getAudioTracks().length === 0) {
      for (const t of stream.getTracks()) t.stop();
      throw new Error("no system-audio track");
    }
  }

  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  await loadPcmWorklet(ctx);
  const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  const node = new AudioWorkletNode(ctx, "pcm-chunker");

  let samplesSent = 0;
  let laneAnchorMs: number | null = null;
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    const chunkSamples = e.data.byteLength / 2;
    if (laneAnchorMs === null) {
      // First chunk: its audio STARTED chunk-duration ago; anchor the lane's
      // sample clock to the shared session epoch at that moment.
      laneAnchorMs = Math.max(
        0,
        performance.now() - sessionEpoch - (chunkSamples / SAMPLE_RATE) * 1000,
      );
    }
    const startMs = Math.round(laneAnchorMs + (samplesSent / SAMPLE_RATE) * 1000);
    samplesSent += chunkSamples;
    window.wes.captureChunk(lane, e.data, startMs);
  };
  source.connect(node);
}

async function main(): Promise<void> {
  try {
    await openLane("mic");
  } catch (err) {
    window.wes.reportCaptureMode("fatal", `Microphone unavailable: ${(err as Error).message}`);
    return;
  }
  try {
    await openLane("system");
    window.wes.reportCaptureMode("mic+system");
  } catch {
    window.wes.reportCaptureMode("mic-only");
  }
}

void main();
