/** Gemini Live renvoie de l'audio PCM 16-bit little-endian, en général à 24 kHz. */
export const GEMINI_OUTPUT_SAMPLE_RATE = 24_000;
export const GEMINI_INPUT_SAMPLE_RATE = 16_000;

export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function base64ToPcm(base64: string): Float32Array {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new DataView(buffer);
  for (let i = 0; i < binary.length; i++) {
    view.setUint8(i, binary.charCodeAt(i));
  }
  const pcm = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < pcm.length; i++) {
    const int16 = view.getInt16(i * 2, true);
    pcm[i] = int16 / (int16 < 0 ? 0x8000 : 0x7FFF);
  }
  return pcm;
}

export function parseSampleRateFromMime(mimeType?: string): number {
  if (!mimeType) return GEMINI_OUTPUT_SAMPLE_RATE;
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? parseInt(match[1], 10) : GEMINI_OUTPUT_SAMPLE_RATE;
}

let nextStartTime = 0;
let playbackOutput: GainNode | null = null;

export function ensurePlaybackChain(audioCtx: AudioContext): GainNode {
  if (playbackOutput && playbackOutput.context === audioCtx) {
    return playbackOutput;
  }

  const gain = audioCtx.createGain();
  gain.gain.value = 1.05;

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  gain.connect(compressor);
  compressor.connect(audioCtx.destination);
  playbackOutput = gain;
  return gain;
}

export function playAudioChunk(
  audioCtx: AudioContext,
  base64Audio: string,
  sampleRate = GEMINI_OUTPUT_SAMPLE_RATE,
) {
  const pcm = base64ToPcm(base64Audio);
  if (pcm.length === 0) return;

  const audioBuffer = audioCtx.createBuffer(1, pcm.length, sampleRate);
  audioBuffer.getChannelData(0).set(pcm);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;

  const output = ensurePlaybackChain(audioCtx);
  source.connect(output);

  const now = audioCtx.currentTime;
  const lead = 0.03;
  if (nextStartTime < now + lead) {
    nextStartTime = now + lead;
  }

  source.start(nextStartTime);
  nextStartTime += audioBuffer.duration;
}

export function resetAudioSync() {
  nextStartTime = 0;
}

export function disposePlaybackChain() {
  playbackOutput?.disconnect();
  playbackOutput = null;
  nextStartTime = 0;
}
