/**
 * AudioWorklet: batch 128-frame render quanta into ~0.5 s Int16 PCM chunks
 * and post them to the node. The AudioContext runs at 16 kHz (the context
 * itself resamples from hardware rate), so no downsampling needed here.
 * Plain JS on purpose: worklets load as raw modules, outside the bundler.
 */
class PcmChunker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.count = 0;
    this.target = 8192; // ~0.51 s at 16 kHz
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.samples.push(Float32Array.from(channel));
      this.count += channel.length;
      if (this.count >= this.target) this.flush();
    }
    return true;
  }

  flush() {
    const pcm = new Int16Array(this.count);
    let offset = 0;
    for (const block of this.samples) {
      for (let i = 0; i < block.length; i++) {
        const v = Math.max(-1, Math.min(1, block[i]));
        pcm[offset++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
    }
    this.samples = [];
    this.count = 0;
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
  }
}

registerProcessor("pcm-chunker", PcmChunker);
