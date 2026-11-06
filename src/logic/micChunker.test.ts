import { describe, it, expect } from 'vitest';
import { createChunker, createFrameAgeMeter, createLagWatch, createMicCapture } from './micChunker';
import { createFricativeDetector } from './fricative';
import type { DisplayChunk, MicChunk } from './micChunker';

type MakeChunker = (options: { nativeRate: number, onChunk: (chunk: MicChunk) => void }) => { push(channelData: Float32Array): void, reset(): void };

// The chunking as it was before the ring: the whole window shifted by one for
// every target sample. The ring must give exactly the same chunks.
function createShiftChunker({ nativeRate, onChunk }: Parameters<MakeChunker>[0]) {
  const ratio = nativeRate / 16000;
  const SAMPLE_SIZE = 960, HOP_SIZE = 480;
  const buffer = new Float32Array(SAMPLE_SIZE);
  let samplesUntilNext = SAMPLE_SIZE, resamplePos = 0, prevSample = 0, activeSamples = 0;
  const fricative = createFricativeDetector(nativeRate);
  return {
    reset() {
      buffer.fill(0);
      samplesUntilNext = SAMPLE_SIZE;
      resamplePos = 0;
      prevSample = 0;
      fricative.reset();
    },
    push(channelData: Float32Array) {
      const inputLen = channelData.length;
      let fed = 0;
      for (let i = 0; i < inputLen; i++) {
        const cur = channelData[i];
        while (resamplePos <= i) {
          const frac = resamplePos - Math.floor(resamplePos);
          const lo = Math.floor(resamplePos);
          const sample = lo < i ? prevSample * (1 - frac) + cur * frac : cur;
          buffer.copyWithin(0, 1);
          buffer[SAMPLE_SIZE - 1] = sample;
          samplesUntilNext--;
          if (samplesUntilNext <= 0) {
            let sumSq = 0;
            for (let j = 0; j < SAMPLE_SIZE; j++) sumSq += buffer[j] * buffer[j];
            const volume = Math.sqrt(sumSq / SAMPLE_SIZE);
            fricative.push(channelData, fed, i + 1);
            fed = i + 1;
            onChunk({ audio: new Float32Array(buffer), volume, fric: fricative.flag(), pos: (activeSamples + i + 1) / nativeRate });
            samplesUntilNext += HOP_SIZE;
          }
          resamplePos += ratio;
        }
        prevSample = cur;
      }
      fricative.push(channelData, fed, inputLen);
      activeSamples += inputLen;
      resamplePos -= inputLen;
    },
  };
}

/** 4 s of a voice-like test signal: a gliding tone with hiss bursts (consonants) and silences. */
function testSignal(rate: number) {
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
  const x = new Float32Array(4 * rate);
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / rate;
    phase += 2 * Math.PI * (220 + 110 * Math.sin(t)) / rate;
    const voiced = t % 1 < 0.6 ? 0.3 * Math.sin(phase) : 0;
    const hiss = t % 0.5 > 0.42 ? 0.2 * rand() : 0;
    x[i] = t > 3.5 ? 0 : voiced + hiss + 0.001 * rand();
  }
  return x;
}

function frames(x: Float32Array, sizes: number[]) {
  const out: Float32Array[] = [];
  for (let off = 0, k = 0; off < x.length; k++) {
    const n = Math.min(sizes[k % sizes.length], x.length - off);
    out.push(x.slice(off, off + n));
    off += n;
  }
  return out;
}

function chunks(make: MakeChunker, rate: number, fr: Float32Array[], resetAt: Set<number>) {
  const out: MicChunk[] = [];
  const c = make({ nativeRate: rate, onChunk: ch => out.push(ch) });
  fr.forEach((f, i) => { if (resetAt.has(i)) c.reset(); c.push(f); });
  return out;
}

describe('createChunker', () => {
  it.each([
    [48000, [480]], [48000, [128]], [44100, [441]], [44100, [128]], [16000, [160]],
    [22050, [1024]], [48000, [7, 480, 333, 1, 2048, 13]],
  ])('gives exactly the chunks of the shifted window (%i Hz, frames of %j)', (rate, sizes) => {
    const fr = frames(testSignal(rate), sizes);
    const resetAt = new Set([Math.floor(fr.length / 3), Math.floor(fr.length / 3) + 1, Math.floor(fr.length * 0.7)]);
    const want = chunks(createShiftChunker, rate, fr, resetAt);
    const got = chunks(createChunker, rate, fr, resetAt);
    expect(got.length).toBe(want.length);
    expect(want.length).toBeGreaterThan(100);
    expect(want.some(c => c.fric)).toBe(true);
    for (let i = 0; i < want.length; i++) {
      expect(got[i].pos).toBe(want[i].pos);
      expect(got[i].volume).toBe(want[i].volume);
      expect(got[i].fric).toBe(want[i].fric);
      // bit for bit
      expect(new Uint32Array(got[i].audio.buffer)).toEqual(new Uint32Array(want[i].audio.buffer));
    }
  });

  it('hands out each chunk in an array of its own', () => {
    const got = chunks(createChunker, 48000, frames(testSignal(48000), [480]), new Set());
    expect(new Set(got.map(c => c.audio.buffer)).size).toBe(got.length);
  });
});

