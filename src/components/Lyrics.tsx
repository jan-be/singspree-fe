import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import css from './Lyrics.module.css';
import type { LiveFrame, LiveStore } from '../logic/liveStore';
import type { LyricElement, LyricLine, TickData } from '../logic/LyricsParser';
import {
  clampLyricRows, loadLyricRows, lyricRowsShown, placeLyricLines, storeLyricRows, usualLyricRows,
  MAX_LYRIC_ROWS, MIN_LYRIC_ROWS,
} from '../logic/lyricRows';
import { leadIn, leadProgress } from '../logic/lyricLeadIn';

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
const Row = React.memo(({ line, state, near, at, sung, sweepRef, lead, leadRef }: RowProps) => (
  <div className={state === 'next' ? css.row : `${css.row} ${css[state]}`}>
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
 */
function place(box: HTMLElement, view: HTMLElement, list: HTMLElement, was: Placed, rows: LyricLine[], current: number) {
  const els = list.children as HTMLCollectionOf<HTMLElement>;
  if (current < 0 || current >= els.length) { was.rows = null; return; }
  const all = was.rows !== rows;
  const width = view.clientWidth;
  const still = all || Math.abs(current - was.current) > 2 || width !== was.width;
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
  const from = all ? 0 : Math.min(first, was.first);
  const to = all ? els.length - 1 : Math.max(last, was.last);
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
}

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
 */
const Lyrics = ({ tickData, store, pick, label, compact }: LyricsProps) => {
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

  // The list goes to the line sung now: before the paint that shows the line lit.
  // Within a line it only moves for one too long for the view, with the syllable.
  useLayoutEffect(() => {
    const was = placedRef.current;
    wantedRef.current = { rows, current };
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

  // And again when the view is another size (the band dragged, the screen
  // turned) or the lines break anew (the list's height). Read in a
  // ResizeObserver callback or a resize event, where layout is done anyway.
  useLayoutEffect(() => {
    const box = boxRef.current, view = viewRef.current, list = listRef.current;
    if (!box || !view || !list) return undefined;
    const again = () => place(box, view, list, placedRef.current, wantedRef.current.rows, wantedRef.current.current);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(again) : null;
    ro?.observe(view);
    ro?.observe(list);
    window.addEventListener('resize', again);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', again);
    };
  }, []);

  return (
    <div ref={boxRef} className={compact ? `${css.lyrics} ${css.compact}` : css.lyrics}>
      {label && <div className={css.trackLabel}>{label}</div>}
      <div ref={viewRef} className={css.view}>
        <div ref={listRef} className={css.list}>
          {/* (a line has its place: getTickData's line is [] without one) */}
          {current >= 0 && rows.map((row, i) => (
            <Row
              key={i}
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
 * lower, and what is dragged or stepped from there starts at what is seen.
 */
export const LyricsBand = ({ duet, resizeLabel, children }: LyricsBandProps) => {
  const [rows, setRows] = useState(loadLyricRows);
  const rowsRef = useRef(rows);
  const bandRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ bottom: number; grab: number; chrome: number; row: number } | null>(null);

  // The band now: a line's height, what of the band is no line, and the lines it has room for
  const measure = () => {
    const band = bandRef.current;
    if (!band) return null;
    const style = getComputedStyle(band);
    const row = parseFloat(style.fontSize) * parseFloat(style.getPropertyValue('--line'));
    const chrome = 2 * parseFloat(style.getPropertyValue('--pad'));
    if (!(row > 0) || !(chrome >= 0)) return null;
    return { band, row, chrome, fit: lyricRowsShown(band.clientHeight, chrome, row) };
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
  const onPointerEnd = () => {
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
