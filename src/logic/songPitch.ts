// songPitch.ts — a song's pitch tracks: the recording's own pitch every 10 ms,
// which recordingVoice.ts compares a microphone's pitch with to tell the
// speakers from someone singing.
//
// They are made from the song's two stems with the pitch model the microphone
// runs (tools/song-pitch/make_tracks.py, which describes the format, "SPT1"),
// lie at the site that has the stems, and are fetched like a stem: by whoever
// is in a party on the song, with the chart's pass where the chart came from
// another site (sites.ts). A song without tracks answers 404: nothing is told
// apart then, as before there were tracks.

import { apiUrl } from '../GlobalConsts';
import { fetchInParty } from './partyAccess';

/**
 * The pitch model the tracks must come from: the one this page's microphone
 * runs (public/model-2.ort; make_tracks.py MODEL_TAG). Tracks of another model
 * are left alone: its pitch would differ by more cents than the comparison allows.
 */
export const PITCH_MODEL_TAG = 30;

const LOWEST_HZ = 46.875;   // the model's lowest pitch: a track's value 1
const CENTS_PER_STEP = 2;
const LOWEST_CENTS = 1200 * Math.log2(LOWEST_HZ);
const MAX_TRACKS = 4;

/** A song's pitch tracks: per track the pitch in cents (1200 * log2(Hz)) per step from the song's start, NaN where there is none */
export interface SongPitch {
  /** seconds between two values */
  stepS: number;
  /** the vocal stem first, then the instrumental */
  tracks: Float32Array[];
}

/** The bytes of a tracks file (unpacked) as tracks; null for anything else, or for another pitch model's */
export function decodeSongPitch(bytes: ArrayBuffer): SongPitch | null {
  if (bytes.byteLength < 16) return null;
  const view = new DataView(bytes);
  if (view.getUint32(0, false) !== 0x53505431) return null; // "SPT1"
  const stepMs = view.getUint16(4, true);
  const count = view.getUint16(6, true);
  const values = view.getUint32(8, true);
  const tag = view.getUint32(12, true);
  if (tag !== PITCH_MODEL_TAG || stepMs < 1 || stepMs > 100 || count < 1 || count > MAX_TRACKS) return null;
  if (16 + count * values * 2 > bytes.byteLength) return null;
  const tracks: Float32Array[] = [];
  for (let k = 0; k < count; k++) {
    const cents = new Float32Array(values);
    const from = 16 + k * values * 2;
    for (let i = 0; i < values; i++) {
      const v = view.getUint16(from + 2 * i, true);
      cents[i] = v ? LOWEST_CENTS + (v - 1) * CENTS_PER_STEP : NaN;
    }
    tracks.push(cents);
  }
  return { stepS: stepMs / 1000, tracks };
}

/** Where a song's pitch tracks are, with the pass if its chart came with one (as its stems: sites.ts stemUrls) */
export const songPitchUrl = (songId: string, pass: string | null = null): string =>
  `${apiUrl}/songs/${songId}/pitch${pass ? `?pass=${encodeURIComponent(pass)}` : ''}`;

/**
 * A song's pitch tracks, or null: the song has none, they are another model's, or they could not be fetched.
 * Never throws: without tracks the page works as before.
 */
export async function fetchSongPitch(songId: string, pass: string | null = null, fetcher: (url: string) => Promise<Response> = fetchInParty): Promise<SongPitch | null> {
  try {
    // (asked like the chart: a browser whose socket has not reached the party yet is refused a moment long)
    const res = await fetcher(songPitchUrl(songId, pass));
    if (!res.ok) return null;
    return decodeSongPitch(await res.arrayBuffer());
  } catch {
    return null;
  }
}
