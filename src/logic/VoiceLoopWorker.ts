// VoiceLoopWorker.ts — measures each singer's loop on the host's page
// (voiceLoop.ts) off the main thread: a 64k-point correlation per window, a
// few times a minute per singer.
//
// In: { type: 'window', id, x, r } (a singer's stream and the music around it,
// from the guard worklet), { type: 'reset', id } (a new connection: start over).
// Out: { type: 'loop', id, lag, z, coupling, windows, confident } after each window.

import { createLoopEstimator } from './voiceLoop';
import type { LoopEstimator, VoiceLoopRequest, VoiceLoopResponse } from './voiceLoop';

const estimators = new Map<string, LoopEstimator>();

self.onmessage = ({ data }: MessageEvent<VoiceLoopRequest>) => {
  if (data.type === 'reset') { estimators.delete(data.id); return; }
  let est = estimators.get(data.id);
  if (!est) estimators.set(data.id, est = createLoopEstimator());
  const e = est.push(data.x, data.r);
  if (e) self.postMessage({ type: 'loop', id: data.id, ...e } satisfies VoiceLoopResponse);
};
