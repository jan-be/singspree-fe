import { describe, it, expect, beforeEach, vi, assert } from 'vitest';
import { servePitchRequests } from './pitchWorkerCore';
import type { PitchRuntime } from './pitchWorkerCore';
import type { PitchWorkerRequest, PitchWorkerResponse } from './pitchModel';

type Scope = { onmessage: ((e: { data: PitchWorkerRequest }) => Promise<void>) | null, postMessage: (m: PitchWorkerResponse) => void };

let scope: Scope;
let posted: PitchWorkerResponse[];
let inputs: Float32Array[];

/** A runtime whose model answers every input with `frames` and notes what it was given */
const fakeRuntime = (hz: number[], conf: number[]): PitchRuntime<Float32Array> => ({
  InferenceSession: {
    create: async () => ({
      run: async ({ input_audio }) => {
        inputs.push(input_audio);
        return { pitch_hz: { data: hz }, confidence: { data: conf } };
      },
    }),
  },
  Tensor: class { constructor(_type: 'float32', data: Float32Array) { return data; } } as unknown as PitchRuntime<Float32Array>['Tensor'],
});

const send = async (data: PitchWorkerRequest) => {
  assert(scope.onmessage);
  await scope.onmessage({ data });
};
const detect = (samples: number, extra = {}): PitchWorkerRequest => ({ type: 'detect', audio: new Float32Array(samples).map((_, i) => i), volume: 0.1, t: 1, pos: 1, ...extra });

beforeEach(() => {
  posted = [];
  inputs = [];
  scope = { onmessage: null, postMessage: m => { posted.push(m); } };
  vi.stubGlobal('self', scope);
});

describe('servePitchRequests', () => {
  it('runs the whole window unless told otherwise', async () => {
    servePitchRequests(fakeRuntime([220, 220, 220], [0.99, 0.99, 0.99]), 'test');
    await send({ type: 'init', modelUrl: 'x' });
    await send(detect(960));
    expect(inputs[0].length).toBe(960);
  });

  it('runs the newest samples of a window when told how many', async () => {
    servePitchRequests(fakeRuntime([220, 220, 220], [0.99, 0.99, 0.99]), 'test');
    await send({ type: 'init', modelUrl: 'x', samples: 832 });
    await send(detect(960));
    expect(inputs[0].length).toBe(832);
    expect(inputs[0][831]).toBe(959);
  });

  it('answers a display window with the model alone: the voicing tracker never hears of it', async () => {
    servePitchRequests(fakeRuntime([220, 220, 220], [0.99, 0.99, 0.99]), 'test');
    await send({ type: 'init', modelUrl: 'x' });
    await send(detect(768, { display: 1 }));
    const answer = posted[posted.length - 1];
    assert(answer.type === 'detect');
    expect(answer.pitchHz).toBe(0);
    expect(answer.rawHz).toBe(220);
    expect(answer.rawConf).toBe(0.99);
  });

  it('lets a display window through whole next to shorter scored ones', async () => {
    servePitchRequests(fakeRuntime([220, 220, 220], [0.99, 0.99, 0.99]), 'test');
    await send({ type: 'init', modelUrl: 'x', samples: 832 });
    await send(detect(500, { display: 1 }));
    expect(inputs[0].length).toBe(500);
  });
});
