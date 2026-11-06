// micChunker.ts — the microphone's native-rate samples into the pitch model's
// 16 kHz windows: shared by MicCaptureWorker.ts and MicrophoneInput.ts
// (MediaStreamTrackProcessor, in a worker or on the main thread) and
// PitchFinderWorklet.ts (the audio thread).
//
// Resamples by linear interpolation and emits the newest WINDOW samples every
// HOP target samples. Alongside, it looks for hissed consonants in the
// native-rate signal (fricative.ts), which the 16 kHz copy no longer holds:
// each chunk says whether its newest 30 ms had one (`fric`).
//
// Each chunk also says where it ends in the audio taken in (`pos`, seconds):
// the recording (AudioRecorder.ts) pauses with the song just like the
// capture, so `pos` places every pitch in the recorded audio.
//
// The window is a ring: the newest sample overwrites the oldest and a chunk
// is unrolled into its own array. Shifting the whole window by one for every
// target sample moved ~15 million floats a second on the main thread.
//
// With displaySamples, the end of a push also offers its newest samples
// (`onDisplay`) for the highway's provisional pitch (provisionalPitch.ts). These
// come on top of the chunks and change nothing about them: same samples, same
// moments, so the scored stream is the one it would be without.

import { createFricativeDetector } from './fricative';

/** One 16 kHz window of the microphone (createChunker) */
export interface MicChunk {
  /** the newest windowSamples samples, in an array of its own (free to transfer) */
  audio: Float32Array<ArrayBuffer>;
  /** the window's RMS */
  volume: number;
  /** 1 when its newest 30 ms held a hissed consonant (fricative.ts), else 0 */
  fric: 0 | 1;
  /** where it ends in the audio taken in, s */
  pos: number;
}

/** The newest samples between two chunks, for the highway alone (createChunker's onDisplay) */
export interface DisplayChunk {
  /** the newest displaySamples samples, in an array of their own (free to transfer) */
  audio: Float32Array<ArrayBuffer>;
  /** their RMS */
  volume: number;
  /** where they end in the audio taken in, s */
  pos: number;
}

/** A display chunk as a capture path hands it on */
export type DisplayOutput = DisplayChunk & { display: 1 };

export interface ChunkerOptions {
  nativeRate: number;
  targetRate?: number;
  windowSamples?: number;
  hopSamples?: number;
  /** samples of a display chunk, at most windowSamples; none: no display chunks */
  displaySamples?: number;
  /** target samples at least between two display chunks */
  displayHopSamples?: number;
  onChunk: (chunk: MicChunk) => void;
  onDisplay?: (chunk: DisplayChunk) => void;
}

/** Native-rate samples in, 16 kHz windows out (createChunker) */
export interface Chunker {
  /** Native-rate samples input[0, inputLen). */
  push(input: ArrayLike<number>, inputLen?: number): void;
  /** Start from a clean window (after a pause): nothing from before leaks into the first chunk. */
  reset(): void;
}

export interface MicCaptureOptions extends ChunkerOptions {
  levelsPerSec?: number;
  onLevel: (volume: number) => void;
}

/** A microphone's whole capture (createMicCapture) */
export interface MicCapture {
  /** Native-rate samples input[0, inputLen). */
  push(input: ArrayLike<number>, inputLen?: number): void;
  setActive(value: boolean): void;
}

/** What a capture sends while the song is paused: the input level only */
export interface MicLevel {
  volume: number;
}

/** What a capture hands on: a chunk while active, else a level */
export type CaptureOutput = MicChunk | MicLevel | DisplayOutput;

/** The chunker's options as MicCaptureWorker.ts gets them (the callbacks are its own) */
export type MicCaptureWorkerOptions = Omit<MicCaptureOptions, 'onChunk' | 'onLevel' | 'onDisplay'>;

/** What MicCaptureWorker.ts reads of a track processor's frame (an AudioData) */
export type AudioFrame = Pick<AudioData, 'numberOfFrames' | 'copyTo' | 'close'> & Partial<Pick<AudioData, 'timestamp' | 'sampleRate'>>;

/** Messages to MicCaptureWorker.ts: the stream to read; the song paused / runs again (`gen` tags everything sent after) */
export type MicCaptureRequest =
  | { type: 'start', readable: ReadableStream<AudioFrame>, options: MicCaptureWorkerOptions }
  | { type: 'active', active: boolean, gen: number };

/** MicCaptureWorker.ts's messages: chunks and levels tagged with the latest `gen`, the frames' age now and then, or that the stream could not be read */
export type MicCaptureMessage = (CaptureOutput & { gen: number, type?: undefined }) | { type: 'failed', error: string } | { type: 'frameAge', age: FrameAge };

