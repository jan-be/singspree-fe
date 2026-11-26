import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { partiedBefore } from '../logic/partyHistory';

/**
 * The party page's tour, the first time a device opens it: one step per menu
 * whose use is not plain from its button, each opened for real by its step and
 * closed after (PartyBar tourStep → VolumeControl / MicPanel tourOpen, the
 * party's door from the QR code). The rest of the page is dimmed and takes no
 * presses, the open menu does (sliders and switches can be tried); a card
 * beside it says what it is for, with Skip, Back and Next. The button and its
 * menu are lit apart, so its neighbours in the bar stay out of it.
 *
 *   volume  the volume, and on songs with stems the original singer's level
 *   mic     the microphone panel, "More microphones" unfolded: more singers on one device
 *   party   the party's settings behind the QR code (a phone's share button):
 *           joining, co-hosts, voices on the speakers; the host's and co-hosts' only
 *
 * Shown once per device, and only on one at its first party: one that was in
 * a party before (its party history, kept since 2026-10-19) knows its way
 * round. The mark is set when the tour starts, so leaving in the middle does
 * not bring it back. The page decides when (PartyPage: no
 * prompt, score screen or other overlay up) and holds the host's song meanwhile.
 */
export type TourStepId = 'volume' | 'mic' | 'party';

const SEEN_KEY = 'singspree_party_tour_seen';

/** While the tour's card lies along a phone's bottom, a menu it opened ends above it (--tour-room, set below) */
export const TOUR_CAP = (rem: number): React.CSSProperties => ({ maxHeight: `calc(100dvh - ${rem}rem - var(--tour-room, 0px))` });

const seenBefore = () => {
  // (no storage, no tour: it could not remember being seen, and would come every time)
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
};

/**
 * The tour's state: 'waiting' to start (not seen on this device), 'on', or
 * 'done' (seen, skipped, this device's party is not its first, or not for this
 * page at all). `partyId`: the page's party, once known.
 */
export function usePartyTour(enabled: boolean, partyId: string | null | undefined) {
  const [shownPhase, setPhase] = useState<'waiting' | 'on' | 'done'>(() => (enabled && !seenBefore() ? 'waiting' : 'done'));
  // (asked once the party is known; this party's own record, written as it goes, never counts)
  const returning = useMemo(() => !!partyId && partiedBefore(partyId), [partyId]);
  const phase = shownPhase === 'waiting' && returning ? 'done' : shownPhase;
  const [index, setIndex] = useState(0);
  const start = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* */ }
    setIndex(0);
    setPhase(p => (p === 'waiting' ? 'on' : p));
  }, []);
  const end = useCallback(() => setPhase('done'), []);
  return { phase, pending: phase !== 'done', index, setIndex, start, end };
}

/** The spotlight's room around what it shows (px): small enough that a button's and its menu's stay apart */
const PAD = 4;
/** The card's distance from the spotlight and from the screen's edges (px) */
const GAP = 14;
const EDGE = 12;
/** Below this width the card lies along the bottom, the menus above it */
const SHEET_BELOW = 640;
/** The card's width, and how narrow it may get to fit beside a menu (a phone held sideways) */
const CARD_W = 320;
const CARD_MIN_W = 240;

interface Box { left: number; top: number; right: number; bottom: number }
/** A lit place: a box and its corners' radius */
interface Hole extends Box { r: number }

const lit = (el: Element | null | undefined, shape: Element | null | undefined = el): Hole | null => {
  const b = el?.getBoundingClientRect();
  if (!el || !b || b.width <= 0 || b.height <= 0) return null;
  const radius = parseFloat(getComputedStyle(shape ?? el).borderTopLeftRadius) || 0;
  const h = { left: b.left - PAD, top: b.top - PAD, right: b.right + PAD, bottom: b.bottom + PAD, r: 0 };
  h.r = Math.min(radius + PAD, (h.right - h.left) / 2, (h.bottom - h.top) / 2);
  return h;
};
const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const union = (a: Hole, b: Hole): Hole => ({
  left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom), r: Math.max(a.r, b.r),
});

