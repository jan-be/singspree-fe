/**
 * Keeps a phone's screen on in a party while a song plays, and a while after
 * (the score screen, the next song being picked). A playing video kept it on
 * by itself; a joiner who switched the video off had the screen go dark in
 * the middle of a song, and with it the page and the microphone (micStandby.ts
 * closes it in a hidden tab). Screen Wake Lock API (Chrome 84, Safari 16.4,
 * Firefox 126); without it the screen sleeps as before. The Fire TV app keeps
 * its screen on by itself.
 */

/** How long after the music stops the screen stays on (ms) */
export const AWAKE_GRACE_MS = 90_000;
/** After a refusal (battery saver, a frame without the permission), the next try (ms) */
const RETRY_MS = 30_000;

/** Whether the screen should be kept on: a song playing, or one that stopped less than the grace ago. */
export function wantAwake({ playing, idleMs }: { playing: boolean; idleMs: number }): boolean {
  return playing || idleMs < AWAKE_GRACE_MS;
}

interface Sentinel { release(): Promise<void>; addEventListener(type: 'release', fn: () => void): void }
interface WakeLockLike { request(type: 'screen'): Promise<Sentinel> }

/**
 * Follows `playing()` (asked every 2 s and when the tab comes back: the
 * browser lets go of the lock in a hidden tab). Returns the stop function.
 */
export function keepScreenAwake(playing: () => boolean, nav: { wakeLock?: WakeLockLike } = globalThis.navigator as { wakeLock?: WakeLockLike }): () => void {
  const lock = nav?.wakeLock;
  if (!lock || typeof document === 'undefined') return () => {};
  let sentinel: Sentinel | null = null;
  let asking = false;
  let refusedAt = -Infinity;
  let lastPlaying = -Infinity;

  const hold = () => {
    if (sentinel || asking || document.visibilityState !== 'visible' || performance.now() - refusedAt < RETRY_MS) return;
    asking = true;
    lock.request('screen').then(s => {
      sentinel = s;
      s.addEventListener('release', () => { if (sentinel === s) sentinel = null; });
    }, () => { refusedAt = performance.now(); }).finally(() => { asking = false; });
  };
  const release = () => {
    const s = sentinel;
    sentinel = null;
    s?.release().catch(() => { /* already let go */ });
  };
  const check = () => {
    const now = performance.now();
    const on = playing();
    if (on) lastPlaying = now;
    if (wantAwake({ playing: on, idleMs: now - lastPlaying })) hold();
    else release();
  };

  check();
  const id = setInterval(check, 2000);
  document.addEventListener('visibilitychange', check);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', check);
    release();
  };
}
