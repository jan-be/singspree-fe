import { useLayoutEffect, type RefObject } from 'react';

/**
 * On an upright screen the video (16:9, letterboxed by the player) has black
 * space above and below it, and the note highway sits where the lyrics band
 * leaves it room: a taller band moves the highway up. The video moves with
 * it, its middle level with the highway's, so the notes stay on the picture.
 * Only up, and never off the screen. Landscape: the video fills the height
 * (or nearly), nothing moves.
 */
export const videoShift = (width: number, height: number, highwayMiddle: number): number => {
  if (!(height > width)) return 0;
  const letterbox = Math.max(0, (height - width * 9 / 16) / 2);
  return Math.round(Math.max(-letterbox, Math.min(0, highwayMiddle - height / 2)));
};

/**
 * Keeps `video` (the player's layer, as tall as the page) moved by videoShift.
 * Written straight into its style, so a drag of the lyrics band does not
 * re-render the page. The highway moves when the space around it changes:
 * the free stage above it (`spacer`), its own size, the screen, a scroll of
 * the stage. `highway` is the element itself (state from a ref callback): the
 * stage mounts later than the page for a joiner waiting for the first song.
 */
export const useVideoBesideHighway = (
  video: RefObject<HTMLElement | null>,
  highway: HTMLElement | null,
  spacer: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
) => {
  useLayoutEffect(() => {
    const v = video.current, h = highway;
    if (!v || !h) return undefined;
    let shown = 0;
    const place = () => {
      const page = v.parentElement?.getBoundingClientRect();
      if (!page) return;
      const r = h.getBoundingClientRect();
      const shift = videoShift(page.width, page.height, r.top + r.height / 2 - page.top);
      if (shift === shown) return;
      shown = shift;
      v.style.transform = shift ? `translateY(${shift}px)` : '';
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(h);
    if (spacer.current) ro?.observe(spacer.current);
    const s = scroller.current;
    s?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      ro?.disconnect();
      s?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
      v.style.transform = '';
    };
  }, [video, highway, spacer, scroller]);
};
