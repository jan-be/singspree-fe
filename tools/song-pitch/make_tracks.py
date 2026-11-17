"""The recording's own pitch, per song: what the app compares a microphone's pitch with to tell the speakers from a
singer (src/logic/recordingVoice.ts). Two tracks a song, from its two stems, made with the pitch model the
microphone runs (public/model.onnx), a value every 10 ms:

  track 0   the vocal stem        the lead voice, with its own intonation
  track 1   the instrumental stem what the detector makes of the band (and of what the stems' cut left there)

    python tools/song-pitch/make_tracks.py --stems <dir with vocals/ and karaoke/> [--stems <another> ...]
        --out <dir> [--source <dir>] [--ids <file> | <songId> ...] [--jobs 8] [--low] [--model public/model.onnx]

For every song id (all that have both stems, or those named, in the order given) it writes
  <out>/<songId>.spt.gz        what the app fetches (GET /api/songs/:id/pitch): the format below, gzipped
  <source>/vocals|karaoke/<songId>.f32   the model's answer in full: (Hz, confidence) as two float32 per step. The
                               tracks are cut from these (--from-source, minutes for all songs), so another
                               confidence threshold does not mean running the model again. About 190 kB a stem.
A song whose files exist is skipped.

The format ("SPT1"), little-endian:
  0   4 bytes  "SPT1"
  4   uint16   the step in ms (10)
  6   uint16   the number of tracks (2)
  8   uint32   values per track
  12  uint32   the pitch model's tag (MODEL_TAG): a page that does not know it leaves the tracks alone
  16  tracks, one after the other: uint16 per step. 0: no pitch (the model was not sure, CONFIDENCE and up counts).
      Otherwise the pitch in steps of 2 cents above 46.875 Hz, plus 1:  Hz = 46.875 * 2 ** ((v - 1) / 600).
Value i is the pitch of the 80 ms of the stem that end at i * 10 ms: the same window, and the same convention, as a
microphone window ending there (the window is brought to the voice level first, as levelCalibration.ts does for a
microphone; a window below 0.001 is silence).
"""
import argparse
import gzip
import os
import struct
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RATE = 16000
STEP = 160            # 10 ms
MODEL_SAMPLES = 1280  # pitchModel.ts MODEL_SAMPLES
WINDOW_SAMPLES = 960  # pitchModel.ts WINDOW_SAMPLES: the level is taken over these
VOICE_TARGET = 0.15   # levelCalibration.ts
MAX_GAIN = 30
SILENCE = 0.001
CONFIDENCE = 0.85     # pitchModel.ts CONFIDENCE_THRESHOLD
MIN_HZ, MAX_HZ = 46.875, 2093.75
MODEL_TAG = 30        # swift-f0 0.3.0 as tools/ort-minimal/make_model.py wraps it
STEMS = (('vocals', 'vocals'), ('karaoke', 'karaoke'))  # track order: the vocal stem, the instrumental

_session = None


def session(model):
    global _session
    if _session is None:
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = 1
        so.inter_op_num_threads = 1
        so.log_severity_level = 3
        _session = ort.InferenceSession(model, so, providers=['CPUExecutionProvider'])
    return _session


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True)
    if raw.returncode != 0:
        raise RuntimeError(f'ffmpeg {path}: {raw.stderr.decode(errors="replace")[:200]}')
    return np.frombuffer(raw.stdout, np.float32)


