import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import css from './Lyrics.module.css';
import type { LiveFrame, LiveStore } from '../logic/liveStore';
import type { LyricElement, LyricLine, TickData } from '../logic/LyricsParser';
import {
  clampLyricRows, linesInRange, loadLyricRows, lyricRowsShown, lyricScrollBounds, placeLyricLines, storeLyricRows, usualLyricRows,
  MAX_LYRIC_ROWS, MIN_LYRIC_ROWS,
} from '../logic/lyricRows';
import { leadIn, leadProgress } from '../logic/lyricLeadIn';
import {
  lineSeekTime, releaseSpeed, BROWSE_IDLE_MS, FLING_DECAY, FLING_MIN_SPEED, PICK_WAIT_MS,
} from '../logic/lyricSeek';
import { popoverJustClosed, promptJustAnswered } from '../logic/popoverGuard';

const CYAN = '#00e5ff';
const GRAY = '#e0e0e0';

// The lead-in mark (lyricLeadIn.ts): how far it travels at most, in the
// line's letter size, the part of its way over which it comes into sight, and
// what of the room before the line its head needs to be seen from the start
const LEAD_WAY_EM = 5;
const LEAD_FADE_IN = 0.2;
const LEAD_HEAD_EM = 0.45;

// "~" marks a held note, the previous syllable sung on (about 6 % of USDB
// syllables): the note stays on the highway, the text shows the word once
const shown = (syllable: string) => syllable.replace(/~/g, '');

const textOf = (line: LyricLine) => line.map(el => (el.isBreak ? '' : shown(el.syllable))).join('');

// Hebrew, Arabic (Persian, Urdu) and Syriac letters: a syllable in them is read, and swept, from right to left
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** The sung syllable's colour at this frame: cyan as far as it has been sung (from its first letter), then gray. */
const sweepAt = (tickFloat: TickData['tickFloat'], el: LyricElement) => {
  const progress = Math.max(0, Math.min(1,
    (tickFloat - el.start) / Math.max(1, el.length)
  ));
  const pct = (progress * 100).toFixed(1);
  return `linear-gradient(${RTL.test(el.syllable) ? 270 : 90}deg, ${CYAN} ${pct}%, ${GRAY} ${pct}%)`;
};

interface RowProps {
  /** its place in the list (`data-i`: the line a click picks) */
  i: number;
  line: LyricLine;
  /** sung already, sung now, or still to come */
  state: 'past' | 'current' | 'next';
  /** the line sung now or one beside it: these have the glow, to fade it in and out */
  near: boolean;
  /** the current line's syllable the song is at (the next one sung, in a silence), else -1 */
  at: number;
  /** whether that syllable is being sung */
  sung: boolean;
  sweepRef: React.Ref<HTMLSpanElement>;
  /** the current line's syllable the lead-in mark stands before (its first, after a pause), else -1 */
  lead: number;
  leadRef: React.Ref<HTMLSpanElement>;
}

/**
 * One line of the list. Only the line sung now is drawn syllable by syllable;
 * the others are plain text, and stay as they are (memo) while the song moves
 * through the current one.
 *
 * The lead-in mark hangs on the syllable it stands before, outside the text's
 * flow (the line stays where it is): placed by the CSS at that syllable's
 * outer edge, moved by Lyrics while it is on its way, and let go into the
 * text by the CSS once Lyrics marks it `data-gone`.
 */
const Row = React.memo(({ i: index, line, state, near, at, sung, sweepRef, lead, leadRef }: RowProps) => (
  <div data-i={index} className={state === 'next' ? css.row : `${css.row} ${css[state]}`}>
    {near && <div className={css.glow} dir="auto" aria-hidden="true">{textOf(line)}&nbsp;</div>}
    <div className={css.line} dir="auto">
      {state !== 'current' ? textOf(line) : line.map((el, i) => {
        if (el.isBreak) return null;
        const mark = i === lead && (
          <span ref={leadRef} aria-hidden="true" className={RTL.test(el.syllable) ? `${css.lead} ${css.leadRtl}` : css.lead} />
        );
        const host = mark ? ` ${css.leadHost}` : '';
        if (sung && i === at) {
          return <span key={i} ref={sweepRef} data-at="" className={css.sweepText + host}>{mark}{shown(el.syllable)}</span>;
        }
        return (
          <span key={i} data-at={i === at ? '' : undefined} className={(i < at ? css.pastText : css.futureText) + host}>
            {mark}{shown(el.syllable)}
          </span>
        );
      })}
      &nbsp;
    </div>
  </div>
));

