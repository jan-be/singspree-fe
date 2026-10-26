// VoiceGuardWorklet.ts — one singer's voice on its way to the host's
// speakers (voiceMixer.ts): a gate, an automatic level with a ceiling, and the
// two signals for measuring its loop (voiceLoop.ts).
//
// Input 0: the singer's stream (high- and low-passed by the mixer). Input 1:
// the music the page plays (its stems), when it has them. Output: the voice.
//
// - Gate: the stream between sung lines is mostly the speakers coming back
//   (the music, the other voices), which would play again a round late. It
//   opens 8 dB above the stream's quiet floor and 6 dB above how loud the
//   music is expected back (the measured coupling), holds 250 ms, and closes
//   to −20 dB (not to silence: a soft singer is not cut to nothing).
// - Level: phones send very different levels (an iPhone's raw microphone is
//   quiet), so the sung parts are brought towards −20 dBFS, by at most 6 dB a
//   second, and never above the ceiling the mixer sets (feedbackCap): down at
//   once when it drops.
// - Measuring (when asked): both inputs band-passed to 300–3400 Hz, at 8 kHz,
//   and every STEP_S the last WINDOW of the stream with the music around it
//   (REF_LEN) go to the page.
//
// Messages in: { type: 'cap', gain } (the level's ceiling), { type: 'coupling',
// value } (null: not measured), { type: 'measure', on }.
// Out: { type: 'level', rms, open, gain } ten times a second, { type: 'window', x, r }.

import { RATE, REF_LEN, STEP_S, WINDOW } from './voiceLoop';
import type { VoiceGuardMessage, VoiceGuardRequest } from './voiceGuard';

const BLOCK_TAU_S = 0.01;     // the level's time constant
const MUSIC_TAU_S = 0.3;
const SPEECH_TAU_S = 2;
const FLOOR_RISE_DB_S = 3;    // the floor follows a louder room this fast
const OPEN_ABOVE_FLOOR_DB = 8;
const OPEN_ABOVE_BLEED_DB = 6;
const MIN_OPEN = 1e-6;        // power: −60 dBFS
const HOLD_S = 0.25;
const RANGE = 0.1;            // closed: −20 dB
const ATTACK_S = 0.003;
const RELEASE_S = 0.12;
const TARGET = 0.01;          // power: −20 dBFS RMS while singing
const LEVEL_MIN = 0.5;
const LEVEL_DB_S = 6;
const REPORTS_PER_S = 10;

const dbPow = (db: number) => 10 ** (db / 10);

