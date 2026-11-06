/**
 * Whether the host's page keeps up with its frames, for the server (party:pace).
 *
 * The server hands the big screen each note as it is scored, up to 100 messages
 * a second instead of 20. A message is a task on the main thread, and on a page
 * that is already starved they only queue there: on an emulated stick with eight
 * singers (10 frames a second) the median stayed, and the worst notes came twice
 * as late, with frames waiting behind the messages. So a page under SLOW_FPS for
 * SLOW_SECONDS in a row asks for the 50 ms flush, and asks back at OK_FPS.
 *
 * Counted per second like the frame governor, for the same reason: a starved
 * page shows bursts of quick frames between stalls, so the count says it and
 * the median interval does not. The governor's own levels are no use here: they
 * step down at 40 frames a second to save pixels, where a real stick (40-50) is
 * fine with the messages.
 */
const SLOW_FPS = 30;
const OK_FPS = 40;
const SLOW_SECONDS = 3;
const OK_SECONDS = 5;
const STALL_MS = 2500; // a gap this long is a stopped song or a tab asleep, not a frame rate

export interface PageSpeed {
  /** the page asks for the flush now */
  readonly slow: boolean;
  /** once per animation frame */
  frame(now: number): void;
}

/** `onChange`: the page went from keeping up to not, or back */
export function createPageSpeed(onChange: (slow: boolean) => void): PageSpeed {
  let slow = false;
  let windowStart: number | null = null;
  let frames = 0;
  let run = 0; // seconds in a row on the other side of the line

  return {
    get slow() { return slow; },
    frame(now) {
      if (windowStart === null) { windowStart = now; return; }
      frames++;
      const elapsed = now - windowStart;
      if (elapsed < 1000) return;
      const fps = (frames * 1000) / elapsed;
      windowStart = now;
      frames = 0;
      if (elapsed > STALL_MS) { run = 0; return; }
      run = (slow ? fps >= OK_FPS : fps < SLOW_FPS) ? run + 1 : 0;
      if (run < (slow ? OK_SECONDS : SLOW_SECONDS)) return;
      run = 0;
      slow = !slow;
      onChange(slow);
    },
  };
}
