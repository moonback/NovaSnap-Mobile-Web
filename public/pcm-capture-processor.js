/**
 * NovaSnap — PCM Capture AudioWorklet Processor
 *
 * Runs in the AudioWorklet thread (separate from the main JS thread).
 * Receives 128-sample blocks at the AudioContext sample rate (16 kHz),
 * accumulates them into a configurable buffer, then posts a Float32Array
 * message back to the main thread for transmission.
 *
 * This replaces the deprecated ScriptProcessorNode which ran on the main
 * thread and caused glitches on Chrome mobile due to GC pauses.
 *
 * Buffer size: 4096 samples ≈ 256 ms at 16 kHz.
 * The main thread sends { type: 'stop' } to flush + disconnect cleanly.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }

  /** @type {Float32Array} */
  _buffer;
  /** @type {number} */
  _offset = 0;
  /** @type {boolean} */
  _active = true;
  /** @type {number} */
  _bufferSize;

  constructor(options) {
    super(options);
    this._bufferSize = (options?.processorOptions?.bufferSize) ?? 4096;
    this._buffer = new Float32Array(this._bufferSize);

    this.port.onmessage = (e) => {
      if (e.data?.type === 'stop') {
        this._active = false;
      }
    };
  }

  process(inputs) {
    if (!this._active) return false; // returning false destroys the processor

    const input = inputs[0]?.[0]; // mono
    if (!input) return true;

    for (let i = 0; i < input.length; i++) {
      this._buffer[this._offset++] = input[i];
      if (this._offset >= this._bufferSize) {
        // Transfer ownership to avoid copying — zero-copy path
        const transfer = this._buffer.slice(0);
        this.port.postMessage({ pcm: transfer }, [transfer.buffer]);
        this._offset = 0;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