/** What the list shows now: which lines of which chart, and where */
interface Placed {
  rows: LyricLine[] | null;
  current: number;
  width: number;
  shift: number | null;
  first: number;
  last: number;
  /** the current line has more rows than fit: it moves on with the syllable sung */
  long: boolean;
  /** the line cut off at the view's upper edge, being read through */
  cutRow: HTMLElement | null;
}

// What of a long line has moved above the view is cut off there, not at the
// box's edge a padding further up, where half a row of it would still show.
// The other sides stay open: for the glow, and at the sides for the lead-in mark.
const cutOff = (px: number) => `inset(${px}px -100vw -60px -100vw)`;

/**
 * Moves the list so that line `current` is in its place in the view, and
 * marks the lines that are not in view whole (`data-out`, see the CSS).
 * Gliding there when the song went on by a line; at once for another chart, a
 * seek or a view of another width, where a glide would run through half the
 * song or through lines breaking anew. A current line with more rows than
 * the view is moved up a row at a time, to the row of the syllable the song
 * is at (the one marked `data-at`).
 *
 * `glide`: there all the same, from wherever the list is (back from the
 * lines the viewer scrolled to, or to a line they picked). `full`: every
 * line is looked at again, not only those that were or are in view (the
 * viewer's scroll showed others).
 */
function place(box: HTMLElement, view: HTMLElement, list: HTMLElement, was: Placed, rows: LyricLine[], current: number, { glide = false, full = false } = {}) {
  const els = list.children as HTMLCollectionOf<HTMLElement>;
  if (current < 0 || current >= els.length) { was.rows = null; return; }
  const all = was.rows !== rows;
  const width = view.clientWidth;
  const still = all || (!glide && (Math.abs(current - was.current) > 2 || width !== was.width));
  if (still) box.classList.add(css.still);
  // (the box cuts the list off but could be scrolled all the same, by a search in the page)
  if (box.scrollTop) box.scrollTop = 0;

  const rowHeight = parseFloat(getComputedStyle(list).lineHeight);
  const row = els[current];
  // (the syllable's box starts a little inside its row: the row it is in, counted from the line's first)
  const atTop = row.offsetHeight > rowHeight * 1.5 ? row.querySelector<HTMLElement>('[data-at]')?.offsetTop ?? 0 : 0;
  const into = Math.round(atTop / rowHeight) * rowHeight;
  const { shift, first, last, long, cut } = placeLyricLines(
    els.length, current, i => els[i].offsetTop, i => els[i].offsetHeight, view.clientHeight, rowHeight, into,
  );

  if (shift !== was.shift) list.style.transform = `translateY(${shift}px)`;
  const cutRow = long ? row : null;
  if (was.cutRow && was.cutRow !== cutRow) was.cutRow.style.clipPath = '';
  if (cutRow) cutRow.style.clipPath = cutOff(cut); // (from the line's first row on, cut by 0: the cut can then glide with the list)
  const from = all || full ? 0 : Math.min(first, was.first);
  const to = all || full ? els.length - 1 : Math.max(last, was.last);
  for (let i = from; i <= to; i++) els[i].toggleAttribute('data-out', i < first || i > last);

  if (still) {
    void list.offsetHeight; // the new place is taken with the glide off, before it is back on
    box.classList.remove(css.still);
  }
  Object.assign(was, { rows, current, width, shift, first, last, long, cutRow });
}

export interface LyricsProps {
  /** this track's tick data, new only when the line or the sung syllable changes */
  tickData: Partial<TickData>;
  store: LiveStore;
  /** this track's tick data in a frame of the store */
  pick: (frame: LiveFrame) => Partial<TickData> | null;
  label?: React.ReactNode;
  compact?: boolean;
  /**
   * Takes the song to a video time: the host's seek, or a co-host's by way of
   * the host's page. Given, the lines can be scrolled through and a line
   * clicked or tapped takes the song there (joiners: not given).
   */
  onSeek?: (seconds: number) => void;
}

