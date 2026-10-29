/**
 * The arrow keys move the focus to the nearest control on the screen in their
 * direction, as on youtube.com/tv: a TV remote's D-pad sends them, and its OK
 * (Enter) presses whatever has the focus. Without this a TV browser reaches
 * the page's controls only with its own pointer, where it has one.
 *
 * "Nearest" is Android's own D-pad rule (FocusFinder), made for exactly this:
 * a control in line with the focused one beats one beside the line, then
 * 13 × the distance along the way² + the distance across it² decides. So
 * left/right stay in a row of cards and up/down in a column. Going back the
 * way one came returns to the control one came from, not whichever of a row
 * is nearest.
 *
 * What the arrows leave alone: a key a control already used (a list that
 * moves its own selection, a slider), the caret inside text, Shift/Alt/Ctrl
 * combinations. Up/down with nothing near in that direction scroll the page
 * as before, so long text still reads with the arrows.
 *
 * Only what can be seen counts: a control under a popover or behind a dialog
 * is skipped, one off the screen or scrolled away in a row is fine (it is
 * scrolled into view), one cut off by a collapsed panel is not. A box fixed
 * on the screen (the entry page's footer links) comes after the page: down
 * goes through all the songs first, not to the footer right away. A sticky
 * band counts where it sits in the page (see stuckBands).
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Box { left: number; top: number; right: number; bottom: number }

const DIRECTIONS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

const across = (dir: Direction) => dir === 'left' || dir === 'right';

/** Whether `to` lies `dir` of `from`: it may overlap it, but must reach further that way. */
export function isCandidate(from: Box, to: Box, dir: Direction) {
  switch (dir) {
    case 'left': return (from.right > to.right || from.left >= to.right) && from.left > to.left;
    case 'right': return (from.left < to.left || from.right <= to.left) && from.right < to.right;
    case 'up': return (from.bottom > to.bottom || from.top >= to.bottom) && from.top > to.top;
    case 'down': return (from.top < to.top || from.bottom <= to.top) && from.bottom < to.bottom;
  }
}

// In line: the two overlap across the way (a row going left/right, a column going up/down)
const inLine = (dir: Direction, from: Box, to: Box) =>
  across(dir) ? to.bottom > from.top && to.top < from.bottom : to.right > from.left && to.left < from.right;

// Wholly beyond `from`'s edge that way
function beyond(dir: Direction, from: Box, to: Box) {
  switch (dir) {
    case 'left': return from.left >= to.right;
    case 'right': return from.right <= to.left;
    case 'up': return from.top >= to.bottom;
    case 'down': return from.bottom <= to.top;
  }
}

// Along the way: to the near edge (0 when they overlap), and to the far edge
function gap(dir: Direction, from: Box, to: Box) {
  const d = dir === 'left' ? from.left - to.right : dir === 'right' ? to.left - from.right : dir === 'up' ? from.top - to.bottom : to.top - from.bottom;
  return Math.max(0, d);
}
function gapToFarEdge(dir: Direction, from: Box, to: Box) {
  const d = dir === 'left' ? from.left - to.left : dir === 'right' ? to.right - from.right : dir === 'up' ? from.top - to.top : to.bottom - from.bottom;
  return Math.max(1, d);
}

// Across the way: between the centres, or for a control within the span of
// a wider one, from its start (down from the search box: the first chip, not
// the middle one)
function offset(dir: Direction, from: Box, to: Box) {
  const [a0, a1, b0, b1] = across(dir) ? [from.top, from.bottom, to.top, to.bottom] : [from.left, from.right, to.left, to.right];
  const mid = (b0 + b1) / 2;
  if (mid >= a0 && mid <= a1 && b1 - b0 < a1 - a0) return Math.abs(b0 - a0);
  return Math.abs((a0 + a1) / 2 - mid);
}

// `a` wins for being in line where `b` is not (going up/down, unless `b` is
// nearer than `a` ends: a control just below is not skipped for a far one in line)
function lineBeats(dir: Direction, from: Box, a: Box, b: Box) {
  if (inLine(dir, from, b) || !inLine(dir, from, a)) return false;
  if (!beyond(dir, from, b) || across(dir)) return true;
  return gap(dir, from, a) < gapToFarEdge(dir, from, b);
}

const weight = (dir: Direction, from: Box, to: Box) => {
  const along = gap(dir, from, to), aside = offset(dir, from, to);
  return 13 * along * along + aside * aside;
};

