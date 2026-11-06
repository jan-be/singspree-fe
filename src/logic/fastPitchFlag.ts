// fastPitchFlag.ts — three opt-in changes to how the singer's microphone is read,
// to try on real devices. The choices live in localStorage so they survive the
// join → party navigation; `?x=0` turns one off again.
//
// `?fastpitch=1`: the highway's provisional pitch (provisionalPitch.ts).
//
// `?earlycontext=1`: where the mic is read by an AudioWorklet (Safari), start
// the AudioContext before getUserMedia. WebKit sets the capture's chunk size
// when capture starts, 1024 frames unless a page has started an AudioContext
// by then, 128 frames after; its read position stays three chunks behind, so
// that could be 50-70 ms. From reading WebKit's source: never measured on a
// device, and a context that starts before the mic may be taken over by the
// audio session's change when capture starts, hence the switch.
//
// `?shortwindow=1`: the scored stream's windows hold 832 samples instead of
// 960 (SHORT_WINDOW_SAMPLES), so each pitch is 8 ms newer, on every screen.
// Unlike the two above this one touches what is scored, see pitchModel.ts.

const FAST_KEY = 'singspree_fast_pitch';
const EARLY_KEY = 'singspree_early_context';
const SHORT_KEY = 'singspree_short_window';

const syncOne = (param: string, key: string) => {
  try {
    const v = new URLSearchParams(window.location.search).get(param);
    if (v === null) return;
    if (v === '0' || v === 'false' || v === 'off') localStorage.removeItem(key);
    else localStorage.setItem(key, '1');
  } catch { /* */ }
};

/** Call once at startup: ?fastpitch=, ?earlycontext= and ?shortwindow= update the stored choices. */
export function syncMicFlagsFromUrl(): void {
  syncOne('fastpitch', FAST_KEY);
  syncOne('earlycontext', EARLY_KEY);
  syncOne('shortwindow', SHORT_KEY);
}

export function isFastPitchEnabled(): boolean {
  try { return localStorage.getItem(FAST_KEY) === '1'; } catch { return false; }
}

export function isEarlyContextEnabled(): boolean {
  try { return localStorage.getItem(EARLY_KEY) === '1'; } catch { return false; }
}

export function isShortWindowEnabled(): boolean {
  try { return localStorage.getItem(SHORT_KEY) === '1'; } catch { return false; }
}
