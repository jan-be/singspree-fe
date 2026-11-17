import { describe, it, expect } from 'vitest';
import { createRecordingVoice, RECORDING_VOICE } from './recordingVoice';
import type { SongPitch } from './songPitch';

// A made-up song: a note every half second (0.4 s sung, 0.1 s rest), each with a vibrato, 60 s long.
const STEP = 0.01;
const SECONDS = 60;
const SCALE = [0, 200, 400, 500, 700, 900, 1100, 1200];
const A3 = 1200 * Math.log2(220);

/** A small seeded random source (mulberry32) */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noteAt = (t: number) => Math.floor(t / 0.5);
const sung = (t: number) => t >= 0 && t < SECONDS && t - noteAt(t) * 0.5 < 0.4;
const melody = (t: number) => A3 + SCALE[(noteAt(t) * 3) % SCALE.length];
/** the recording's lead voice at a song time, in cents (NaN in a rest) */
const lead = (t: number) => (sung(t) ? melody(t) + 30 * Math.sin(2 * Math.PI * 5.5 * t) : NaN);

function song(): SongPitch {
  const voice = new Float32Array(Math.round(SECONDS / STEP));
  const band = new Float32Array(voice.length);
  for (let i = 0; i < voice.length; i++) {
    voice[i] = lead(i * STEP);
    band[i] = i % 100 < 30 ? A3 - 2400 + SCALE[Math.floor(i / 100) % SCALE.length] : NaN; // a bass note a second, two octaves down
  }
  return { stepS: STEP, tracks: [voice, band] };
}

const hz = (cents: number) => 2 ** (cents / 1200);
const WINDOWS = Array.from({ length: Math.floor((SECONDS - 1) / 0.03) }, (_, k) => 0.5 + k * 0.03);

/** What a microphone gets of the speakers: the lead voice `lag` late, a few cents off, and every third window something else */
function speakers(t: number, rnd: () => number, lag = 0.07): number {
  const c = lead(t - lag);
  if (Number.isNaN(c)) return 0;
  return hz(rnd() < 0.35 ? c + (rnd() < 0.5 ? -1 : 1) * (60 + 300 * rnd()) : c + 6 * (rnd() - 0.5));
}

/**
 * Someone singing the song: each note a little late, off by their own amount, scooped up to from below, and
 * wandering the way a held voice does (no machine's even vibrato: that can lock onto the recording's).
 */
function singer(seed: number, spread = 90) {
  const rnd = random(seed);
  const notes = Array.from({ length: SECONDS * 2 + 2 }, () => ({ cents: spread * (rnd() - 0.5), late: 0.05 + 0.08 * rnd() }));
  // the wander: a new aim every 70 ms, up to 25 cents either side, glided between
  const aims = Array.from({ length: Math.ceil(SECONDS / 0.07) + 2 }, () => 50 * (rnd() - 0.5));
  const wander = (t: number) => { const x = t / 0.07, i = Math.floor(x); return aims[i] + (aims[i + 1] - aims[i]) * (x - i); };
  return (t: number): number => {
    const o = notes[noteAt(t)];
    const own = t - o.late;
    if (!sung(own) || noteAt(own) !== noteAt(t)) return 0;
    const into = own - noteAt(own) * 0.5;                       // seconds into the note
    const scoop = -80 * Math.max(0, 1 - into / 0.1);            // starts 80 cents flat, there after 100 ms
    return hz(melody(own) + o.cents + scoop + wander(t));
  };
}