/** Whether `a` is a better next stop than `b` going `dir` from `from` (both candidates). */
export function beats(dir: Direction, from: Box, a: Box, b: Box) {
  if (lineBeats(dir, from, a, b)) return true;
  if (lineBeats(dir, from, b, a)) return false;
  return weight(dir, from, a) < weight(dir, from, b);
}

/** The best of `items` going `dir` from `from` that `accept` takes, or null. */
export function pick<T extends { box: Box }>(from: Box, dir: Direction, items: T[], accept: (item: T) => boolean = () => true): T | null {
  let rest = items.filter(i => isCandidate(from, i.box, dir));
  while (rest.length) {
    let best = rest[0];
    for (const i of rest) if (beats(dir, from, i.box, best.box)) best = i;
    if (accept(best)) return best;
    rest = rest.filter(i => i !== best);
  }
  return null;
}

// ── On the page ──────────────────────────────────────────────────────

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]';
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/** A control: what of it one sees, where that is on the screen, and where it counts as being */
type Spot = { el: HTMLElement; seen: Element; rect: Box; box: Box };

// A sticky band stuck to the screen's edge, and how far that is from its place in the page
type Stuck = { band: Element; dx: number; dy: number };

const toBox = (r: DOMRect | Box): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
const moved = (b: Box, dx: number, dy: number): Box => ({ left: b.left + dx, top: b.top + dy, right: b.right + dx, bottom: b.bottom + dy });

function focusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.tabIndex < 0) return false;
  if ((el as HTMLButtonElement).disabled || el.closest('[inert], fieldset:disabled')) return false;
  return !(el instanceof HTMLInputElement && el.type === 'hidden');
}

// What one sees of a control: a hidden radio or checkbox shows as its label
function shownAs(el: HTMLElement): Element {
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return el.closest('label') ?? el.labels?.[0] ?? el;
  }
  return el;
}

/**
 * Sticky bands stuck to the screen's edge (the entry page's search band once
 * the page is scrolled): the arrows count them at their place in the page,
 * between what comes before and after them, not wherever on the screen they
 * float — up from a card among the songs goes to the card above it, and to
 * the band from the first row. Measured by unsticking each for a moment (the
 * page's sticky boxes are Tailwind's .sticky).
 */
function stuckBands(): Stuck[] {
  const out: Stuck[] = [];
  for (const band of document.querySelectorAll<HTMLElement>('.sticky')) {
    if (getComputedStyle(band).position !== 'sticky') continue;
    const now = band.getBoundingClientRect();
    const was = band.style.position;
    band.style.position = 'static';
    const home = band.getBoundingClientRect();
    band.style.position = was;
    const dx = home.left - now.left, dy = home.top - now.top;
    if (dx || dy) out.push({ band, dx, dy });
  }
  return out;
}

function spot(el: HTMLElement, stuck: Stuck[] = []): Spot | null {
  const seen = shownAs(el);
  const r = seen.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return null;
  const rect = toBox(r);
  const band = stuck.find(b => b.band.contains(el));
  return { el, seen, rect, box: band ? moved(rect, band.dx, band.dy) : rect };
}

const viewport = (): Box => ({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });

const cut = (a: Box, b: Box): Box => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
const empty = (b: Box) => b.right <= b.left || b.bottom <= b.top;

// The fixed box (a bar on the screen's edge, a popover) a control is in, if any
function fixedBox(el: Element) {
  for (let p: Element | null = el; p && p !== document.documentElement; p = p.parentElement) {
    if (getComputedStyle(p).position === 'fixed') return p;
  }
  return null;
}

// Inside a band pinned across the screen's top or bottom edge (the stuck search band, a fixed footer)
function inBand(el: Element) {
  const vw = window.innerWidth, vh = window.innerHeight;
  for (let p: Element | null = el; p && p !== document.documentElement; p = p.parentElement) {
    const position = getComputedStyle(p).position;
    if (position !== 'fixed' && position !== 'sticky') continue;
    const r = p.getBoundingClientRect();
    if (r.width >= vw * 0.6 && r.height < vh * 0.4 && (r.top <= 1 || r.bottom >= vh - 1)) return true;
  }
  return false;
}

/**
 * Whether a control can be seen, or scrolled to: not hidden, not cut off by a
 * box that does not scroll, and where it is on the screen, not all covered by
 * something else (a popover, a dialog's backdrop; under a band along the
 * screen's edge it is fine, scrolling brings it out). `pinned`: it is fixed
 * or sticky, so scrolling the page does not move it; `fixed`: its fixed box.
 */
