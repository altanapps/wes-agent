import type { CaptureLane } from "../../shared/ipc.js";

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
  await ctx.audioWorklet.addModule("/pcm-worklet.js");
  const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  const node = new AudioWorkletNode(ctx, "pcm-chunker");

  let samplesSent = 0;
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    const startMs = Math.round((samplesSent / SAMPLE_RATE) * 1000);
    samplesSent += e.data.byteLength / 2;
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
