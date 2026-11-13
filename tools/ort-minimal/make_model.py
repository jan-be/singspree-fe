"""swift-f0 0.3.0 (upstream's second network, Sept 2026) → public/model.onnx, the model the pitch worker runs.

    python tools/ort-minimal/make_model.py <swift_f0 0.3.0's model.onnx> [--check <16 kHz float32 .f32 audio>]

Upstream's model (in the PyPI wheel swift_f0-0.3.0, swift_f0/model.onnx, sha256 6385e8c2ebc3872e…) is made for whole
files: it judges a frame from the frames after it as much as from those before, and gives the newest frames of a
window no confidence. Live there are no frames after, so this wraps it for one window at a time:

  input_audio [1, n]   the newest n samples at 16 kHz (the worker sends 1280: 80 ms)
     → the newest 512 samples appended once more, backwards: a stand-in for the future the model wants
     → upstream's network, its range fixed to all it knows (46.875 to 2093.75 Hz; its fmin/fmax inputs)
     → the three frames that end two frames before the made-up end: the newest centred 256 samples (16 ms)
       behind the newest real sample, the other two 16 and 32 ms before it
  pitch_hz [1, 3], confidence [1, 3]   oldest first, as the first network gave them for a 960-sample window

and changes two things inside it:
  - its pitch is decoded in float32, not float64 (one Cast and one table): a minimal runtime then needs no double
    kernels; the pitch moves by under 0.01 cents;
  - a frame whose 256 samples all stay below 0.001 gets no confidence (upstream's package does this outside the
    model; on digital silence the network says 0.99);
  - its confidence is mapped onto the first network's scale, which everything after the model was tuned on (the
    voicing tracker's 0.85/0.95/0.98, the level calibration's 0.95, the provisional pitch): each of the first
    network's thresholds lands on the new confidence that lets through the same share of windows without a voice,
    measured on 110 real takes (claude-generated/night-1113/pitch/fitmap.py). Piecewise linear, monotone.

The ops it adds (Slice, Concat, Unsqueeze, Sub, Mul, Clip, ReduceSum, Reshape, ReduceMax, GreaterOrEqual, Cast) are
ones the network has already. The input should be a multiple of 256 samples for the silence rule to see exactly the
kept frames' samples (1280 is).
"""
import argparse
import hashlib
import pathlib
import sys

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'public' / 'model.onnx'
UPSTREAM_SHA256 = '6385e8c2ebc3872e'  # first 16 hex digits of swift_f0 0.3.0's model.onnx
FMIN, FMAX = 46.875, 2093.75
MIRROR = 512          # samples appended backwards
FRAMES_FROM_END = 2   # frames after the newest one kept: the made-up future
KEEP = 3              # frames kept
SILENCE_PEAK = 0.001  # upstream's: a frame whose samples all stay below this has no confidence
# the new confidence → the first network's, through these [new, old] points (and (0,0), (1,1))
CONFIDENCE_MAP = [(0.039, 0.2), (0.234, 0.5), (0.601, 0.85), (0.761, 0.95), (0.848, 0.98)]


def const(name, values, dtype):
    return numpy_helper.from_array(np.asarray(values, dtype=dtype), name)