function look(s: Spot): { ok: boolean; pinned: boolean; fixed: Element | null } {
  const { seen } = s;
  const no = { ok: false, pinned: false, fixed: null };
  if (typeof seen.checkVisibility === 'function') {
    if (!seen.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })) return no;
  } else if (getComputedStyle(seen).visibility === 'hidden') return no;

  let visible = cut(s.rect, viewport());
  let pinned = false, fixed: Element | null = null;
  for (let p: Element | null = seen; p && p !== document.documentElement; p = p.parentElement) {
    const style = getComputedStyle(p);
    if (style.position === 'fixed') { fixed ??= p; pinned = true; }
    else if (style.position === 'sticky') pinned = true;
    if (p === seen || p === document.body || (style.overflowX === 'visible' && style.overflowY === 'visible')) continue;
    const clip = toBox(p.getBoundingClientRect());
    const scrolls = /auto|scroll/.test(style.overflowX + style.overflowY);
    if (!scrolls && empty(cut(s.rect, clip))) return no; // in a collapsed panel
    visible = cut(visible, clip);
  }
  const yes = { ok: true, pinned, fixed };
  // Out of sight: fine where scrolling brings it, not where nothing will
  if (empty(visible)) return fixed ? no : yes;
  // In sight: anything of it not covered
  const w = visible.right - visible.left, h = visible.bottom - visible.top;
  let underBand = false;
  for (const fy of [0.5, 0.15, 0.85]) {
    for (const fx of [0.5, 0.15, 0.85]) {
      const hit = document.elementFromPoint(visible.left + w * fx, visible.top + h * fy);
      if (!hit) continue;
      if (seen.contains(hit) || s.el.contains(hit)) return yes;
      underBand ||= !pinned && inBand(hit);
    }
  }
  return underBand ? yes : no;
}

// While a dialog is open, the arrows stay in it (the topmost, the last one shown)
function scope(): ParentNode {
  const dialogs = [...document.querySelectorAll('[aria-modal="true"], dialog[open]')].filter(d => d.getClientRects().length > 0);
  return dialogs[dialogs.length - 1] ?? document;
}

function spots(root: ParentNode, except: Element | null, stuck: Stuck[]): Spot[] {
  const out: Spot[] = [];
  for (const el of root.querySelectorAll(FOCUSABLE)) {
    if (el === except || !focusable(el)) continue;
    const s = spot(el, stuck);
    if (s) out.push(s);
  }
  return out;
}

// Whether the focused control uses this arrow itself
function keepsKey(el: Element, dir: Direction) {
  if (el.hasAttribute('aria-activedescendant')) return true; // a list that moves its own selection
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !caretAtEnd(el, dir);
  if (el instanceof HTMLInputElement) {
    if (el.type === 'range') return across(dir);
    if (TEXT_INPUTS.has(el.type)) return across(dir) && !caretAtEnd(el, dir);
  }
  return false;
}

// The caret at the start (going left/up) or the end (right/down) of the text: the arrow leaves it
function caretAtEnd(el: HTMLInputElement | HTMLTextAreaElement, dir: Direction) {
  let start: number | null, end: number | null;
  try { ({ selectionStart: start, selectionEnd: end } = el); } catch { return true; }
  if (start === null || end === null) return true; // no caret (number, email)
  if (start !== end) return false;
  return dir === 'left' || dir === 'up' ? start === 0 : end === el.value.length;
}

// Where the arrows go back to: the control the focus came from, per control and way
const cameFrom = new WeakMap<Element, { dir: Direction; el: HTMLElement }>();
// The focused control's place (in the page, not the screen), for when it is gone
let last: { path: string; box: Box } | null = null;

function remember(el: Element) {
  last = { path: location.pathname, box: moved(toBox(el.getBoundingClientRect()), scrollX, scrollY) };
}

// Where to start when nothing has the focus: the screen's main action, else
// the control nearest the middle of the screen (during a song the stage,
// where OK pauses; not the logo in the corner, which leaves the party)
function first(root: ParentNode): Spot | null {
  const v = viewport();
  const inSight = (s: Spot | null): s is Spot => !!s && !empty(cut(s.rect, v));
  for (const el of root.querySelectorAll('.btn-primary')) {
    const s = focusable(el) ? spot(el) : null;
    if (inSight(s) && look(s).ok) return s;
  }
  const x = v.right / 2, y = v.bottom / 2;
  const far = (b: Box) => Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
  const near = spots(root, null, []).filter(inSight).sort((a, b) => far(a.rect) - far(b.rect));
  return near.find(s => look(s).ok) ?? null;
}

