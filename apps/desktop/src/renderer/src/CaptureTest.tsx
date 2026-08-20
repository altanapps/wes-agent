import { useRef, useState } from "react";
import type { CaptureLane, CaptureTestResult } from "../../shared/ipc.js";
import { loadPcmWorklet } from "./pcmWorklet.js";

/**
 * Spike A: prove two-lane capture (mic = you, system loopback = them) works on
 * this machine. Records both lanes as 16 kHz PCM, ships chunks to main, and on
 * stop writes one WAV per lane for listening. Later this becomes the
 * onboarding "3-second self-check".
 */
interface LaneHandle {
  stream: MediaStream;
  ctx: AudioContext;
}

export function CaptureTest() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CaptureTestResult | null>(null);
  const lanesRef = useRef<LaneHandle[]>([]);

  async function openLane(lane: CaptureLane): Promise<LaneHandle> {
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
      // The video track is mandatory in the API; we only want loopback audio.
      for (const t of stream.getVideoTracks()) t.stop();
      if (stream.getAudioTracks().length === 0) {
        for (const t of stream.getTracks()) t.stop();
        throw new Error(
          "No system-audio track — grant “System Audio Recording” (or Screen Recording) in System Settings → Privacy & Security, then retry.",
        );
      }
    }

    // 16 kHz context: Chromium resamples the source to whisper's native rate.
    const ctx = new AudioContext({ sampleRate: 16000 });
    await loadPcmWorklet(ctx);
    const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const node = new AudioWorkletNode(ctx, "pcm-chunker");
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      window.wes.captureChunk(lane, e.data, 0);
    };
    source.connect(node);
    return { stream, ctx };
  }

  async function start() {
    setError("");
    setResult(null);
    try {
      await window.wes.captureBegin();
      lanesRef.current = [await openLane("mic"), await openLane("system")];
      setRecording(true);
    } catch (err) {
      await stopLanes();
      // Unlatch test mode in main — a latched flag would silently swallow
      // the audio of every later real recording.
      await window.wes.captureEnd().catch(() => {});
      setError((err as Error).message);
    }
  }

  async function stopLanes() {
    for (const lane of lanesRef.current) {
      for (const t of lane.stream.getTracks()) t.stop();
      await lane.ctx.close().catch(() => {});
    }
    lanesRef.current = [];
  }

  async function stop() {
    setRecording(false);
    await stopLanes();
    setResult(await window.wes.captureEnd());
  }

  return (
    <div>
      <div className="field">
        <label>Capture self-check</label>
        <small>
          Play anything with sound (a video or a real call), speak into the mic for ~30
          seconds, then stop and listen to the two files. Pass = your voice only in{" "}
          <span className="mono">mic.wav</span>, the computer's audio only in{" "}
          <span className="mono">system.wav</span>.
        </small>
      </div>
      <div className="row">
        {!recording ? (
          <button className="btn" onClick={() => void start()}>
            Start capture test
          </button>
        ) : (
          <button className="btn danger-ghost" onClick={() => void stop()}>
            <span className="rec-dot" />
            Stop &amp; write files
          </button>
        )}
        {recording && <span className="status">Recording both lanes…</span>}
      </div>
      {error && <p className="status" style={{ marginTop: 10 }}>⚠️ {error}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          {(Object.entries(result.lanes) as [CaptureLane, { seconds: number; rms: number }][]).map(
            ([lane, info]) => (
              <p className="status" key={lane}>
                <strong>{lane}</strong>: {info.seconds}s · RMS {info.rms}{" "}
                {info.rms < 0.001 ? "⚠️ silent" : "✓ signal"}
              </p>
            ),
          )}
          {result.files.map((f) => (
            <p className="mono" key={f} style={{ marginTop: 6 }}>
              {f}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