/** One RBJ biquad (direct form I) */
function biquad(kind: 'hp' | 'lp', freq: number, rate: number, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * freq / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b = kind === 'lp' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  const b0 = b[0] / a0, b1 = b[1] / a0, b2 = b[2] / a0, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
/** 300–3400 Hz: two high-passes and two low-passes (fourth order each way) */
function band(rate: number) {
  const f = [biquad('hp', 300, rate), biquad('hp', 300, rate), biquad('lp', 3400, rate), biquad('lp', 3400, rate)];
  return (x: number) => f[3](f[2](f[1](f[0](x))));
}

class VoiceGuardWorklet extends AudioWorkletProcessor {
  // gate and level
  env = 0;
  floor = MIN_OPEN;
  music = 0;
  speech = TARGET;
  coupling: number | null = null;
  open = false;
  openUntil = 0;
  gate = RANGE;
  level = 1;
  cap = 1;
  time = 0;
  sinceReport = 0;
  // measuring
  measure = false;
  bandX = band(sampleRate);
  bandR = band(sampleRate);
  phase = 0;
  lastX = 0;
  lastR = 0;
  ringX = new Float32Array(REF_LEN);
  ringR = new Float32Array(REF_LEN);
  at = 0;            // next write position
  filled = 0;
  sincePost = 0;

  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent<VoiceGuardRequest>) => {
      if (data.type === 'cap') {
        this.cap = Math.max(LEVEL_MIN, data.gain);
        if (this.level > this.cap) this.level = this.cap;
      } else if (data.type === 'coupling') this.coupling = data.value;
      else if (data.type === 'measure') {
        this.measure = data.on;
        if (!data.on) { this.filled = 0; this.sincePost = 0; }
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const x = inputs[0]?.[0];
    const r = inputs[1]?.[0];
    const out = outputs[0][0];
    const n = out.length;
    const blockS = n / sampleRate;
    this.time += blockS;
    if (!x) { out.fill(0); return true; }

    // The block's power, and the music's
    let p = 0;
    for (let i = 0; i < n; i++) p += x[i] * x[i];
    p /= n;
    const k = Math.exp(-blockS / BLOCK_TAU_S);
    this.env = this.env * k + p * (1 - k);
    if (r) {
      let pm = 0;
      for (let i = 0; i < n; i++) pm += r[i] * r[i];
      const km = Math.exp(-blockS / MUSIC_TAU_S);
      this.music = this.music * km + (pm / n) * (1 - km);
    }
    // The quiet floor: down at once, up slowly
    this.floor = this.env < this.floor ? Math.max(this.env, 1e-10) : this.floor * dbPow(FLOOR_RISE_DB_S * blockS);
    const bleed = this.coupling != null ? this.coupling * this.coupling * this.music : 0;
    const threshold = Math.max(this.floor * dbPow(OPEN_ABOVE_FLOOR_DB), bleed * dbPow(OPEN_ABOVE_BLEED_DB), MIN_OPEN);
    if (this.env > threshold) { this.open = true; this.openUntil = this.time + HOLD_S; }
    else if (this.time > this.openUntil) this.open = false;

    // The level, while singing: towards the target, a few dB a second, under the ceiling
    if (this.open) {
      const ks = Math.exp(-blockS / SPEECH_TAU_S);
      this.speech = this.speech * ks + this.env * (1 - ks);
      const want = Math.min(this.cap, Math.max(LEVEL_MIN, Math.sqrt(TARGET / Math.max(this.speech, 1e-10))));
      const step = 10 ** (LEVEL_DB_S * blockS / 20);
      this.level = want > this.level ? Math.min(want, this.level * step) : Math.max(want, this.level / step);
    }

    // Out: the gate ramps within the block (attack fast, release slow)
    const target = this.open ? 1 : RANGE;
    const tau = target > this.gate ? ATTACK_S : RELEASE_S;
    const kg = Math.exp(-1 / (tau * sampleRate));
    let g = this.gate;
    const level = this.level;
    for (let i = 0; i < n; i++) {
      g = target + (g - target) * kg;
      out[i] = x[i] * g * level;
    }
    this.gate = g;
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);

    if (this.measure) this.collect(x, r, n);

    this.sinceReport += blockS;
    if (this.sinceReport >= 1 / REPORTS_PER_S) {
      this.sinceReport = 0;
      this.port.postMessage({ type: 'level', rms: Math.sqrt(this.env), open: this.open, gain: this.level } satisfies VoiceGuardMessage);
    }
    return true;
  }

  /** Both inputs band-passed and at 8 kHz into the rings; a window out every STEP_S */
  collect(x: Float32Array, r: Float32Array | undefined, n: number) {
    const step = RATE / sampleRate;
    for (let i = 0; i < n; i++) {
      const bx = this.bandX(x[i]);
      const br = this.bandR(r ? r[i] : 0);
      const before = this.phase;
      this.phase += step;
      if (this.phase >= 1) {
        // linear interpolation at the 8 kHz instant between the last sample and this one
        this.phase -= 1;
        const f = (1 - before) / step;
        this.ringX[this.at] = this.lastX + (bx - this.lastX) * f;
        this.ringR[this.at] = this.lastR + (br - this.lastR) * f;
        this.at = (this.at + 1) % REF_LEN;
        if (this.filled < REF_LEN) this.filled++;
        this.sincePost++;
      }
      this.lastX = bx;
      this.lastR = br;
    }
    if (this.filled < REF_LEN || this.sincePost < STEP_S * RATE) return;
    this.sincePost = 0;
    const rr = new Float32Array(REF_LEN), xx = new Float32Array(WINDOW);
    // oldest first: the ring from `at` on
    rr.set(this.ringR.subarray(this.at));
    rr.set(this.ringR.subarray(0, this.at), REF_LEN - this.at);
    const xs = new Float32Array(REF_LEN);
    xs.set(this.ringX.subarray(this.at));
    xs.set(this.ringX.subarray(0, this.at), REF_LEN - this.at);
    xx.set(xs.subarray(REF_LEN - WINDOW));
    this.port.postMessage({ type: 'window', x: xx, r: rr } satisfies VoiceGuardMessage, [xx.buffer, rr.buffer]);
  }
}

registerProcessor('voice-guard', VoiceGuardWorklet);