// When the arrows last moved the focus (and scrolled to it). For a while
// after, the page may still be gliding there: the focus being off the screen
// then does not mean the page was scrolled away from it.
let movedAt = -Infinity;
const GLIDE_MS = 1500;
// Presses closer than this follow each other at once: a smooth scroll that
// starts over on every press of a held key falls further and further behind
const QUICK_MS = 300;

function go(s: Spot, pinned: boolean) {
  const now = performance.now();
  const quick = now - movedAt < QUICK_MS;
  movedAt = now;
  s.el.focus({ preventScroll: true });
  // On a pinned band it is in sight already (only a row or list inside it may need to move)
  if (pinned) {
    s.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }
  // Clear of the screen's edges, and of the pinned search band
  const smooth = !quick && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const before = s.el.style.scrollMargin;
  s.el.style.scrollMargin = `${Math.round(window.innerHeight * 0.2)}px 24px`;
  s.el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  s.el.style.scrollMargin = before;
}

function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
  const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;

  // OK on a checkbox or radio ticks it (Enter alone would send the form)
  if (e.key === 'Enter' && active instanceof HTMLInputElement && (active.type === 'checkbox' || active.type === 'radio')) {
    e.preventDefault();
    active.click();
    return;
  }

  const dir = DIRECTIONS[e.key];
  if (!dir || (active && keepsKey(active, dir))) return;
  const root = scope();
  const mark = () => { e.preventDefault(); document.documentElement.dataset.keynav = ''; };

  // Nothing focused yet (or the focus is outside an open dialog): the first press only shows where one is
  const stuck = stuckBands();
  const here = active && root.contains(active) ? spot(active, stuck) : null;
  let from: Box | null = here?.box ?? null;
  let onScreen = here?.rect ?? null;
  if (!here && !active && last?.path === location.pathname) {
    // The focused control went away (its list was redrawn): on from where it was
    from = onScreen = moved(last.box, -scrollX, -scrollY);
  }
  if (!from || !onScreen) {
    const start = first(root);
    if (start) { mark(); go(start, look(start).pinned); }
    return;
  }

  // Focus out of sight because the page was scrolled away from it (not
  // because the page is still on its way there): on from the screen's edge behind the way
  const v = viewport();
  let inSight = !empty(cut(onScreen, v));
  if (!inSight && performance.now() - movedAt >= GLIDE_MS) {
    if (dir === 'down') from = { ...v, top: -1, bottom: -1 };
    else if (dir === 'up') from = { ...v, top: v.bottom + 1, bottom: v.bottom + 1 };
    else if (dir === 'right') from = { ...v, left: -1, right: -1 };
    else from = { ...v, left: v.right + 1, right: v.right + 1 };
    inSight = true;
  }

  let pinned = false;
  const ok = (s: Spot) => { const l = look(s); pinned = l.pinned; return l.ok; };
  // The page and the box the focus is in first; another fixed box once there is nothing else that way
  const home = active && fixedBox(active);
  const later: Spot[] = [];
  const near = (s: Spot) => {
    const l = look(s);
    if (!l.ok) return false;
    if (l.fixed && l.fixed !== home) { later.push(s); return false; }
    pinned = l.pinned;
    return true;
  };
  const back = active ? cameFrom.get(active) : undefined;
  let next: Spot | null = null;
  if (back?.dir === dir && back.el.isConnected && root.contains(back.el) && focusable(back.el)) {
    const s = spot(back.el, stuck);
    if (s && isCandidate(from, s.box, dir) && ok(s)) next = s;
  }
  next ??= pick(from, dir, spots(root, active, stuck), near) ?? pick(from, dir, later, ok);
  // Nothing that way: up/down scroll the page (which then is no glide of ours)
  if (!next) { movedAt = -Infinity; return; }

  // Far below or above the screen (a link further down a long text): scroll
  // there first. Not while the focus is ahead of a page still gliding to it.
  if (!across(dir) && !pinned && inSight && (next.rect.top > v.bottom * 1.5 || next.rect.bottom < -v.bottom * 0.5)) {
    movedAt = -Infinity;
    return;
  }

  mark();
  if (active) cameFrom.set(next.el, { dir: OPPOSITE[dir], el: active });
  go(next, pinned);
}

let installed = false;

/** Arrow keys move the focus around the page (once, at startup). */
export function installSpatialNav() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // On the window, after the page's own handlers: whatever a control did with the key comes first
  window.addEventListener('keydown', onKey);
  document.addEventListener('focusin', e => { if (e.target instanceof Element) remember(e.target); });
}
