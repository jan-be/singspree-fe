/**
 * When in the frame the note highway builds its picture.
 *
 * The highway's canvas belongs to a worker (highwayRenderer.ts), and a worker's
 * canvas only goes to the compositor at a BeginFrame, the browser's "a new
 * frame starts" signal: what the worker draws between two of them waits for
 * the next one. The page's animation frame runs just after that same signal,
 * so a frame built there reaches the worker just too late (by half a
 * millisecond, seen in Chrome's trace) and waits a whole frame, on every
 * frame, on every screen: two frames from the draw to the display where one
 * would do. The animation frame cannot run earlier. So the picture is built
 * later instead, a few milliseconds before the next BeginFrame, with a timer
 * set from the animation frame: the same frame on the display, a frame's
 * worth of newer notes in it.
 *
 * When the timer comes too late (a busy page, a coarse timer on battery
 * power) the next animation frame paints what was waiting at once, so every
 * animation frame still gets exactly one paint, in order. But a picture that
 * misses the signal is a frame the display shows twice, and the next one
 * overtakes it: the highway stutters, where on the animation frame it would
 * only have been a frame older. So misses are counted, from the timer and from
 * the worker's own clock (drawn), and a page that misses more than the odd
 * one goes back to the animation frame for a while, for longer each time the
 * next try goes no better. A page that does not keep up (the governor stepped
 * in), a picture that takes long to build (a Fire TV stick: its animation
 * frames run late enough to make the signal as they are, and its main thread
 * has no slack to move work around in), a hidden tab and painting on the main
 * thread (whose frame goes out with the page's and so has no such wait) paint
 * at once, as before.
 */

/**
 * How long before the next BeginFrame the picture is due, on top of what
 * building it takes: the timer's slack (it is good to a millisecond) and the
 * hand-over to the worker with its draw. Too little and frames miss the signal,
 * at a frame's cost each; on this PC 3 ms loses 1-5 % of frames.
 */
export const LEAD_MS = 3;
/** The share of a frame the lead may take: past it there is little left to win. */
export const MAX_LEAD_SHARE = 0.6;
/** A picture that takes longer than this to build stays on the animation frame. */
export const MAX_COST_MS = 2;
/**
 * One miss is forgiven per this many paints in time: 6 %. A healthy page loses
 * 1-3 % to chance, in clusters, and a limit close to that keeps throwing the
 * gain away.
 */
const FORGIVEN_PER = 16;
/** How many misses not forgiven yet send it back to the animation frame. */
export const MISS_LIMIT = 6;
/** How many of them the next try may have after that. */
export const SECOND_CHANCES = 2;
/** The frames it stays there, doubling up to the second number while the next try goes no better. */
export const REST_FRAMES = 120;
const MAX_REST_FRAMES = 1920;
/** A frame this much longer or shorter than the usual one is no steady rate. */
const TOLERANCE = 0.2;
/** How many frames at a new length until that is the rate (a display or a browser changed it). */
const NEW_RATE_FRAMES = 4;

/** What createFramePacer uses of the page: a test brings its own clock and timers. */
export interface FramePacerClock<T> {
  now(): number;
  setTimer(run: () => void, ms: number): T;
  clearTimer(timer: T): void;
}

export interface FramePacer {
  /**
   * One animation frame. `at`: its time (the rAF's timestamp), `late`: whether
   * this paint may wait for its moment. Whatever still waits from the frame
   * before is painted now.
   */
  frame(at: number, late: boolean): void;
  /** The worker finished the last paint at `at` (on the page's clock): in time for the signal, or a miss. */
  drawn(at: number): void;
  /** How far past the animation frame the paint under way is built, in ms: the cursor goes along. 0 for one painted at once. */
  readonly ahead: number;
  /** The usual frame length, in ms (0 before it is known). */
  readonly frameMs: number;
  /** The share of the paints since the last ask that came at their moment, for ?debug. */
  takeLateShare(): number;
  /** Forget what waits (the painter is going away). */
  cancel(): void;
}

/** `paint` is called once per animation frame, at its moment. */
export function createFramePacer<T>(paint: () => void, clock: FramePacerClock<T>, leadMs = LEAD_MS): FramePacer {
  let timer: T | null = null; // the paint waiting for its moment
  let plannedAhead = 0;
  let ahead = 0;
  let last = NaN; // the animation frame before
  let frameMs = 0;
  let odd = 0; // frames in a row off the usual length
  let cost = 0; // how long a paint usually takes, in ms (one that a stall caught says little)
  let paints = 0;
  let onTime = 0; // of them, at their moment
  let plannedDue = NaN;
  let due = NaN; // when the signal comes that the paint under way is meant for
  let debt = 0; // misses not forgiven yet
  let rest = 0; // frames left to stay on the animation frame
  let restFor = REST_FRAMES; // how long the next rest is

  const missed = () => {
    if (++debt < MISS_LIMIT) return;
    rest = restFor;
    restFor = Math.min(restFor * 2, MAX_REST_FRAMES);
    debt = MISS_LIMIT - SECOND_CHANCES;
  };
  const inTime = () => {
    debt = Math.max(0, debt - 1 / FORGIVEN_PER);
    if (debt === 0) restFor = REST_FRAMES;
  };

  const run = (lead: number) => {
    timer = null;
    ahead = lead;
    paints++;
    if (lead > 0) onTime++;
    due = lead > 0 ? plannedDue : NaN;
    const t0 = clock.now();
    paint();
    const took = clock.now() - t0;
    cost += (took - cost) / 8;
    ahead = 0;
  };

  // The rate, from the frames' own times. Steady: this frame was as long as the usual one
  const steady = (dt: number) => {
    if (!(dt > 0)) return false;
    if (frameMs > 0 && Math.abs(dt - frameMs) <= frameMs * TOLERANCE) {
      frameMs += (dt - frameMs) / 8;
      odd = 0;
      return true;
    }
    if (++odd >= NEW_RATE_FRAMES || frameMs === 0) {
      frameMs = dt;
      odd = 0;
    }
    return false;
  };

  return {
    frame(at, late) {
      const dt = at - last;
      last = at;
      const onRate = steady(dt);
      if (timer !== null) {
        // its moment passed: it goes out now, on this frame, as if it had never waited
        clock.clearTimer(timer);
        missed();
        run(0);
      }
      if (rest > 0) rest--;
      const lead = leadMs + cost;
      const wait = at + frameMs - lead - clock.now();
      if (!late || !onRate || rest > 0 || cost > MAX_COST_MS || lead > frameMs * MAX_LEAD_SHARE || wait < 1) {
        run(0);
        return;
      }
      plannedAhead = frameMs - lead;
      plannedDue = at + frameMs;
      timer = clock.setTimer(() => run(plannedAhead), wait);
    },
    drawn(at) {
      if (Number.isNaN(due)) return;
      if (at > due) missed();
      else inTime();
      due = NaN;
    },
    get ahead() { return ahead; },
    get frameMs() { return frameMs; },
    takeLateShare() {
      const share = paints ? onTime / paints : 0;
      paints = onTime = 0;
      return share;
    },
    cancel() {
      if (timer !== null) clock.clearTimer(timer);
      timer = null;
    },
  };
}
