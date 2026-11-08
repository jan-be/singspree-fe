/**
 * Canvas pixels per CSS pixel for a canvas that reaches the screen as a
 * compositor layer of its own (the note highway painted in a worker).
 *
 * The device pixel ratio, unless that canvas would then be larger than the GPU
 * can show as one texture: a worker's canvas goes to the screen as a single
 * texture, and one past the limit is not shown at all. A Fire TV Stick 4K Max
 * (PowerVR, limit 4096) reports a ratio of 4, so its highway, 1248 CSS px
 * wide, asked for 4992 px and stayed black (a canvas painted on the main
 * thread goes into the page's tiles instead, so its size never mattered
 * there). The same stick shows the page at 1.5 px per CSS px, so most of
 * that resolution was never visible either; under load the frame governor
 * caps it further (`cap`, frameGovernor.ts), never below 1.
 */

type ScreenLike = { devicePixelRatio?: number; matchMedia?: (query: string) => { matches: boolean } };
const ratioCache = { dpr: NaN, ratio: 1 };

/**
 * Device pixels per CSS pixel as the screen really has them: devicePixelRatio,
 * unless the CSS `resolution` says much less. Amazon's WebView on a 4K Fire TV
 * says 4 while the app's window is a 1920x1080 buffer that the stick's display
 * hardware scales up to 4K: 960x540 CSS px at 2, and `resolution` there is
 * 2dppx. The highway sized by 4 drew four times the pixels that show
 * (3712x800), and with a singer the stick presented 36 frames a second, many
 * held for 2-3 refreshes; at 2 it presented 57-59 (2026-11-08). A small
 * difference (a desktop's page zoom) is not believed: the ratio stays then.
 */
export function screenRatio(win: ScreenLike = globalThis): number {
  const dpr = win.devicePixelRatio || 1;
  const own = win === globalThis;
  if (own && dpr === ratioCache.dpr) return ratioCache.ratio;
  let ratio = dpr;
  try {
    if (win.matchMedia && !win.matchMedia(`(min-resolution: ${dpr * 0.75}dppx)`).matches) {
      ratio = 1; // (none of the steps: one pixel per CSS pixel)
      for (let r = Math.floor(dpr * 0.75 * 8) / 8; r >= 1; r -= 0.125) {
        if (win.matchMedia(`(min-resolution: ${r}dppx)`).matches) { ratio = r; break; }
      }
    }
  } catch { /* no media queries: the ratio as said */ }
  if (own) { ratioCache.dpr = dpr; ratioCache.ratio = ratio; }
  return ratio;
}

const FALLBACK_MAX = 4096; // what nearly every GPU of the last decade takes; used when WebGL cannot tell
let cachedMax: number | null = null;

/** The largest texture side the GPU takes, asked once of WebGL (4096 when it cannot say). */
export function maxLayerSize(): number {
  if (cachedMax !== null) return cachedMax;
  let size = FALLBACK_MAX;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const max: unknown = gl?.getParameter(gl.MAX_TEXTURE_SIZE);
    if (typeof max === 'number' && Number.isFinite(max) && max >= 1024) size = max;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* no WebGL: the fallback */ }
  cachedMax = size;
  return size;
}

/**
 * Pixels per CSS pixel for a `cssWidth` x `cssHeight` canvas: the device pixel
 * ratio, held to `cap` (but not below 1), and small enough that neither side
 * passes `maxSize` once rounded to whole pixels.
 */
export function layerScale({ dpr, cssWidth, cssHeight, maxSize, cap = Infinity }: { dpr: number; cssWidth: number; cssHeight: number; maxSize: number; cap?: number }) {
  let scale = Math.min(dpr || 1, Math.max(1, cap));
  const largest = Math.max(cssWidth, cssHeight);
  if (largest > 0 && Math.round(largest * scale) > maxSize) scale = maxSize / largest;
  return scale;
}