/** MicCaptureWorker.ts's global scope as it uses it: a dedicated worker's */
export interface MicCaptureScope {
  postMessage(message: MicCaptureMessage, transfer?: Transferable[]): void;
  onmessage: ((e: { data: MicCaptureRequest }) => void) | null;
}

/** Messages to PitchFinderWorklet.ts (its port) */
export type PitchWorkletRequest = { type: 'active', active: boolean };

/** What PitchFinderWorklet.ts's processorOptions hold */
export interface PitchWorkletOptions {
  nativeSampleRate?: number;
  targetSampleRate?: number;
  displaySamples?: number;
  displayHopSamples?: number;
}

/** How old the mic's frames are when they reach us (createFrameAgeMeter): ms from a frame's timestamp to its read */
export interface FrameAge {
  /** frames counted */
  n: number;
  p10: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  /** the frames' length, ms */
  frameMs: number;
}

const AGE_MAX_MS = 1000; // anything older is no capture time: the clock is not performance.now's (below Chrome 152)
const AGE_MIN_MS = -5;   // the clocks' own slack: a frame read as it came may be stamped a hair ahead

/**
 * A running measure of frame age from AudioData.timestamp, which on Chrome 152
 * and later is the capture time on performance.now's clock. Nothing else in a
 * page tells how late the microphone's sound really arrives on a real device:
 * it goes with the recording's `capture` facts, to read from production later.
 * Older browsers' timestamps fall outside the range and are not counted.
 *
 * What the stamp stands for depends on the platform's audio path: the first
 * sample where the OS tells that (WASAPI, Core Audio, AAudio since Chrome's
 * fix of 2026-07), about the moment of delivery on Chrome's fake device. So the
 * age is kept as it is, with the frames' length beside it, not worked out to
 * the frame's last sample.
 */
export function createFrameAgeMeter() {
  const counts = new Uint32Array(AGE_MAX_MS + 1); // one per ms: nothing to sort or to grow
  let n = 0, max = 0, frameMs = 0;
  const at = (q: number) => {
    let sum = 0;
    for (let ms = 0; ms <= AGE_MAX_MS; ms++) {
      sum += counts[ms];
      if (sum > q * n) return ms;
    }
    return AGE_MAX_MS;
  };
  return {
    /** A frame just read: its timestamp (µs) and length (ms). */
    push(timestampUs: number, lengthMs: number, now: number) {
      const age = now - timestampUs / 1000;
      if (!(age >= AGE_MIN_MS && age <= AGE_MAX_MS)) return;
      counts[Math.max(0, Math.round(age))]++;
      n++;
      frameMs = lengthMs;
      if (age > max) max = age;
    },
    /** What there is so far, null with nothing counted. */
    read(): FrameAge | null {
      return n ? { n, p10: at(0.1), p50: at(0.5), p90: at(0.9), p99: at(0.99), max: Math.round(max), frameMs: Math.round(frameMs * 10) / 10 } : null;
    },
  };
}

/**
 * Whether the way from the microphone to the page got longer during a session.
 * On the AudioWorklet path the delay climbs in steps at audio glitches and
 * stays there: 51, 121 and 402 ms in three runs of two minutes in Chromium,
 * nothing trims the buffer. AudioData's capture time does not exist on that
 * path, so this compares a chunk's arrival with its place in the audio: only
 * the change means anything. The quickest chunk of a stretch counts, so a busy
 * main thread does not read as a longer path.
 */
export function createLagWatch(stretchMs = 5000) {
  let best = Infinity;  // the quickest any stretch has been
  let low = Infinity;   // this stretch's quickest
  let startedAt = -1;
  let grown = 0;
  return {
    /** A chunk came at `now` (ms) that ends at `pos` (s) in the audio taken in. */
    push(now: number, pos: number) {
      if (startedAt < 0) startedAt = now;
      low = Math.min(low, now - pos * 1000);
      if (now - startedAt < stretchMs) return;
      best = Math.min(best, low);
      grown = Math.max(grown, low - best);
      low = Infinity;
      startedAt = now;
    },
    /** The capture paused: the audio's clock stood still, so the lag starts over. What it grew by stays. */
    restart() {
      best = Infinity;
      low = Infinity;
      startedAt = -1;
    },
    /** ms the path got longer by, at most, so far */
    grown: () => Math.round(grown),
  };
}

/**
 * @param options
 *   onChunk gets each window in an array of its own (free to transfer)
 */