/** The step's button and the menu it opened, each lit (as one where they would overlap); the one in sight (the bar has a hidden twin for the other layout) */
const measure = (step: TourStepId): Hole[] => {
  const root = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step}"]`)].find(el => el.getClientRects().length > 0);
  if (!root) return [];
  // (the root wraps the button: its size, the button's corners)
  const button = lit(root, root.querySelector('button'));
  const pop = lit(root.querySelector('[data-tour-pop]'));
  if (!button) return pop ? [pop] : [];
  if (!pop) return [button];
  return overlap(button, pop) ? [union(button, pop)] : [button, pop];
};

/** Follows the step's button and menu: they open, grow and move (a few times a second, only while the tour is up) */
const useHoles = (step: TourStepId) => {
  const [holes, setHoles] = useState<Hole[]>(() => measure(step));
  useEffect(() => {
    let last = '';
    const tick = () => {
      const h = measure(step);
      const key = h.map(b => `${Math.round(b.left)} ${Math.round(b.top)} ${Math.round(b.right)} ${Math.round(b.bottom)}`).join();
      if (key !== last) { last = key; setHoles(h); }
    };
    tick();
    const id = setInterval(tick, 100);
    window.addEventListener('resize', tick);
    return () => { clearInterval(id); window.removeEventListener('resize', tick); };
  }, [step]);
  return holes;
};

/** A rounded box as a closed path (the dim's holes: with evenodd, presses in them pass through to the page) */
const roundRect = ({ left: x, top: y, right, bottom, r }: Hole) => {
  const w = right - x, h = bottom - y;
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
};