describe('createRecordingVoice', () => {
  it('finds the speakers by their lag and takes their pitch away, the detector\'s slips with it', () => {
    const rule = createRecordingVoice(song());
    const rnd = random(1);
    let pitched = 0, dropped = 0, late = 0, lateDropped = 0;
    for (const t of WINDOWS) {
      const f = speakers(t, rnd);
      if (!(f > 0)) continue;
      const d = rule.push(t, f);
      pitched++; if (d) dropped++;
      if (t > 10) { late++; if (d) lateDropped++; }
    }
    const s = rule.state();
    expect(s.found).toBe(true);
    expect(s.lag).toBeCloseTo(0.07, 2);
    expect(s.share).toBeGreaterThan(0.5);
    expect(s.windows).toBe(pitched);
    expect(s.dropped).toBe(dropped);
    expect(lateDropped / late).toBeGreaterThan(0.9); // once found, nearly everything goes: the windows that are not the recording's too
  });

  it('leaves someone singing the song alone', () => {
    for (const seed of [2, 3, 4]) {
      const rule = createRecordingVoice(song());
      const voice = singer(seed);
      for (const t of WINDOWS) rule.push(t, voice(t));
      const s = rule.state();
      expect(s.found).toBe(false);
      expect(s.windows).toBeGreaterThan(1000);
      expect(s.dropped / s.windows).toBeLessThan(0.03); // (a few windows in a minute, where held notes sat on the recording's for a moment)
    }
  });

  it('never matches a voice an octave below the recording', () => {
    const rule = createRecordingVoice(song());
    let dropped = 0;
    // (the recording's very own notes, an octave down: no lag makes them the recording's)
    for (const t of WINDOWS) { const c = lead(t - 0.07); if (!Number.isNaN(c) && rule.push(t, hz(c - 1200))) dropped++; }
    expect(dropped).toBe(0);
    expect(rule.state().found).toBe(false);
    expect(rule.state().share).toBe(0);
  });

  it('over the speakers a singer keeps most of their notes, and the speakers lose theirs', () => {
    const rule = createRecordingVoice(song());
    const rnd = random(5);
    const voice = singer(6, 140); // (someone a little less on the note: this is about whose windows go, not about how close two voices may be)
    const count = { singer: 0, singerDropped: 0, speakers: 0, speakersDropped: 0 };
    for (const t of WINDOWS) {
      const singing = Math.floor(t / 5) % 2 === 1; // five seconds the speakers alone, five with someone singing over them
      const f = singing ? voice(t) || speakers(t, rnd) : speakers(t, rnd);
      const own = singing && voice(t) > 0;
      if (!(f > 0)) continue;
      const d = rule.push(t, f);
      if (t < 15) continue; // (once the speakers are found)
      if (own) { count.singer++; if (d) count.singerDropped++; } else { count.speakers++; if (d) count.speakersDropped++; }
    }
    expect(rule.state().found).toBe(true);
    expect(count.speakersDropped / count.speakers).toBeGreaterThan(0.75);
    // The singer's cost of standing in the speakers' sound: the notes on the recording's own pitch, and those while
    // the balance still says nobody is singing (real singers: 0.2 to 0.5 % of their windows, replayed recordings)
    expect(count.singerDropped / count.singer).toBeLessThan(0.5);
    expect(count.speakersDropped / count.speakers - count.singerDropped / count.singer).toBeGreaterThan(0.35);
  });

  it('decides nothing before it has heard about a second of pitched sound', () => {
    const rule = createRecordingVoice(song());
    const rnd = random(7);
    let pitched = 0;
    for (const t of WINDOWS) {
      const f = speakers(t, rnd);
      if (!(f > 0)) continue;
      const d = rule.push(t, f);
      if (pitched < RECORDING_VOICE.minWindows) expect(d).toBe(false);
      pitched++;
      if (pitched > RECORDING_VOICE.minWindows + 5) break;
    }
  });

  it('takes no notice of windows without a pitch, and survives the song time jumping', () => {
    const rule = createRecordingVoice(song());
    expect(rule.push(1, 0)).toBe(false);
    expect(rule.push(Number.NaN, 220)).toBe(false);
    expect(rule.state().windows).toBe(0);
    const rnd = random(8);
    for (const t of WINDOWS.slice(0, 600)) rule.push(t, speakers(t, rnd));
    expect(rule.state().found).toBe(true);
    // the host rewinds to the start: the speakers are still the speakers
    let dropped = 0, pitched = 0;
    for (const t of WINDOWS.slice(0, 300)) { const f = speakers(t, rnd); if (f > 0) { pitched++; if (rule.push(t, f)) dropped++; } }
    expect(dropped / pitched).toBeGreaterThan(0.8);
  });

  it('follows another setting of its knobs', () => {
    const strict = createRecordingVoice(song(), { on: 0.95, off: 0.9 });
    const rnd = random(9);
    for (const t of WINDOWS) strict.push(t, speakers(t, rnd));
    expect(strict.state().found).toBe(false);
    expect(strict.state().dropped).toBe(0);
  });
});
