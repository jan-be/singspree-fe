import { useEffect, useRef, useState } from 'react';

/**
 * The party page's controls come and go like a video player's: a move of the
 * mouse, a key (a TV remote's) or a scroll shows them, and after a few quiet
 * seconds they fade out again, leaving the logo, the QR code (sm up), the
 * stage, the lyrics and a slim progress bar.
 *
 * Nothing here re-renders React: the hook writes `data-ui="idle"` on the
 * page's root element and CSS (index.css, `.ui-fade` / `.ui-bar`) does the
 * rest, so a mouse move costs a timer reset.
 *
 * They stay while:
 * - `hold` is set (the page's own reasons: paused, the queue open, a hint up),
 * - a popover or menu is open anywhere on the page (`.pop`, `aria-expanded`),
 * - the mouse rests on them (`data-ui-keep`), or a key put the focus there,
 * - the timeline or the lyrics band is being dragged (`data-dragging`).
 *
 * A press on a `data-ui-quiet` element (the lyrics band's handle) does not
 * bring them: the band's room would change under the finger.
 *
 * Touch has no hover: a tap anywhere shows them.
 */

/** Quiet time before the controls go (ms) */
export const IDLE_MS = 3000;
/** While something holds them, how often to look again (ms) */
const RECHECK_MS = 1000;

const focusFromKeys = (el: Element) => {
  try { return el.matches(':focus-visible'); } catch { return true; }
};

/** @returns a callback ref for the page's root element */
export function useIdleControls(hold: boolean): (el: HTMLElement | null) => void {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  // Filled in by the effect below; no-ops until the root is there
  const api = useRef({ show: () => {}, arm: () => {} });

  useEffect(() => {
    if (!root) return undefined;
    let shown = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovering = false;
    let lastX = NaN, lastY = NaN;

    const set = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      if (on) delete root.dataset.ui;
      else root.dataset.ui = 'idle';
    };
    const keep = () => {
      if (holdRef.current || hovering) return true;
      if (root.querySelector('.pop, [aria-expanded="true"], [data-dragging]')) return true;
      const active = document.activeElement;
      return !!active && root.contains(active) && !!active.closest('[data-ui-keep]') && focusFromKeys(active);
    };
    const tick = () => {
      if (keep()) { timer = setTimeout(tick, RECHECK_MS); return; }
      timer = undefined;
      set(false);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(tick, IDLE_MS);
    };
    const wake = () => { set(true); arm(); };
    api.current = { show: wake, arm };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // (a finger's moves are scrolls; its taps count below)
      // Chrome sends moves without moving (after a scroll, say): only a real one wakes them
      if (e.screenX === lastX && e.screenY === lastY) return;
      lastX = e.screenX; lastY = e.screenY;
      hovering = e.target instanceof Element && !!e.target.closest('[data-ui-keep]');
      wake();
    };
    const onOut = (e: PointerEvent) => { if (!e.relatedTarget) hovering = false; }; // left the window
    const onActivity = () => wake(); // a key, the wheel
    const onDown = (e: PointerEvent) => { // a press, a finger's too
      if (!(e.target instanceof Element && e.target.closest('[data-ui-quiet]'))) wake();
    };
    const onFocus = (e: FocusEvent) => {
      // The arrows (logic/spatialNav.ts) or Tab reached a control: keep it in sight
      if (e.target instanceof Element && e.target.closest('[data-ui-keep]') && focusFromKeys(e.target)) wake();
    };

    // Capturing, so a control's own handler (which may stop the event) cannot hide it from us,
    // and the controls are up before the arrow keys look for the next one to focus
    const opts = { capture: true, passive: true } as const;
    document.addEventListener('pointermove', onMove, opts);
    document.addEventListener('pointerdown', onDown, opts);
    document.addEventListener('pointerout', onOut, opts);
    document.addEventListener('keydown', onActivity, opts);
    document.addEventListener('wheel', onActivity, opts);
    document.addEventListener('focusin', onFocus, opts);
    arm();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointermove', onMove, opts);
      document.removeEventListener('pointerdown', onDown, opts);
      document.removeEventListener('pointerout', onOut, opts);
      document.removeEventListener('keydown', onActivity, opts);
      document.removeEventListener('wheel', onActivity, opts);
      document.removeEventListener('focusin', onFocus, opts);
      delete root.dataset.ui;
      api.current = { show: () => {}, arm: () => {} };
    };
  }, [root]);

  // Held (paused, say): up at once, like a paused video's. Let go: the full quiet time from now.
  useEffect(() => {
    if (hold) api.current.show();
    else api.current.arm();
  }, [hold]);

  return setRoot;
}