describe('display chunks', () => {
  const FRAME = 480; // 10 ms at 48 kHz
  const signal = (seconds: number) => {
    const x = new Float32Array(seconds * 48000);
    for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / 48000) + 0.1 * Math.sin(i * 1.7 + i * i * 1e-7);
    return x;
  };
  const run = (x: Float32Array, frame: number, display: boolean) => {
    const chunks: MicChunk[] = [], shown: DisplayChunk[] = [];
    const c = createChunker({ nativeRate: 48000, onChunk: k => chunks.push(k), ...(display ? { displaySamples: 768, displayHopSamples: 160, onDisplay: (k: DisplayChunk) => shown.push(k) } : {}) });
    for (let i = 0; i < x.length; i += frame) c.push(x.subarray(i, Math.min(i + frame, x.length)));
    return { chunks, shown };
  };

  it('leave the scored chunks as they are, bit for bit, at any frame size', () => {
    const x = signal(2);
    for (const frame of [128, 480, 441, 960, 1024]) {
      const without = run(x, frame, false).chunks, withThem = run(x, frame, true).chunks;
      expect(withThem.length).toBe(without.length);
      withThem.forEach((k, i) => {
        expect(k.pos).toBe(without[i].pos);
        expect(k.volume).toBe(without[i].volume);
        expect(k.fric).toBe(without[i].fric);
        expect(k.audio).toEqual(without[i].audio);
      });
    }
  });

  it('come with every 10 ms frame, from the first full window on', () => {
    const { chunks, shown } = run(signal(1), FRAME, true);
    expect(shown[0].pos).toBeCloseTo(chunks[0].pos, 3);
    expect(shown.map(k => Math.round(k.pos * 1000))).toEqual(shown.map((_, i) => 60 + 10 * i));
  });

  it('hold the newest samples, the same as a chunk ending there', () => {
    const x = signal(1);
    const { shown } = run(x, FRAME, true);
    const k = shown[5];
    const end = Math.round(k.pos * 16000);
    const reference: MicChunk[] = [];
    // a chunker whose window ends exactly there
    const c = createChunker({ nativeRate: 48000, windowSamples: 768, hopSamples: 1, onChunk: r => reference.push(r) });
    c.push(x.subarray(0, end * 3));
    expect(k.audio.length).toBe(768);
    expect(Array.from(k.audio)).toEqual(Array.from(reference[reference.length - 1].audio));
  });

  it('wait for a full window, also after a pause', () => {
    const shown: DisplayChunk[] = [];
    const c = createMicCapture({ nativeRate: 48000, displaySamples: 768, displayHopSamples: 160, onChunk: () => {}, onDisplay: k => shown.push(k), onLevel: () => {} });
    const x = signal(1);
    for (let i = 0; i < 5 * FRAME; i += FRAME) c.push(x.subarray(i, i + FRAME));
    expect(shown.length).toBe(0); // 50 ms in
    c.setActive(false);
    c.setActive(true);
    for (let i = 0; i < 5 * FRAME; i += FRAME) c.push(x.subarray(i, i + FRAME));
    expect(shown.length).toBe(0);
    for (let i = 0; i < 3 * FRAME; i += FRAME) c.push(x.subarray(i, i + FRAME));
    expect(shown.length).toBeGreaterThan(0);
  });
});

describe('createLagWatch', () => {
  /** Chunks every 30 ms for `seconds`, `lag` ms behind their place in the audio, jittering upwards */
  const feed = (w: ReturnType<typeof createLagWatch>, from: number, seconds: number, lag: number) => {
    for (let t = 0; t < seconds * 1000; t += 30) w.push(from + t + lag + (t % 90), (from + t) / 1000);
  };

  it('sees no growth in a steady path, whatever its jitter', () => {
    const w = createLagWatch();
    feed(w, 1000, 30, 40);
    expect(w.grown()).toBe(0);
  });

  it('sees the step of a path that got longer and stayed', () => {
    const w = createLagWatch();
    feed(w, 1000, 20, 40);
    feed(w, 21000, 20, 161);
    expect(w.grown()).toBe(121);
  });

  it('takes no busy moment for a longer path', () => {
    const w = createLagWatch();
    feed(w, 1000, 20, 40);
    w.push(21000 + 300, 21); // one chunk held up
    feed(w, 21030, 20, 40);
    expect(w.grown()).toBe(0);
  });

  it('starts over after a pause, keeping what it saw', () => {
    const w = createLagWatch();
    feed(w, 1000, 20, 40);
    feed(w, 21000, 10, 90);
    w.restart();
    feed(w, 60000, 20, 2000); // the audio's clock stood still meanwhile
    expect(w.grown()).toBe(50);
  });
});

describe('createFrameAgeMeter', () => {
  it('measures from the timestamp on performance.now\'s clock, the frames\' length beside it', () => {
    const m = createFrameAgeMeter();
    for (let i = 0; i < 100; i++) m.push(1_000_000 + i * 10_000, 10, 1010 + i * 10 + i % 5); // 10-14 ms old
    const age = m.read();
    expect(age).toMatchObject({ n: 100, p50: 12, max: 14, frameMs: 10 });
    expect(age?.p90).toBe(14);
  });

  it('takes a frame stamped a hair ahead of the clock as no age at all', () => {
    const m = createFrameAgeMeter();
    m.push(1_002_000, 10, 1000);
    expect(m.read()).toMatchObject({ n: 1, p50: 0 });
  });

  it('counts nothing a timestamp on another clock says', () => {
    const m = createFrameAgeMeter();
    m.push(9e12, 10, 5000); // time since boot, below Chrome 150
    m.push(0, 10, 5000);    // long before anything
    m.push(5_100_000, 10, 5000); // from the future
    expect(m.read()).toBeNull();
  });
});
