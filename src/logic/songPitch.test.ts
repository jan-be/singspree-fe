import { describe, it, expect } from 'vitest';
import { decodeSongPitch, fetchSongPitch, songPitchUrl, PITCH_MODEL_TAG } from './songPitch';

/** A tracks file as tools/song-pitch/make_tracks.py packs it */
function pack(tracks: number[][], { magic = 'SPT1', stepMs = 10, tag = PITCH_MODEL_TAG, count = tracks.length, values = tracks[0]?.length ?? 0 } = {}): ArrayBuffer {
  const bytes = new ArrayBuffer(16 + tracks.reduce((n, t) => n + t.length * 2, 0));
  const view = new DataView(bytes);
  for (let i = 0; i < 4; i++) view.setUint8(i, magic.charCodeAt(i));
  view.setUint16(4, stepMs, true);
  view.setUint16(6, count, true);
  view.setUint32(8, values, true);
  view.setUint32(12, tag, true);
  let at = 16;
  for (const t of tracks) for (const v of t) { view.setUint16(at, v, true); at += 2; }
  return bytes;
}

/** Hz as the file holds it: steps of 2 cents above 46.875 Hz, plus 1 */
const value = (hz: number) => 1 + Math.round(600 * Math.log2(hz / 46.875));

describe('decodeSongPitch', () => {
  it('reads the tracks as cents, a value every 10 ms, NaN where there is no pitch', () => {
    const pitch = decodeSongPitch(pack([[0, value(220), value(440)], [value(110), 0, 0]]));
    expect(pitch).not.toBeNull();
    expect(pitch!.stepS).toBe(0.01);
    expect(pitch!.tracks).toHaveLength(2);
    const [voice, band] = pitch!.tracks;
    expect(Number.isNaN(voice[0])).toBe(true);
    expect(Math.abs(voice[1] - 1200 * Math.log2(220))).toBeLessThanOrEqual(1);  // (the file's steps are 2 cents)
    expect(voice[2] - voice[1]).toBe(1200);
    expect(Math.abs(band[0] - 1200 * Math.log2(110))).toBeLessThanOrEqual(1);
    expect(Number.isNaN(band[1])).toBe(true);
  });

  it('the lowest value is the model\'s lowest pitch', () => {
    const pitch = decodeSongPitch(pack([[1, 2]]));
    expect(pitch!.tracks[0][0]).toBeCloseTo(1200 * Math.log2(46.875), 3);
    expect(pitch!.tracks[0][1] - pitch!.tracks[0][0]).toBeCloseTo(2, 3);
  });

  it('leaves alone what is not a tracks file, is cut short, or comes from another pitch model', () => {
    expect(decodeSongPitch(new ArrayBuffer(4))).toBeNull();
    expect(decodeSongPitch(pack([[1, 2, 3]], { magic: 'OggS' }))).toBeNull();
    expect(decodeSongPitch(pack([[1, 2, 3]], { tag: PITCH_MODEL_TAG + 1 }))).toBeNull();
    expect(decodeSongPitch(pack([[1, 2, 3]], { values: 4 }))).toBeNull();     // says more values than it has
    expect(decodeSongPitch(pack([[1, 2, 3]], { count: 2 }))).toBeNull();      // says two tracks, has one
    expect(decodeSongPitch(pack([[1, 2, 3]], { count: 9 }))).toBeNull();
    expect(decodeSongPitch(pack([[1, 2, 3]], { stepMs: 0 }))).toBeNull();
  });
});

describe('fetchSongPitch', () => {
  const answer = (status: number, body: ArrayBuffer | null = null) => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => body ?? new ArrayBuffer(0) }) as Response;

  it('asks where the stems are, with the chart\'s pass if there is one', async () => {
    expect(songPitchUrl('abc')).toMatch(/\/songs\/abc\/pitch$/);
    expect(songPitchUrl('abc', 'p.q-r')).toMatch(/\/songs\/abc\/pitch\?pass=p\.q-r$/);
    const asked: string[] = [];
    const pitch = await fetchSongPitch('abc', 'p1', async (url) => { asked.push(url); return answer(200, pack([[value(220)]])); });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/\/songs\/abc\/pitch\?pass=p1$/);
    expect(pitch!.tracks[0]).toHaveLength(1);
  });

  it('is null, never an error, for a song without tracks, a refusal or a broken line', async () => {
    expect(await fetchSongPitch('abc', null, async () => answer(404))).toBeNull();
    expect(await fetchSongPitch('abc', null, async () => answer(403))).toBeNull();
    expect(await fetchSongPitch('abc', null, async () => { throw new Error('offline'); })).toBeNull();
    expect(await fetchSongPitch('abc', null, async () => answer(200, new ArrayBuffer(3)))).toBeNull();
  });
});
