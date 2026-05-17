export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  // chunkSize to avoid Maximum call stack size exceeded
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

let nextStartTime = 0;

export function playAudioChunk(audioCtx: AudioContext, base64Audio: string) {
  const pcm = base64ToPcm(base64Audio);
  const audioBuffer = audioCtx.createBuffer(1, pcm.length, 16000);
  audioBuffer.getChannelData(0).set(pcm);
  
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  if (nextStartTime < audioCtx.currentTime) {
    nextStartTime = audioCtx.currentTime + 0.1; // Add small buffer
  }
  
  source.start(nextStartTime);
  nextStartTime += audioBuffer.duration;
}

export function resetAudioSync() {
  nextStartTime = 0;
}
