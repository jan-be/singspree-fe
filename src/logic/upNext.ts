/** How long before a song's end the next queued song is shown (QueueUpNext), s */
export const UP_NEXT_SECONDS = 15;

/**
 * Where the song ends for the party, s: the video's end, or, where the host's
 * page skips intros and outros, the start of a skipped stretch that runs to
 * the end (an outro: skipping it ends the video). 0 while the length is unknown.
 */
export function songEndAt(duration: number, skipped: readonly { start: number; end: number }[]): number {
  if (!(duration > 0)) return 0;
  let end = duration;
  // latest first, so an outro that follows another skipped stretch takes both
  for (const s of [...skipped].sort((a, b) => b.end - a.end)) {
    if (s.end >= end - 1 && s.start < end) end = Math.max(0, s.start);
  }
  return end;
}

/** Whether the next song is shown at this time of the song (s), the song ending at `endAt` (songEndAt) */
export const upNextDue = (sec: number, endAt: number): boolean =>
  endAt > UP_NEXT_SECONDS && sec > 0 && endAt - sec <= UP_NEXT_SECONDS;
