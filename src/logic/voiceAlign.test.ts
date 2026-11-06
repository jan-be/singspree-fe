import { describe, it, expect } from 'vitest';
import { createVoiceAligner, createSingerDelay, ALIGN_MIN, ALIGN_STEP, ALIGN_COUNT } from './voiceAlign';
import { readTextFile } from './LyricsParser';
import type { AlignChart } from './voiceAlign';

/** A chart of `notes` four-beat notes on alternating tones (a melody), a rest between them, 300 ticks a minute x 4 */
async function chart(notes = 60, gap = 1000, tones = [24, 29, 21]): Promise<AlignChart> {
  const lines = ['#BPM:300', `#GAP:${gap}`];
  for (let i = 0; i < notes; i++) {
    lines.push(`: ${i * 6} 4 ${tones[i % tones.length]} la`);
    if (i % 4 === 3) lines.push(`- ${i * 6 + 5}`);
  }
  lines.push('E');
  return readTextFile(lines.join('\n'));
}

const hz = (tone: number) => 440 * Math.pow(2, (tone - 33) / 12);

/**
 * A singer on the chart, `late` seconds behind it, as the page sees them: a window
 * every 30 ms, stamped when it comes, the pitch of the note sung then (0 between notes).
 */
function* singer(c: AlignChart, late: number, seconds: number, wrong = 0) {
  const tps = c.bpm / 60;
  for (let t = 0; t < seconds; t += 0.03) {
    const sung = t - late;                                   // the song time the singer is at
    const tick = Math.floor(tps * (sung - c.gap / 1000));
    const ref = tick >= 0 ? c.lyricRefs[tick] : undefined;
    const note = ref && !ref.isSilent ? c.lyricLines?.[ref.lineIndex]?.[ref.syllableIndex] : undefined;
    yield { t, freq: note && !note.isBreak ? hz(note.tone + wrong) : 0 };
  }
}

function run(c: AlignChart, late: number, seconds: number, prior: number, wrong = 0) {
  const a = createVoiceAligner();
  let delay = prior;
  for (const w of singer(c, late, seconds, wrong)) if (a.push(c, w.t, w.freq)) delay = a.delay(prior);
  return delay;
}

describe('createVoiceAligner', () => {
  it('finds how late the singer is, whatever delay it starts from', async () => {
    const c = await chart();
    for (const late of [0, 0.06, 0.16, 0.3]) {
      for (const prior of [0.1, 0.25]) {
        const d = run(c, late, 40, prior);
        expect(Math.abs(d - late)).toBeLessThanOrEqual(ALIGN_STEP * 1.5);
      }
    }
  });

  it('stays where it is while nobody sings, and for a voice nowhere near the notes', async () => {
    const c = await chart();
    const a = createVoiceAligner();
    expect(a.delay(0.1)).toBe(0.1);
    for (let t = 0; t < 30; t += 0.03) if (a.push(c, t, 0)) expect(a.delay(0.1)).toBe(0.1);
    // a tritone off a chart of one tone is in tune at no delay at all
    expect(run(await chart(60, 1000, [24]), 0.1, 30, 0.1, 6)).toBe(0.1);
  });

  it('says nothing without a chart, and a new chart starts afresh', async () => {
    const c = await chart(), other = await chart();
    const a = createVoiceAligner();
    expect(a.push(undefined, 1, 220)).toBe(false);
    for (const w of singer(c, 0.3, 40)) a.push(c, w.t, w.freq);
    expect(a.delay(0.1)).toBeGreaterThan(0.2);
    a.push(other, 0, 0);
    expect(a.delay(0.1)).toBe(0.1);
  });

  it('a little evidence moves it a little: a chance hit is not a verdict', async () => {
    const c = await chart();
    const a = createVoiceAligner();
    let some = 0.1;
    for (const w of singer(c, 0.3, 1.45)) if (a.push(c, w.t, w.freq)) some = a.delay(0.1);
    expect(some).toBeGreaterThanOrEqual(0.1);
    expect(some).toBeLessThan(0.3);
  });

  it('follows a singer whose delay moves during the song', async () => {
    const c = await chart(900);
    const a = createVoiceAligner();
    let delay = 0.1, t0 = 0;
    for (const w of singer(c, 0.06, 60)) { t0 = w.t; if (a.push(c, w.t, w.freq)) delay = a.delay(0.1); }
    expect(Math.abs(delay - 0.06)).toBeLessThanOrEqual(ALIGN_STEP * 1.5);
    for (const w of singer(c, 0.26, 200)) if (w.t > t0 && a.push(c, w.t, w.freq)) delay = a.delay(0.1);
    expect(Math.abs(delay - 0.26)).toBeLessThanOrEqual(ALIGN_STEP * 1.5);
  });

  it('covers -100 .. 400 ms', () => {
    expect(ALIGN_MIN + (ALIGN_COUNT - 1) * ALIGN_STEP).toBeCloseTo(0.4, 9);
  });
});

describe('createSingerDelay', () => {
  it('runs the fixed delay, then the bleed, then the singing, which keeps the last word', async () => {
    const c = await chart();
    const p = createSingerDelay({ fallback: 0.1 });
    expect(p.next()).toBeCloseTo(0.1, 9);
    expect(p.state().source).toBe('fixed');
    p.update({ confident: true, delay: 0.2, z: 9, chunks: 3 });
    expect(p.next()).toBeCloseTo(0.2, 9);
    expect(p.state().source).toBe('bleed');
    let d = 0;
    for (const w of singer(c, 0.3, 40)) { p.pushNote(c, w.t, w.freq); d = p.next(); }
    expect(p.state().source).toBe('voice');
    expect(Math.abs(d - 0.3)).toBeLessThanOrEqual(ALIGN_STEP * 1.5);
    // a later measurement of the music no longer moves the notes...
    p.update({ confident: true, delay: 0.05, z: 12, chunks: 9 });
    expect(p.next()).toBeCloseTo(d, 2);
    expect(p.state().z).toBe(12);
  });

  it('goes on with the bleed where the singing says nothing', async () => {
    const c = await chart();
    const p = createSingerDelay({ fallback: 0.1 });
    p.update({ confident: true, delay: 0.2, z: 9, chunks: 3 });
    for (let t = 0; t < 10; t += 0.03) { p.pushNote(c, t, 0); p.next(); }
    expect(p.state().source).toBe('bleed');
    p.update({ confident: true, delay: 0.21, z: 9, chunks: 4 });
    let d = 0;
    for (let i = 0; i < 30; i++) d = p.next();
    expect(d).toBeCloseTo(0.21, 6);
  });

  it('with neither, the fixed delay stays', async () => {
    const c = await chart();
    const p = createSingerDelay({ fallback: 0.1 });
    let d = 0;
    for (let t = 0; t < 10; t += 0.03) { p.pushNote(c, t, 0); d = p.next(); }
    expect(d).toBeCloseTo(0.1, 9);
    expect(p.state().source).toBe('fixed');
  });
});
