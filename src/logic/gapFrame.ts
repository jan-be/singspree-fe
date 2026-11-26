/**
 * A gap carried from one chart to another that plays the same video.
 *
 * Every chart has a base gap, its #GAP plus the video offset (the API's
 * defaultGap, or duetGap for the duet twin). A correction or a drag made on
 * one chart is the distance from that chart's base; carrying the gap keeps
 * the distance, so switching to the duet twin moves it by the same amount on
 * top of the twin's own base rather than handing it the solo chart's number.
 */
export const carryGap = (gap: number | undefined, fromBase: number | undefined, toBase: number | undefined): number | undefined => {
  if (toBase === undefined || !Number.isFinite(toBase)) return gap;
  if (gap === undefined || fromBase === undefined || !Number.isFinite(gap) || !Number.isFinite(fromBase)) return toBase;
  return toBase + (gap - fromBase);
};

/**
 * The lowest gap the timing tools set (ms), the backend's MIN_GAP_MS. A gap
 * below 0 is real: a video that starts after the chart's first beat puts tick
 * 0 before 0:00, and the notes before 0:00 are never reached.
 */
export const MIN_GAP_MS = -600_000;

/** A gap being typed or dragged, kept within what the backend stores */
export const clampGap = (gap: number): number => Math.max(MIN_GAP_MS, gap);