export function createChunker({ nativeRate, targetRate = 16000, windowSamples = 960, hopSamples = 480, displaySamples = 0, displayHopSamples = 160, onChunk, onDisplay }: ChunkerOptions): Chunker {
  const ratio = nativeRate / targetRate;
  const ring = new Float32Array(windowSamples);
  let head = 0;                    // the ring's oldest sample, where the next one goes
  let samplesUntilNext = windowSamples;
  // Fractional resampler state: the position between native samples
  let resamplePos = 0;
  let prevSample = 0;
  const fricative = createFricativeDetector(nativeRate);
  let activeSamples = 0;           // native samples taken in: the clock of a chunk's `pos`
  let sinceDisplay = -1;           // target samples since the last display chunk; -1: the ring is not full yet

  return {
    /** Native-rate samples input[0, inputLen). */
    push(input: ArrayLike<number>, inputLen = input.length) {
      let fed = 0; // input samples already given to the consonant detector
      for (let i = 0; i < inputLen; i++) {
        const cur = input[i];
        // Emit target-rate samples while our position hasn't passed this input sample
        while (resamplePos <= i) {
          const lo = Math.floor(resamplePos);
          const frac = resamplePos - lo;
          // Interpolate between previous and current sample
          ring[head] = lo < i ? prevSample * (1 - frac) + cur * frac : cur;
          if (++head === windowSamples) head = 0;
          if (sinceDisplay >= 0) sinceDisplay++;

          if (--samplesUntilNext <= 0) {
            const audio = new Float32Array(windowSamples);
            audio.set(ring.subarray(head));
            audio.set(ring.subarray(0, head), windowSamples - head);
            let sumSq = 0;
            for (let j = 0; j < windowSamples; j++) sumSq += audio[j] * audio[j];
            const volume = Math.sqrt(sumSq / windowSamples);
            // The consonant detector sees the input up to this chunk's end, nothing later
            fricative.push(input, fed, i + 1);
            fed = i + 1;
            onChunk({ audio, volume, fric: fricative.flag(), pos: (activeSamples + i + 1) / nativeRate });
            samplesUntilNext += hopSamples;
            if (sinceDisplay < 0) sinceDisplay = displayHopSamples; // the ring is full from here on
          }

          resamplePos += ratio;
        }
        prevSample = cur;
      }
      fricative.push(input, fed, inputLen);
      activeSamples += inputLen;
      resamplePos -= inputLen;

      // At the end of what came in, so a display chunk holds everything there
      // is: a frame's end, not the middle of a frame that has to wait for its rest
      if (displaySamples && onDisplay && sinceDisplay >= displayHopSamples) {
        sinceDisplay = 0;
        const audio = new Float32Array(displaySamples);
        for (let j = 0, at = (head - displaySamples + windowSamples) % windowSamples; j < displaySamples; j++) {
          audio[j] = ring[at];
          if (++at === windowSamples) at = 0;
        }
        let sumSq = 0;
        for (let j = 0; j < displaySamples; j++) sumSq += audio[j] * audio[j];
        onDisplay({ audio, volume: Math.sqrt(sumSq / displaySamples), pos: activeSamples / nativeRate });
      }
    },

    /** Start from a clean window (after a pause): nothing from before leaks into the first chunk. */
    reset() {
      ring.fill(0);
      head = 0;
      samplesUntilNext = windowSamples;
      resamplePos = 0;
      prevSample = 0;
      sinceDisplay = -1;
      fricative.reset();
    },
  };
}

/**
 * A microphone's whole capture: chunks (createChunker) while the song plays;
 * while it is paused (setActive(false)) no resampling and no chunks, only a
 * coarse input level a few times a second for the microphone panel's meter.
 */
export function createMicCapture({ levelsPerSec = 10, onLevel, ...chunkOptions }: MicCaptureOptions): MicCapture {
  const chunker = createChunker(chunkOptions);
  let active = true;
  let idleSumSq = 0;
  let idleCount = 0;
  const idleSamplesPerLevel = Math.round(chunkOptions.nativeRate / levelsPerSec);

  return {
    /** Native-rate samples input[0, inputLen). */
    push(input: ArrayLike<number>, inputLen = input.length) {
      if (active) {
        chunker.push(input, inputLen);
        return;
      }
      let sumSq = 0;
      for (let i = 0; i < inputLen; i++) sumSq += input[i] * input[i];
      idleSumSq += sumSq;
      idleCount += inputLen;
      if (idleCount >= idleSamplesPerLevel) {
        const volume = Math.sqrt(idleSumSq / idleCount);
        idleSumSq = 0;
        idleCount = 0;
        onLevel(volume);
      }
    },

    setActive(value: boolean) {
      if (value === active) return;
      active = value;
      idleSumSq = 0;
      idleCount = 0;
      if (value) chunker.reset();
    },
  };
}
