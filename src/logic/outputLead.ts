// outputLead.ts — how far ahead of the song's clock the stems play, so that
// what is heard lines up with the picture and the lyrics.
//
// From the AudioContext to the ear there is the context's own buffer
// (baseLatency) and the device after it (outputLatency): ~50 ms on a desktop,
// 250–530 ms on a Fire TV stick that sends its sound to a Bluetooth speaker
// (A2DP), more while its audio runs late under load. Without a lead the music
// came half a second after the picture there. The browser's estimate wobbles,
// so it is followed slowly; when it really moves, the page's sync moves the
// stems with it.
//
// A Fire TV stick says less than it has: its sound leaves later than its
// AudioContext reports (FIRE_TV_UNCOUNTED). Over HDMI on a Fire TV Stick 4K
// Max the context said 291 ms; the same phone, singing to the music it
// heard, was 249 ms behind the stick's cursor and 73 ms behind a PC's five
// minutes later (production, 2026-11-08). MythTV's player needed 150 ms more
// than Fire OS reports on a Fire TV Stick 4K. Short of that, the music came
// after the cursor, the singers sang that much later and their pitch line
// trailed the cursor by it.

const MAX_LEAD = 1;   // s: beyond this the estimate is not believed
const FOLLOW = 0.2;   // share of the difference taken per update (every 0.5 s: a few seconds to follow)
/** s: a Fire TV's sound leaves this much later than its AudioContext says (see above) */
export const FIRE_TV_UNCOUNTED = 0.15;

/** A Fire TV device (Fire OS): its model code in the user agent (AFTKA, AFTMM, AFTSSS, ...), our app's and Silk's alike */
export const isFireTv = (ua: string = globalThis.navigator?.userAgent ?? '') => /;\s*AFT[A-Z0-9]+[\s;)]/.test(ua);

/** The context's own estimate of its latency to the ear, in seconds (0 where the browser gives none). */
export function contextLatency(ctx: { baseLatency?: number; outputLatency?: number } | undefined): number {
  if (!ctx) return 0;
  const v = (Number(ctx.baseLatency) || 0) + (Number(ctx.outputLatency) || 0);
  return Math.min(MAX_LEAD, Math.max(0, v));
}

/**
 * How far ahead the stems should play: the context's estimate, and on a Fire
 * TV what it leaves out. 0 where the browser gives no estimate (no context yet).
 */
export function leadEstimate(ctx: { baseLatency?: number; outputLatency?: number } | undefined, ua?: string): number {
  const v = contextLatency(ctx);
  if (!(v > 0)) return 0;
  return Math.min(MAX_LEAD, v + (isFireTv(ua) ? FIRE_TV_UNCOUNTED : 0));
}

/** The next lead from the last one and a fresh estimate: the first one at once, later ones slowly. */
export function nextLead(prev: number, estimate: number): number {
  if (!(estimate > 0)) return prev;
  if (!(prev > 0)) return estimate;
  return prev + FOLLOW * (estimate - prev);
}
