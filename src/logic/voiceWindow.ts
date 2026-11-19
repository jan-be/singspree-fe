/**
 * The voice filter's window (VoiceFilter, backend voiceRange.ts): the songs
 * whose average pitch (the median of the melody) lies between two pitches,
 * MIDI note numbers (60 = C4). In the address as ?voice=55-62, a side left empty is open ("55-",
 * "-62"). The slider runs from C3 to C5; a thumb at its end leaves that side
 * open, so the songs past it (a few, mostly falsetto) are found there too.
 */

export interface VoiceWindow {
  min: number | null;
  max: number | null;
}

export const VOICE_MIN = 48;  // C3
export const VOICE_MAX = 72;  // C5

const MIDI = /^\d{1,3}$/;

/** ?voice= → a window, or null for none (or anything that is not one) */
export function readVoiceWindow(value: string | null): VoiceWindow | null {
  if (!value) return null;
  const [a, b, ...rest] = value.split('-');
  if (rest.length || b === undefined || (a && !MIDI.test(a)) || (b && !MIDI.test(b))) return null;
  const min = a ? Math.min(127, Number(a)) : null;
  const max = b ? Math.min(127, Number(b)) : null;
  if (min === null && max === null) return null;
  return min !== null && max !== null && min > max ? { min: max, max: min } : { min, max };
}

/** A window for ?voice= */
export const writeVoiceWindow = (w: VoiceWindow) => `${w.min ?? ''}-${w.max ?? ''}`;

/** The slider's thumbs → its window (a thumb at an end: that side open; both: no window) */
export function windowOf(lo: number, hi: number): VoiceWindow | null {
  const min = lo <= VOICE_MIN ? null : lo;
  const max = hi >= VOICE_MAX ? null : hi;
  return min === null && max === null ? null : { min, max };
}

/** A window → where the slider's thumbs go (kept on the slider) */
export function endsOf(w: VoiceWindow | null): [number, number] {
  const clamp = (v: number) => Math.min(VOICE_MAX, Math.max(VOICE_MIN, v));
  const lo = w?.min == null ? VOICE_MIN : clamp(w.min);
  const hi = w?.max == null ? VOICE_MAX : clamp(w.max);
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

export const sameWindow = (a: VoiceWindow | null, b: VoiceWindow | null) =>
  (a?.min ?? null) === (b?.min ?? null) && (a?.max ?? null) === (b?.max ?? null) && Boolean(a) === Boolean(b);

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Where B natural is H (and B the flat below it) */
const H_LANGS = new Set(['de', 'pl', 'sv']);

/** A MIDI note's name: C4 for 60 (H for B where that is how it is written) */
export function noteName(midi: number, lang = 'en'): string {
  const name = SHARPS[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name === 'B' && H_LANGS.has(lang.slice(0, 2)) ? 'H' : name}${octave}`;
}
