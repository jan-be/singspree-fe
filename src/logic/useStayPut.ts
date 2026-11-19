import { useEffect, useRef } from 'react';

/** The element's nearest ancestor that scrolls (overflow auto or scroll), else its page */
function scrollerOf(el: HTMLElement): Element {
  const view = el.ownerDocument.defaultView ?? window;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = view.getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return el.ownerDocument.scrollingElement ?? el.ownerDocument.documentElement;
}

/**
 * A list with "add songs" under it (the party's queue, a playlist): while
 * someone is adding (their last click or focus was in the add part), the add
 * part stays where it is on screen when the list above it grows or shrinks,
 * so the row under the pointer after an add is the row that was there, not
 * the one above it. Someone looking at the list sees it change in place.
 *
 * Returns the refs for the list (whose height changes) and the add part. In
 * whatever document they are in (the queue's own window too).
 */
export function useStayPut<L extends HTMLElement = HTMLElement, A extends HTMLElement = HTMLElement>() {
  const listRef = useRef<L>(null);
  const addRef = useRef<A>(null);
  useEffect(() => {
    const list = listRef.current, add = addRef.current;
    if (!list || !add) return undefined;
    const doc = add.ownerDocument;
    const scroller = scrollerOf(add);
    const scrollEvents: EventTarget = scroller === doc.scrollingElement ? (doc.defaultView ?? doc) : scroller;
    let adding = false;
    let top = add.getBoundingClientRect().top;
    const remember = () => { top = add.getBoundingClientRect().top; };
    const onUse = (e: Event) => { adding = add.contains(e.target as Node | null); };
    // (after layout, before paint: the move is never seen. A move the browser undid itself, scrolling to keep what
    // is in view, is none)
    const resized = new (doc.defaultView ?? window).ResizeObserver(() => {
      const moved = add.getBoundingClientRect().top - top;
      if (adding && moved) scroller.scrollTop += moved;
      remember();
    });
    resized.observe(list);
    scrollEvents.addEventListener('scroll', remember, { passive: true });
    doc.addEventListener('pointerdown', onUse, true);
    doc.addEventListener('focusin', onUse, true);
    return () => {
      resized.disconnect();
      scrollEvents.removeEventListener('scroll', remember);
      doc.removeEventListener('pointerdown', onUse, true);
      doc.removeEventListener('focusin', onUse, true);
    };
  }, []);
  return { listRef, addRef };
}