/** The list as the viewer scrolls it: where it is moved to, how far it can go, and what of it shows */
interface Scroll {
  shift: number;
  min: number;
  max: number;
  /** the lines' places in the list, measured as the scroll began (or the view changed size) */
  tops: number[];
  heights: number[];
  rowHeight: number;
  /** the view's top in the box, and the box's height */
  viewTop: number;
  boxHeight: number;
  /** the lines shown, of the last move */
  first: number;
  last: number;
}

/** The viewer's way through the lines: scrolled away from the line sung now, or a line picked that the song is on its way to */
type Browse = { scroll: Scroll } | { picked: number };

/** How far a finger moves before a press is a scroll, not a tap (px) */
const DRAG_SLOP = 8;

/**
 * One part's lyrics, as a list that moves: every line of the chart is in it,
 * the one sung now lit and in its place, the next ones under it and, where
 * the band is tall enough, the last ones sung above. At a new line the list
 * glides up by one (lyricRows.ts says where to; the band's height is
 * LyricsBand's). All lines are one size, so a line breaks the same way
 * before, while and after it is sung, and nothing is laid out when it changes.
 *
 * The glow is a static, invisible copy of the line underneath with a
 * text-shadow: it repaints only when the line changes, while the per-frame
 * update touches plain, unfiltered text.
 *
 * `tickData` only has to be new when the line or the sung syllable changes
 * (see LiveView). The sweep through the sung syllable moves every frame, so
 * it follows the live store (`pick(frame)` is this track's tick data) and
 * sets the gradient on that one span, without re-rendering the line. Inline,
 * as before: the browser restyles a changed inline background on a fast path
 * (a custom property for it made the style recalc dearer in the benchmark).
 *
 * After a pause a line has a lead-in (lyricLeadIn.ts): a small mark that
 * sets off before the line's first note, from the side the line is read
 * from, and reaches the first letter as the note starts, where the sweep
 * goes on from it. It follows the store too, frame by frame, so it stands
 * still with a paused song; only its transform and opacity change, on a
 * layer of its own.
 *
 * `compact`: a little smaller and tighter — for stacked duet lists.
 * Each line takes its direction from its first letter (dir="auto"): an Arabic
 * or Hebrew line reads from the right, with its punctuation where it belongs.
 *
 * With `onSeek` (the host, a co-host) the list is a way through the song,
 * like a music app's lyrics (lyricSeek.ts): the wheel or a finger scrolls it
 * away from the line sung now, every line with any of it in the box showing,
 * the edges faded; a line clicked or tapped is where the song goes, and the
 * list glides there at once. Some quiet seconds after the last scroll it
 * glides back to the line sung now. A press here does not bring the page's
 * controls (`data-ui-quiet`), and a scroll keeps them as they are
 * (`data-dragging`): the box would move under the finger.
 */
