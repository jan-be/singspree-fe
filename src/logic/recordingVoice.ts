// recordingVoice.ts — tells the recording, coming out of the speakers, from
// someone singing.
//
// The pitch detector hears any voice, and since the second network it hears a
// quiet one as well as a loud one. A microphone nobody sings into therefore
// heard the song's own singer out of the speakers, who is of course in tune:
// of 108 real microphones that had been idle through a song, 13 scored 500
// points or more, some several thousand (production, November 2026).
//
// A speaker's sound in a microphone is a copy of the recording, late by its
// way through the air. So its pitch is the recording's pitch, to the cent and
// at one fixed lag: about half of such a microphone's pitched windows are
// within 15 cents of what the same pitch model hears in the song's vocal stem
// or its instrumental at that moment (songPitch.ts has those tracks), and half
// as many 100 ms beside it. Someone singing follows the same melody with
// their own timing, intonation and vibrato: at most a quarter of their
// windows match, and as many at any lag (the matches are held notes); sung an
// octave apart, none do. The share at the best lag, and how far it stands
// above the lags beside it, tell the two apart.
//
// Two tracks, because the detector does not always hear the lead voice: where
// the band or a second voice is louder, or the host has turned the vocals
// down, a speaker's pitch is the instrumental's. With the vocal stem alone the
// weakest songs matched 19 % of the time, and a quarter of all songs are
// played with the vocals turned down.
//
// While the recording is found in the microphone:
//   - a window whose pitch is the recording's at that lag loses its pitch;
//   - a window that is not the recording's stays if someone is singing and
//     goes if nobody is. The recording's own windows miss the tracks half the
//     time (the room, the detector's slips), so "not the recording's" alone
//     proves no singer. Whether someone is singing is a running balance: a
//     matching window adds to "nobody", any other takes from it, within
//     bounds, so that a singer who starts is heard after a few windows.
//
// Measured on replayed recordings, this module on the tracks as served
// (claude-generated/pitch-1116, GATE.md):
//   - only the speakers playing, made up from 16 songs' stems: 3,200 points
//     down to 115; with the vocals at 30 %: 1,230 to 245; vocals off: 635 to 313;
//   - six real microphones that heard the speakers: 515 to 7,298 points down
//     to 11 to 789 (one 2,973); the other idle ones (voices in the room that
//     are not the recording's) are left as they are;
//   - 261 real singers' recordings: 249 within 50 points, 7 lose 200 or more.
//     In six of the seven looked at, the song itself is 19 to 53 % of the
//     microphone's sound (7 % is ordinary): the speakers had earned those
//     points. Someone who sings quietly next to loud speakers gets points for
//     what the microphone hears of them.

import type { SongPitch } from './songPitch';

export const RECORDING_VOICE = {
  cents: 15,       // a window is the recording's within this
  tauS: 20,        // s: how fast the tallies of the lags fade
  on: 0.30,        // the recording is found from this share at the best lag ...
  off: 0.20,       // ... until it falls below this
  sharp: 0.10,     // and the best lag stands this far above the lags 80 to 120 ms beside it (half of it to stay found)
  minWindows: 30,  // tallied pitched windows before anything is decided (about a second of pitched sound)
  lagFromS: -0.10, // lags tried, from ... to, in the tracks' steps: a speaker's sound is late by the air, the
  lagToS: 0.60,    // sound card and a wireless speaker; a joiner's song clock may also be a little ahead
  hopS: 0.03,      // s between two windows
  // the balance of "nobody is singing": up for a window that is the recording's, down for one that is not
  up: 1.0,
  down: 0.6,
  top: 4,          // its bounds: top ... -top
  nobody: 1.5,     // from this balance on every pitched window goes
};
export type RecordingVoiceOptions = Partial<typeof RECORDING_VOICE>;

/** What the rule holds (the debug panel, a song report) */
export interface RecordingVoiceState {
  /** the recording is in this microphone */
  found: boolean;
  /** the lag it arrives with (s), and the share of pitched windows that are its at that lag */
  lag: number;
  share: number;
  /** pitched windows seen, and how many of them lost their pitch */
  windows: number;
  dropped: number;
}

/** The rule for one microphone and one song (createRecordingVoice) */
export interface RecordingVoice {
  /** A pitched window: its song time (s) and pitch (Hz). true: this is the recording, not someone singing. */
  push(t: number, freq: number): boolean;
  state(): RecordingVoiceState;
}

const BESIDE_FROM_S = 0.08;
const BESIDE_TO_S = 0.12;

export function createRecordingVoice(pitch: SongPitch, options: RecordingVoiceOptions = {}): RecordingVoice {
  const o = { ...RECORDING_VOICE, ...options };
  const { stepS, tracks } = pitch;
  const lags: number[] = [];
  for (let l = o.lagFromS; l <= o.lagToS + 1e-9; l += stepS) lags.push(l);
  const n = lags.length;
  // the lags 80 to 120 ms either side of a lag, as index offsets
  const besideFrom = Math.round(BESIDE_FROM_S / stepS), besideTo = Math.round(BESIDE_TO_S / stepS);
  const tally = new Float64Array(n); // per lag: faded count of windows that were the recording's there
  const same = new Uint8Array(n);
  let seen = 0;                      // faded count of pitched windows
  let last = NaN, found = false, best = 0, share = 0, balance = 0, windows = 0, dropped = 0;

  return {
    push(t, freq) {
      if (!(freq > 0) || !Number.isFinite(t)) return false;
      windows++;
      const cents = 1200 * Math.log2(freq);
      for (let k = 0; k < n; k++) {
        const j = Math.round((t - lags[k]) / stepS);
        let hit = 0;
        if (j >= 0) for (const track of tracks) if (j < track.length && Math.abs(cents - track[j]) < o.cents) { hit = 1; break; } // (NaN compares false)
        same[k] = hit;
      }
      // decide with what was known before this window, then learn from it
      let drop = false;
      if (seen >= o.minWindows) {
        best = 0;
        for (let k = 1; k < n; k++) if (tally[k] > tally[best]) best = k;
        share = tally[best] / seen;
        let edge = 0;
        for (let d = besideFrom; d <= besideTo; d++) {
          if (best - d >= 0 && tally[best - d] > edge) edge = tally[best - d];
          if (best + d < n && tally[best + d] > edge) edge = tally[best + d];
        }
        const above = share - edge / seen;
        found = found ? share >= o.off && above >= o.sharp / 2 : share >= o.on && above >= o.sharp;
        if (found) {
          const its = same[best] === 1 || same[Math.max(0, best - 1)] === 1 || same[Math.min(n - 1, best + 1)] === 1;
          drop = its || balance >= o.nobody;
          balance = Math.max(-o.top, Math.min(o.top, balance + (its ? o.up : -o.down)));
        } else balance = 0;
      }
      // (a rewind or a seek: the song time jumps; the tallies fade as for a pause of that length, at most 5 s)
      const dt = Number.isNaN(last) ? 0 : Math.max(0, Math.min(5, Math.abs(t - last)));
      last = t;
      const fade = Math.exp(-Math.max(dt, o.hopS) / o.tauS);
      for (let k = 0; k < n; k++) tally[k] = tally[k] * fade + same[k];
      seen = seen * fade + 1;
      if (drop) dropped++;
      return drop;
    },
    state: () => ({ found, lag: Math.round(lags[best] * 1000) / 1000, share: Math.round(share * 100) / 100, windows, dropped }),
  };
}