def model_answer(x, sess):
    """(Hz, confidence) per 10 ms of a stem: the model's newest frame for the 80 ms ending at each step"""
    rows = len(x) // STEP
    out = np.zeros((rows, 2), np.float32)
    # the level of the 60 ms before each step, from running sums
    sq = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
    first = -(-MODEL_SAMPLES // STEP)
    ends = np.arange(first, rows) * STEP
    rms = np.sqrt((sq[ends] - sq[ends - WINDOW_SAMPLES]) / WINDOW_SAMPLES)
    buf = np.empty((1, MODEL_SAMPLES), np.float32)
    for i, end, level in zip(range(first, rows), ends, rms):
        if level < SILENCE:
            continue
        gain = np.float32(min(MAX_GAIN, max(1.0, VOICE_TARGET / level)))
        np.multiply(x[end - MODEL_SAMPLES:end], gain, out=buf[0])
        hz, conf = sess.run(None, {'input_audio': buf})
        out[i, 0] = hz[0, -1]
        out[i, 1] = conf[0, -1]
    return out


def track(answer):
    """the model's answer as the format's uint16 per step"""
    hz, conf = answer[:, 0].astype(np.float64), answer[:, 1]
    sure = (conf >= CONFIDENCE) & (hz >= MIN_HZ) & (hz <= MAX_HZ)
    v = np.zeros(len(hz), '<u2')
    v[sure] = 1 + np.rint(600 * np.log2(hz[sure] / MIN_HZ)).astype(np.int64)
    return v


def pack(tracks):
    n = min(len(t) for t in tracks)
    head = b'SPT1' + struct.pack('<HHII', STEP * 1000 // RATE, len(tracks), n, MODEL_TAG)
    return head + b''.join(t[:n].astype('<u2').tobytes() for t in tracks)


def stem_file(stems, kind, song):
    for d in stems:
        f = os.path.join(d, kind, song + '.opus')
        if os.path.exists(f):
            return f
    return None


def one(job):
    song, a = job
    out = os.path.join(a['out'], song + '.spt.gz')
    if os.path.exists(out):
        return song, 'there', 0.0
    t0 = time.time()
    try:
        answers = []
        for kind, folder in STEMS:
            src = os.path.join(a['source'], folder, song + '.f32') if a['source'] else None
            if src and os.path.exists(src):
                answers.append(np.fromfile(src, np.float32).reshape(-1, 2))
                continue
            if a['from_source']:
                return song, 'no source', 0.0
            f = stem_file(a['stems'], kind, song)
            if not f:
                return song, f'no {kind} stem', 0.0
            ans = model_answer(decode(f), session(a['model']))
            if src:
                os.makedirs(os.path.dirname(src), exist_ok=True)
                tmp = src + f'.{os.getpid()}.tmp'
                ans.tofile(tmp)
                os.replace(tmp, src)
            answers.append(ans)
        data = gzip.compress(pack([track(x) for x in answers]), 6, mtime=0)
        tmp = out + f'.{os.getpid()}.tmp'
        with open(tmp, 'wb') as f:
            f.write(data)
        os.replace(tmp, out)
        return song, f'{len(data) / 1024:.0f} kB', time.time() - t0
    except Exception as e:  # one bad stem does not stop the run
        return song, f'failed: {str(e)[:120]}', time.time() - t0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('songs', nargs='*')
    ap.add_argument('--stems', action='append', required=True, help='a folder with vocals/ and karaoke/ (several: the first that has the song)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--source', help='where the model\'s full answers are kept')
    ap.add_argument('--from-source', action='store_true', help='only cut tracks from the answers kept (no model run)')
    ap.add_argument('--ids', help='a file of song ids, one a line: these, in this order')
    ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--low', action='store_true', help='run below normal priority (Windows): a long run that leaves the machine usable')
    ap.add_argument('--model', default=os.path.join(HERE, '..', '..', 'public', 'model.onnx'))
    a = ap.parse_args()
    if a.low and os.name == 'nt':
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)  # BELOW_NORMAL: the workers inherit it
    songs = list(a.songs)
    if a.ids:
        songs += [l.strip() for l in open(a.ids, encoding='utf-8') if l.strip()]
    if not songs:
        def have(kind):
            sets = [{f[:-5] for f in os.listdir(os.path.join(d, kind)) if f.endswith('.opus')} for d in a.stems if os.path.isdir(os.path.join(d, kind))]
            return set().union(*sets) if sets else set()
        songs = sorted(have('vocals') & have('karaoke'))
    seen = set()
    songs = [s for s in songs if not (s in seen or seen.add(s))]
    os.makedirs(a.out, exist_ok=True)
    args = {'stems': a.stems, 'out': a.out, 'source': a.source, 'from_source': a.from_source, 'model': os.path.abspath(a.model)}
    done = made = 0
    t0 = time.time()
    with Pool(a.jobs) as pool:
        for song, what, seconds in pool.imap_unordered(one, [(s, args) for s in songs], chunksize=1):
            done += 1
            if seconds or what.startswith(('no ', 'failed')):
                made += bool(seconds and not what.startswith('failed'))
                print(f'{done}/{len(songs)} {song} {what} {seconds:.0f} s  ({(time.time() - t0) / 60:.0f} min)', flush=True)
    print(f'done: {made} made, {len(songs)} asked for, {(time.time() - t0) / 60:.1f} min', flush=True)


if __name__ == '__main__':
    main()