def wrap(model: onnx.ModelProto) -> onnx.ModelProto:
    g = model.graph
    assert [i.name for i in g.input] == ['audio', 'fmin', 'fmax'], [i.name for i in g.input]
    assert [o.name for o in g.output] == ['pitch', 'confidence'], [o.name for o in g.output]

    # 1. the pitch decode in float32: drop the Cast to double, the double table becomes float
    casts = [n for n in g.node if n.op_type == 'Cast' and n.attribute[0].i == TensorProto.DOUBLE]
    assert len(casts) == 1, len(casts)
    cast = casts[0]
    for n in g.node:
        for k, x in enumerate(n.input):
            if x == cast.output[0]: n.input[k] = cast.input[0]
    g.node.remove(cast)
    for k, init in enumerate(g.initializer):
        if init.data_type == TensorProto.DOUBLE:
            g.initializer[k].CopyFrom(numpy_helper.from_array(numpy_helper.to_array(init).astype(np.float32), init.name))
    del g.value_info[:]  # their types named the double tensors; the runtime infers them again

    # 2. the range fixed: fmin and fmax become constants
    del g.input[1:]
    g.initializer.extend([const('fmin', FMIN, np.float32), const('fmax', FMAX, np.float32)])

    # 3. the window and its mirrored newest samples in front of the network
    g.input[0].name = 'input_audio'
    for n in g.node:
        for k, x in enumerate(n.input):
            if x == 'audio': n.input[k] = 'audio_ext'
    g.initializer.extend([
        const('mirror_starts', [-1], np.int64), const('mirror_ends', [-(MIRROR + 1)], np.int64),
        const('axis1', [1], np.int64), const('step_back', [-1], np.int64),
        const('keep_starts', [-(FRAMES_FROM_END + KEEP)], np.int64), const('keep_ends', [-FRAMES_FROM_END], np.int64),
    ])
    front = [
        helper.make_node('Slice', ['input_audio', 'mirror_starts', 'mirror_ends', 'axis1', 'step_back'], ['mirror'], name='mirror_newest'),
        helper.make_node('Concat', ['input_audio', 'mirror'], ['audio_ext'], axis=1, name='append_mirror'),
    ]

    # 4. the frames kept, and the confidence on the first network's scale:
    #    sum_i dy_i * clip((c - x_i) / (x_{i+1} - x_i), 0, 1) over the map's segments
    xs = np.array([0.0] + [p[0] for p in CONFIDENCE_MAP] + [1.0]); ys = np.array([0.0] + [p[1] for p in CONFIDENCE_MAP] + [1.0])
    assert np.all(np.diff(xs) > 0) and np.all(np.diff(ys) > 0)
    g.initializer.extend([
        const('map_x', xs[:-1], np.float32), const('map_inv_w', 1 / np.diff(xs), np.float32), const('map_dy', np.diff(ys), np.float32),
        const('zero', 0.0, np.float32), const('one', 1.0, np.float32), const('last_axis', [-1], np.int64),
        const('tail_starts', [-256 * KEEP], np.int64), const('tail_ends', [2 ** 62], np.int64),
        const('tail_shape', [-1, KEEP, 256], np.int64), const('tail_zeros', np.zeros((1, 256 * KEEP)), np.float32), const('silence_sq', SILENCE_PEAK ** 2, np.float32),
    ])
    for o in g.output: o.name = o.name + '_all'
    for n in g.node:
        for k, x in enumerate(n.output):
            if x in ('pitch', 'confidence'): n.output[k] = x + '_all'
    back = [
        helper.make_node('Slice', ['pitch_all', 'keep_starts', 'keep_ends', 'axis1'], ['pitch_hz'], name='keep_pitch'),
        helper.make_node('Slice', ['confidence_all', 'keep_starts', 'keep_ends', 'axis1'], ['conf_new'], name='keep_conf'),
        helper.make_node('Unsqueeze', ['conf_new', 'last_axis'], ['conf_u'], name='map_unsqueeze'),
        helper.make_node('Sub', ['conf_u', 'map_x'], ['map_d'], name='map_sub'),
        helper.make_node('Mul', ['map_d', 'map_inv_w'], ['map_t'], name='map_scale'),
        helper.make_node('Clip', ['map_t', 'zero', 'one'], ['map_c'], name='map_clip'),
        helper.make_node('Mul', ['map_c', 'map_dy'], ['map_s'], name='map_weigh'),
        helper.make_node('ReduceSum', ['map_s', 'last_axis'], ['conf_mapped'], keepdims=0, name='map_sum'),
        # silence: no confidence where the frame's own 256 samples peak below SILENCE_PEAK (upstream's package does
        # this outside the model); the kept frames' samples are the input's newest 768
        helper.make_node('Concat', ['tail_zeros', 'input_audio'], ['padded'], axis=1, name='silence_pad'),  # any length
        helper.make_node('Slice', ['padded', 'tail_starts', 'tail_ends', 'axis1'], ['tail'], name='silence_tail'),
        helper.make_node('Reshape', ['tail', 'tail_shape'], ['tail_hops'], name='silence_hops'),
        helper.make_node('Mul', ['tail_hops', 'tail_hops'], ['tail_sq'], name='silence_square'),
        helper.make_node('ReduceMax', ['tail_sq', 'last_axis'], ['tail_peak'], keepdims=0, name='silence_peak'),
        helper.make_node('GreaterOrEqual', ['tail_peak', 'silence_sq'], ['sounding'], name='silence_test'),
        helper.make_node('Cast', ['sounding'], ['sounding_f'], to=TensorProto.FLOAT, name='silence_cast'),
        helper.make_node('Mul', ['conf_mapped', 'sounding_f'], ['confidence'], name='silence_mask'),
    ]
    nodes = front + list(g.node) + back
    del g.node[:]
    g.node.extend(nodes)
    del g.output[:]
    g.output.extend([
        helper.make_tensor_value_info('pitch_hz', TensorProto.FLOAT, [1, 'frames']),  # KEEP, fewer on inputs under 1280
        helper.make_tensor_value_info('confidence', TensorProto.FLOAT, [1, 'frames']),
    ])
    model.doc_string = ('swift-f0 0.3.0 (github.com/lars76/swift-f0, MIT) wrapped for live windows by '
                        'singspree-fe tools/ort-minimal/make_model.py: newest 512 samples mirrored after the input, '
                        'frames -5..-3 of that, float32 decode, confidence on the 0.1.x scale')
    onnx.checker.check_model(model, full_check=True)
    return model