const useViewport = () => {
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return view;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where the card goes: beside the spotlight (left, else right), else under it,
 * else beside it narrower where the wider side has room for that, else at the bottom
 */
const place = (hole: Box | null, h: number, view: { w: number; h: number }) => {
  const w = Math.min(CARD_W, view.w - 2 * EDGE);
  if (!hole) return { left: (view.w - w) / 2, top: (view.h - h) / 2, width: w };
  const top = clamp(hole.top, EDGE, view.h - h - EDGE);
  const leftRoom = hole.left - GAP - EDGE;
  const rightRoom = view.w - EDGE - hole.right - GAP;
  if (leftRoom >= w) return { left: hole.left - GAP - w, top, width: w };
  if (rightRoom >= w) return { left: hole.right + GAP, top, width: w };
  if (hole.bottom + GAP + h <= view.h - EDGE) return { left: clamp(hole.right - w, EDGE, view.w - w - EDGE), top: hole.bottom + GAP, width: w };
  const room = Math.max(leftRoom, rightRoom);
  if (room >= CARD_MIN_W) return { left: leftRoom >= rightRoom ? hole.left - GAP - room : hole.right + GAP, top, width: room };
  return { left: clamp((view.w - w) / 2, EDGE, view.w - w - EDGE), top: view.h - h - EDGE, width: w };
};

// The tour's own presses stay its own: the menus close on a press outside them,
// and a press on the dimmed stage would pause the song
const keep = (e: React.SyntheticEvent) => e.stopPropagation();

interface PartyTourProps {
  steps: TourStepId[];
  index: number;
  onIndexChange: (index: number) => void;
  onEnd: () => void;
  /** the host's song waits for the tour */
  songHeld?: boolean;
}

const PartyTour = ({ steps, index, onIndexChange, onEnd, songHeld = false }: PartyTourProps) => {
  const { t } = useTranslation();
  const id = useId();
  const i = Math.min(index, steps.length - 1);
  const step = steps[i];
  const last = i === steps.length - 1;
  const holes = useHoles(step);
  const hole = holes.length ? holes.reduce(union) : null;
  const view = useViewport();
  const sheet = view.w < SHEET_BELOW;

  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState({ h: 200 });
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const read = () => setCard(c => (c.h === el.offsetHeight ? c : { h: el.offsetHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Along a phone's bottom the card takes the menus' room: they end above it (TOUR_CAP)
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (sheet) root.style.setProperty('--tour-room', `${card.h + EDGE}px`);
    else root.style.removeProperty('--tour-room');
  }, [sheet, card.h]);
  useEffect(() => () => { document.documentElement.style.removeProperty('--tour-room'); }, []);

  // The keys: Escape ends it; the main button has the focus, for Enter (and a TV remote's OK)
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { primaryRef.current?.focus({ preventScroll: true }); }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onEnd(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onEnd]);

  const next = () => (last ? onEnd() : onIndexChange(i + 1));
  const back = () => onIndexChange(Math.max(0, i - 1));

  const vocals = t('volume.vocals');
  const content: Record<TourStepId, { title: string; text: string }> = {
    volume: { title: t('tour.volumeTitle'), text: t('tour.volumeText', { vocals }) },
    mic: { title: t('tour.micTitle'), text: t('tour.micText') },
    party: { title: t('tour.partyTitle'), text: sheet ? t('tour.partyTextShare') : t('tour.partyTextQr') },
  };
  const { title, text } = content[step];

  const at = sheet ? null : place(hole, card.h, view);

  return (
    <>
      {/* The dim, with a hole for the button and one for its menu, each ringed in the sign's pink.
          The dim takes the presses (nothing behind it pauses or closes); in a hole they reach the page */}
      <svg aria-hidden="true" data-tour-dim="" className="fixed inset-0 z-[60] w-full h-full pointer-events-none overflow-visible">
        <path
          d={`M-50 -50H20000V20000H-50Z${holes.map(roundRect).join('')}`}
          fillRule="evenodd"
          fill="rgba(12, 8, 30, 0.66)"
          pointerEvents="auto"
          onPointerDown={keep}
          onClick={keep}
        />
        {holes.map((h, k) => (
          <rect
            key={k}
            data-tour-spot=""
            x={h.left} y={h.top} width={h.right - h.left} height={h.bottom - h.top} rx={h.r}
            fill="none" stroke="rgba(255, 92, 214, 0.9)" strokeWidth="2"
            style={{ filter: 'drop-shadow(0 0 10px rgba(255, 92, 214, 0.45))' }}
          />
        ))}
      </svg>
      <div
        ref={cardRef}
        role="dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        data-party-tour={step}
        onPointerDown={keep}
        onClick={keep}
        className={`pop fixed z-[61] p-4 text-sm ${sheet
          ? 'inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'
          : 'transition-[left,top] duration-200 ease-out'}`}
        style={at ?? undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="pop-label">{t('tour.label')}</span>
          <span role="img" aria-label={t('tour.step', { n: i + 1, count: steps.length })} className="flex items-center gap-1.5">
            {steps.map((s, k) => (
              <span key={s} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${k === i ? 'w-4 fill-hot' : 'w-1.5 bg-white/25'}`} />
            ))}
          </span>
        </div>
        <div key={step} className="animate-tour-in">
          <h2 id={`${id}-title`} className="mt-2.5 text-base font-semibold text-white">{title}</h2>
          <p id={`${id}-text`} className="mt-1 text-white/75 leading-snug">{text}</p>
        </div>
        {songHeld && <p data-tour-held="" className="mt-2 text-xs text-white/45 leading-snug">{t('tour.songWaits')}</p>}
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button type="button" onClick={onEnd} data-tour-skip="" className="btn btn-sm -ms-2 px-2.5 text-white/60 hover:text-white">
              {t('tour.skip')}
            </button>
          )}
          <span className="flex-1" />
          {i > 0 && (
            <button type="button" onClick={back} className="btn btn-sm btn-ghost">{t('tour.back')}</button>
          )}
          <button ref={primaryRef} type="button" onClick={next} data-tour-next="" className="btn btn-sm btn-primary">
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </>
  );
};

export default PartyTour;