const Lyrics = ({ tickData, store, pick, label, compact, onSeek }: LyricsProps) => {
  const line = tickData.currentLine;
  const lyricRef = tickData.lyricRef;
  const lines = tickData.lyricData?.lyricLines;
  // The lines one sings: a line without a note (a chart that opens with a break) is no row
  const rows = useMemo(() => (lines ?? []).filter(l => l.some(el => !el.isBreak)), [lines]);
  const current = line && lyricRef ? rows.indexOf(line) : -1;
  const sungIndex = line && lyricRef && !lyricRef.isSilent ? lyricRef.syllableIndex : -1;
  const sung = line && sungIndex >= 0 ? line[sungIndex] : null;
  const sweepRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const span = sweepRef.current;
    if (!span || !sung) return undefined;
    let shownSweep: string | null = null;
    const update = () => {
      const td = pick(store.getFrame());
      // Another line or syllable: the line re-renders this frame and runs this anew
      // (the line shown: a whole frame, with its tick, not the {} before the first)
      if (!td || td.currentLine !== line || td.lyricRef?.syllableIndex !== sungIndex || td.lyricRef.isSilent || td.tickFloat === undefined) return;
      const sweep = sweepAt(td.tickFloat, sung);
      if (sweep !== shownSweep) { span.style.backgroundImage = sweep; shownSweep = sweep; }
    };
    update();
    const unsubscribe = store.subscribe(update);
    return () => {
      unsubscribe();
      span.style.backgroundImage = ''; // React keeps the span for the next syllable's class
    };
  }, [store, pick, line, sungIndex, sung]);

  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef<Placed>({ rows: null, current: -1, width: 0, shift: null, first: 0, last: -1, long: false, cutRow: null });
  const wantedRef = useRef({ rows, current });
  const at = lyricRef ? lyricRef.syllableIndex : -1;
  const browseRef = useRef<Browse | null>(null);
  // (the browse's own: ends it without moving the list. Set by the effect further down)
  const stopBrowseRef = useRef(() => {});

  // The list goes to the line sung now: before the paint that shows the line lit.
  // Within a line it only moves for one too long for the view, with the syllable.
  // Not while the viewer has it: until they are done, the song has come to the
  // line they picked, or another chart is in it.
  useLayoutEffect(() => {
    const was = placedRef.current;
    wantedRef.current = { rows, current };
    const browse = browseRef.current;
    if (browse) {
      if (was.rows === rows && !('picked' in browse && browse.picked === current)) return;
      stopBrowseRef.current();
    }
    if (was.rows === rows && was.current === current && !was.long) return;
    if (boxRef.current && viewRef.current && listRef.current) place(boxRef.current, viewRef.current, listRef.current, was, rows, current);
  }, [rows, current, at]);

  // The lead-in mark of a line that comes after a pause
  const ticksPerSecond = (tickData.lyricData?.bpm ?? 0) / 60;
  const lead = useMemo(() => (current >= 0 ? leadIn(rows, current, ticksPerSecond) : null), [rows, current, ticksPerSecond]);
  const leadRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const mark = leadRef.current, box = boxRef.current, host = mark?.parentElement;
    if (!mark || !box || !host || !lead) return undefined;
    const fromRight = mark.classList.contains(css.leadRtl);
    // Its way: the room before the line, a few letters at most (measured as it sets off)
    const measure = () => {
      const hostBox = host.getBoundingClientRect(), outer = box.getBoundingClientRect();
      const room = fromRight ? outer.right - hostBox.right : hostBox.left - outer.left;
      const em = parseFloat(getComputedStyle(mark).fontSize) || 0;
      return Math.max(0, Math.min(room - LEAD_HEAD_EM * em, LEAD_WAY_EM * em));
    };
    let way: number | null = null;
    let phase: 'way' | 'gone' | null = null;
    let shownX: number | null = null, shownOpacity: string | null = null;
    const update = () => {
      const td = pick(store.getFrame());
      if (!td || td.currentLine !== line || td.rawTickFloat === undefined) return;
      // The first note has started: the CSS takes the mark from where it is
      // and draws it into the text. By the frame's own tick, not by the
      // syllable sung: a chart's first note is at tick 0, where the counted
      // tick stands through the whole intro.
      if (td.rawTickFloat >= lead.to) {
        if (phase === 'gone') return;
        phase = 'gone';
        mark.setAttribute('data-gone', '');
        mark.style.transform = '';
        mark.style.opacity = '';
        shownX = shownOpacity = null;
        return;
      }
      if (phase !== 'way') { phase = 'way'; mark.removeAttribute('data-gone'); }
      const progress = leadProgress(lead, td.rawTickFloat);
      if (progress > 0) way ??= measure();
      const x = Math.round((1 - progress) * (way ?? 0) * 10) / 10;
      // (the scale is for the CSS, which takes it to 0 from here: function for function, or it would jump)
      if (x !== shownX) { mark.style.transform = `translateX(${fromRight ? x : -x}px) scaleX(1)`; shownX = x; }
      const opacity = Math.min(1, progress / LEAD_FADE_IN).toFixed(2);
      if (opacity !== shownOpacity) { mark.style.opacity = opacity; shownOpacity = opacity; }
    };
    update();
    return store.subscribe(update);
  }, [store, pick, line, lead]);

  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const frameRef = useRef({ store, pick });
  frameRef.current = { store, pick };

  // The viewer's way through the lines (onSeek), and the list placed again
  // when the view is another size (the band dragged, the screen turned) or
  // the lines break anew (the list's height). Sizes are read in a
  // ResizeObserver callback or a resize event, where layout is done anyway.
  useLayoutEffect(() => {
    const box = boxRef.current, view = viewRef.current, list = listRef.current;
    if (!box || !view || !list) return undefined;
    const els = list.children as HTMLCollectionOf<HTMLElement>;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let flingFrame: number | null = null;
    // A finger on the list: where it went down, and once it scrolls, the shift it moves the list from
    let press: { id: number; y: number; base: number | null; moves: { t: number; y: number }[] } | null = null;
    let dragged = false; // the latest press scrolled (or stopped a flung list): its click picks nothing

    // To the line sung now, or to the one picked
    const placeWanted = (opts?: { glide?: boolean; full?: boolean }) => {
      const browse = browseRef.current, { rows, current } = wantedRef.current;
      place(box, view, list, placedRef.current, rows, browse && 'picked' in browse ? browse.picked : current, opts);
    };

    const measure = (): Omit<Scroll, 'shift'> | null => {
      const n = els.length;
      const rowHeight = parseFloat(getComputedStyle(list).lineHeight);
      if (!n || !(rowHeight > 0)) return null;
      const tops: number[] = [], heights: number[] = [];
      for (let i = 0; i < n; i++) { tops.push(els[i].offsetTop); heights.push(els[i].offsetHeight); }
      const { min, max } = lyricScrollBounds(n, i => tops[i], i => heights[i], view.clientHeight, rowHeight);
      return { min, max, tops, heights, rowHeight, viewTop: view.offsetTop, boxHeight: box.clientHeight, first: 0, last: n - 1 };
    };

    // The list moved to `shift` (whole pixels: text between two is drawn soft), and
    // every line with any of it in the box shown, a row more at each edge for the
    // wheel's short glide to bring in
    const scrollTo = (s: Scroll, shift: number) => {
      s.shift = Math.max(s.min, Math.min(s.max, Math.round(shift)));
      list.style.transform = `translateY(${s.shift}px)`;
      const { first, last } = linesInRange(s.tops.length, i => s.tops[i], i => s.heights[i], s.shift,
        -s.viewTop - s.rowHeight, s.boxHeight - s.viewTop + s.rowHeight);
      for (let i = Math.min(first, s.first); i <= Math.max(last, s.last) && i < els.length; i++) {
        els[i].toggleAttribute('data-out', i < first || i > last);
      }
      s.first = first;
      s.last = last;
    };

    const stopFling = () => {
      if (flingFrame !== null) cancelAnimationFrame(flingFrame);
      flingFrame = null;
    };
    const unhold = () => { delete box.dataset.drag; delete box.dataset.dragging; };
    // The viewer's no more, the list left where it is
    const stop = () => {
      clearTimeout(endTimer);
      endTimer = undefined;
      stopFling();
      unhold();
      delete box.dataset.browse;
      browseRef.current = null;
    };
    stopBrowseRef.current = stop;
    // Back to the line sung now, gliding
    const end = () => {
      stop();
      placeWanted({ glide: true, full: true });
    };
    // (not while a finger still holds the list)
    const armEnd = () => {
      clearTimeout(endTimer);
      const wait = () => {
        if (press?.base != null) endTimer = setTimeout(wait, BROWSE_IDLE_MS);
        else end();
      };
      endTimer = setTimeout(wait, BROWSE_IDLE_MS);
    };

    // Scrolled from where the list is: the line sung now in its place, or the one picked in its
    const startScroll = (): Scroll | null => {
      const browse = browseRef.current;
      if (browse && 'scroll' in browse) return browse.scroll;
      const m = measure();
      if (!m) return null;
      stop();
      const was = placedRef.current;
      if (was.cutRow) { was.cutRow.style.clipPath = ''; was.cutRow = null; } // (a long line shows whole)
      const s: Scroll = { ...m, shift: was.shift ?? 0 };
      was.shift = null; // (set again when the list goes back)
      browseRef.current = { scroll: s };
      box.dataset.browse = '';
      scrollTo(s, s.shift);
      return s;
    };

    const fling = (s: Scroll, speed: number) => {
      let v = speed, last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(50, Math.max(0, now - last));
        last = now;
        const before = s.shift;
        scrollTo(s, s.shift + v * dt);
        v *= Math.pow(FLING_DECAY, dt);
        if ((dt > 0 && s.shift === before) || Math.abs(v) < 0.02) {
          flingFrame = null;
          unhold();
          armEnd();
          return;
        }
        flingFrame = requestAnimationFrame(step);
      };
      flingFrame = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (!onSeekRef.current || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault(); // (not the stage's scroll, below lg)
      stopFling();
      unhold();
      const s = startScroll();
      if (!s) return;
      const unit = e.deltaMode === 1 ? s.rowHeight : e.deltaMode === 2 ? view.clientHeight : 1;
      scrollTo(s, s.shift - e.deltaY * unit);
      armEnd();
    };

    // A finger (or a pen) scrolls; the mouse has the wheel, and selects text as before
    const onDown = (e: PointerEvent) => {
      dragged = false;
      if (!onSeekRef.current || e.pointerType === 'mouse' || !e.isPrimary) return;
      if (flingFrame !== null) { stopFling(); dragged = true; } // (a flung list caught: it stays there)
      press = { id: e.pointerId, y: e.clientY, base: null, moves: [] };
    };
    const onMove = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const dy = e.clientY - press.y;
      if (press.base === null) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        const s = startScroll();
        if (!s) { press = null; return; }
        press.base = s.shift - dy;
        dragged = true;
        box.dataset.drag = '';
        box.dataset.dragging = '';
        try { box.setPointerCapture(e.pointerId); } catch { /* */ }
      }
      const browse = browseRef.current;
      if (!browse || !('scroll' in browse)) return;
      scrollTo(browse.scroll, press.base + dy);
      press.base = browse.scroll.shift - dy; // (held at an end: back at once with the finger)
      press.moves.push({ t: e.timeStamp, y: e.clientY });
      if (press.moves.length > 8) press.moves.shift();
      armEnd();
    };
    const onUp = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const p = press;
      press = null;
      if (p.base === null) return; // a tap: its click picks the line
      const browse = browseRef.current;
      const speed = e.type === 'pointerup' ? releaseSpeed(p.moves, e.timeStamp) : 0;
      if (browse && 'scroll' in browse && Math.abs(speed) >= FLING_MIN_SPEED) fling(browse.scroll, speed);
      else { unhold(); armEnd(); }
    };

    // A line clicked or tapped: the song goes there, and the list at once
    // (on a co-host's page the song gets there by way of the host's)
    const onClick = (e: MouseEvent) => {
      const seek = onSeekRef.current;
      if (!seek || dragged || popoverJustClosed() || promptJustAnswered()) return;
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed && box.contains(selection.anchorNode)) return; // (text selected with the mouse)
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-i]') : null;
      if (!row || !list.contains(row)) return;
      const i = Number(row.dataset.i);
      const { store: liveStore, pick: pickFrame } = frameRef.current;
      const chart = pickFrame(liveStore.getFrame())?.lyricData;
      const time = chart ? lineSeekTime(wantedRef.current.rows, i, chart.bpm, chart.gap) : null;
      if (time === null) return;
      seek(time);
      stop();
      browseRef.current = { picked: i };
      placeWanted({ glide: true, full: true });
      endTimer = setTimeout(end, PICK_WAIT_MS);
    };

    const again = () => {
      const browse = browseRef.current;
      if (browse && 'scroll' in browse) {
        const m = measure();
        if (m) { Object.assign(browse.scroll, m, { first: 0, last: els.length - 1 }); scrollTo(browse.scroll, browse.scroll.shift); }
        return;
      }
      placeWanted();
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(again) : null;
    ro?.observe(view);
    ro?.observe(list);
    window.addEventListener('resize', again);
    box.addEventListener('wheel', onWheel, { passive: false });
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onUp);
    box.addEventListener('click', onClick);
    return () => {
      stop();
      stopBrowseRef.current = () => {};
      ro?.disconnect();
      window.removeEventListener('resize', again);
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onUp);
      box.removeEventListener('click', onClick);
    };
  }, []);

  const boxClass = [css.lyrics, compact && css.compact, onSeek && css.seekable].filter(Boolean).join(' ');
  return (
    <div ref={boxRef} className={boxClass} data-ui-quiet={onSeek ? '' : undefined}>
      {label && <div className={css.trackLabel}>{label}</div>}
      <div ref={viewRef} className={css.view}>
        <div ref={listRef} className={css.list}>
          {/* (a line has its place: getTickData's line is [] without one) */}
          {current >= 0 && rows.map((row, i) => (
            <Row
              key={i}
              i={i}
              line={row}
              state={i < current ? 'past' : i === current ? 'current' : 'next'}
              near={i >= current - 1 && i <= current + 1}
              at={i === current ? at : -1}
              sung={i === current && sungIndex >= 0}
              sweepRef={sweepRef}
              lead={i === current && lead ? lead.first : -1}
              leadRef={leadRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export interface LyricsBandProps {
  /** two singers' lists are in it, one above the other */
  duet?: boolean;
  /** what the handle on its upper edge is called (for a screen reader, and as its tooltip) */
  resizeLabel?: string;
  children: React.ReactNode;
}

/**
 * The band the lyrics are in, as tall as the viewer likes: its upper edge is
 * a handle to drag, a line at a time (or to move with the left and right
 * arrows once focused: up and down stay the page's, to get past it with a
 * remote). Double-clicked, it is back at the screen's usual height (two
 * lines, three on a phone held upright: the CSS's, as long as nothing is
 * picked). The number is this browser's (lyricRows.ts) and the CSS's to turn
 * into a height; where the stage has no room for all of it the band is
 * lower, and what is dragged or stepped from there starts at what is seen,
 * counted as it is once the page's controls are away (--ui-spare, index.css:
 * the room they take while they are up). While it is dragged the controls
 * stay as they are (`data-ui-quiet`, `data-dragging`: useIdleControls), so
 * the band's lower edge does not move under the finger.
 */
export const LyricsBand = ({ duet, resizeLabel, children }: LyricsBandProps) => {
  const [rows, setRows] = useState(loadLyricRows);
  const rowsRef = useRef(rows);
  const bandRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ bottom: number; grab: number; chrome: number; row: number } | null>(null);

  // The band now: a line's height, what of the band is no line, and the lines
  // it has room for, with the room the page's controls give it when they go
  const measure = () => {
    const band = bandRef.current;
    if (!band) return null;
    const style = getComputedStyle(band);
    const row = parseFloat(style.fontSize) * parseFloat(style.getPropertyValue('--line'));
    const chrome = 2 * parseFloat(style.getPropertyValue('--pad'));
    if (!(row > 0) || !(chrome >= 0)) return null;
    const spare = parseFloat(style.getPropertyValue('--ui-spare')) || 0;
    return { band, row, chrome, fit: lyricRowsShown(band.clientHeight + spare, chrome, row) };
  };
  // (on the band at once, not at React's next render: what is measured right after is the new height)
  const show = (next: number | null) => {
    rowsRef.current = next;
    if (next === null) bandRef.current?.style.removeProperty('--rows');
    else bandRef.current?.style.setProperty('--rows', String(next));
    setRows(next);
  };
  const keep = (next: number | null) => { show(next); storeLyricRows(next); };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = measure();
    if (!m || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); // (no text is selected on the way; the focus, which that would have given, by hand)
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.dataset.dragging = '';
    const box = m.band.getBoundingClientRect();
    // (the band grows upwards: its lower edge stays where it is)
    dragRef.current = { bottom: box.bottom, grab: e.clientY - box.top, chrome: m.chrome, row: m.row };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const next = clampLyricRows((d.bottom - (e.clientY - d.grab) - d.chrome) / d.row);
    if (next !== rowsRef.current) show(next);
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.dragging;
    if (!dragRef.current) return;
    dragRef.current = null;
    const asked = rowsRef.current;
    // (dragged past what the stage has room for: what is seen counts. Not dragged at all: nothing is picked)
    if (asked !== null) keep(Math.min(asked, measure()?.fit ?? asked));
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault(); // (the page's arrow navigation leaves the focus here then; up / down still leave)
    const asked = rowsRef.current ?? usualLyricRows();
    keep(clampLyricRows(Math.min(asked, measure()?.fit ?? asked) + step));
  };

  return (
    <div ref={bandRef} className={duet ? `${css.band} ${css.duet}` : css.band} style={rows === null ? undefined : { '--rows': rows } as React.CSSProperties}>
      <div
        role="slider"
        aria-orientation="vertical"
        aria-label={resizeLabel}
        aria-valuemin={MIN_LYRIC_ROWS}
        aria-valuemax={MAX_LYRIC_ROWS}
        aria-valuenow={rows ?? usualLyricRows()}
        title={resizeLabel}
        tabIndex={0}
        data-ui-quiet=""
        className={css.handle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={() => keep(null)}
        onKeyDown={onKeyDown}
      />
      {children}
    </div>
  );
};

export default Lyrics;