def check(upstream_path, wrapped, audio_path):
    """The wrapped model against upstream's run by hand on the same windows."""
    import onnxruntime as ort
    so = ort.SessionOptions(); so.intra_op_num_threads = 1; so.log_severity_level = 3
    up = ort.InferenceSession(str(upstream_path), so, providers=['CPUExecutionProvider'])
    wr = ort.InferenceSession(wrapped.SerializeToString(), so, providers=['CPUExecutionProvider'])
    x = np.fromfile(audio_path, np.float32)
    xs = np.array([0.0] + [p[0] for p in CONFIDENCE_MAP] + [1.0]); ys = np.array([0.0] + [p[1] for p in CONFIDENCE_MAP] + [1.0])
    worst_c = worst_p = 0.0; voiced = 0; n = 0
    for end in range(16000 * 5, min(len(x), 16000 * 65), 4800):
        w = x[end - 1280:end][None]
        ext = np.concatenate([w, w[:, :-MIRROR - 1:-1]], 1)
        p, c = up.run(None, {'audio': ext, 'fmin': np.asarray(FMIN, np.float32), 'fmax': np.asarray(FMAX, np.float32)})
        p, c = p[0][-5:-2], np.interp(c[0][-5:-2], xs, ys) * (np.abs(w[0, -768:]).reshape(3, 256).max(1) >= SILENCE_PEAK)
        q, d = wr.run(None, {'input_audio': w})
        worst_c = max(worst_c, float(np.abs(d[0] - c).max()))
        ok = c >= 0.5
        if ok.any(): worst_p = max(worst_p, float(np.abs(1200 * np.log2(q[0][ok] / p[ok])).max()))
        voiced += int(ok.sum()); n += 3
    print(f'checked {n} frames ({voiced} voiced): confidence off by at most {worst_c:.2e}, pitch by {worst_p:.4f} cents')
    assert worst_c < 1e-4 and worst_p < 0.05 and voiced > n // 10


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('upstream', type=pathlib.Path, help="swift_f0 0.3.0's model.onnx")
    ap.add_argument('--check', type=pathlib.Path, help='16 kHz mono float32 audio (raw .f32) to compare the two on')
    ap.add_argument('--out', type=pathlib.Path, default=OUT)
    args = ap.parse_args()
    sha = hashlib.sha256(args.upstream.read_bytes()).hexdigest()
    if not sha.startswith(UPSTREAM_SHA256):
        sys.exit(f'{args.upstream} is not swift_f0 0.3.0 (sha256 {sha[:16]}…, want {UPSTREAM_SHA256}…)')
    wrapped = wrap(onnx.load(str(args.upstream)))
    if args.check: check(args.upstream, wrapped, args.check)
    onnx.save(wrapped, str(args.out))
    print(f'{args.out}: {args.out.stat().st_size} bytes')


if __name__ == '__main__':
    main()
