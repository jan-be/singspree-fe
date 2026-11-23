import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { frameSeconds, formatTime, timelineSegments, type SongRegion, type TimelineSegment } from '../logic/songRegions';
import type { LiveStore } from '../logic/liveStore';
import { screenRatio } from '../logic/canvasScale';

export interface SongTimelineProps {
  store: LiveStore;
  regions: SongRegion[];
  /** the video's length, s (0 while unknown: up to the last region then) */
  duration: number;
  /**
   * seek to a time, s (the host, or a co-host through the host); `preview`
   * while a drag is still under way (a quicker seek, YouTube's for scrubbing),
   * then once more without it where the drag lets go
   */
  onSeek?: (seconds: number, preview?: boolean) => void;
  label?: string;
  /** where the time ("1:05 / 3:20") is written, if anywhere (rendered along with the bar, always) */
  timeRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * A drag along the bar, and after it the seek it asked for: the cursor shows
 * that until the song's own time gets there (a co-host's seek goes through
 * the host's page and comes back a moment later)
 */
interface Pending {
  sec: number;
  dragging: boolean;
  /** performance.now() when the drag let go */
  since: number;
}
// The song's time counts as there once this close (s), or after this long (ms) regardless
const SETTLE_SECONDS = 1;
const SETTLE_MS = 3000;
// While dragging, the song follows at most this often (ms)
const DRAG_SEEK_MS = 120;

/** Where the bar is, measured after layout changes (CSS px), and the device pixel ratio */
interface BarGeometry {
  left: number;
  width: number;
  dpr: number;
}

/**
 * Our own progress bar for the song (YouTube's is covered). The stretches
 * where somebody sings are marked — purple for the first singer, orange for
 * the second, pink where both sing at once — and the host can click or drag
 * to seek, or, with the bar focused (a TV remote's arrows), step through the
 * song with left / right. A drag moves the cursor at once, under the pointer,
 * and the song follows a few times a second, each seek after the frame that
 * showed the cursor: seeking on every move, from the move itself, made the
 * drag lag behind.
 *
 * The regions are static per song, so they are a memoised layer; only the
 * cursor and the time label follow the live store frame by frame.
 */
const SINGER_COLORS: Record<TimelineSegment['who'], string> = { 1: '#b44aff', 2: '#ff8c42', 3: '#ff5cd6' };

const Regions = React.memo(({ regions, total }: { regions: SongRegion[]; total: number }) => {
  const segments = useMemo(() => timelineSegments(regions), [regions]);
  return (
    <>
      {segments.map((r, i) => (
        <div
          key={i}
          className="absolute inset-y-0 rounded-sm"
          style={{
            left: `${(r.start / total) * 100}%`,
            width: `${Math.max(0.3, ((r.end - r.start) / total) * 100)}%`,
            background: SINGER_COLORS[r.who],
            opacity: 0.75,
          }}
        />
      ))}
    </>
  );
});

// The thumb (w-3.5, centred by -ml-[7px]), in CSS px
const THUMB_WIDTH = 14;
const THUMB_MARGIN = -7;

// Layout works in 1/64 px. A percentage length resolves through 32-bit floats
// and is truncated to that grid; a box is painted at whole pixels, rounded.
const f32 = Math.fround;
const grid = (x: number) => Math.round(x * 64) / 64;
const lengthOf = (px: number) => Math.trunc(f32(px) * 64) / 64;
const percentOf = (base: number, pct: number) => Math.trunc(f32(f32(f32(f32(base) * f32(pct)) / 100) * 64)) / 64;
const pixelOf = (x: number) => Math.floor(x + 0.5);

// Seconds a left / right press moves the song, as the remote's rewind / fast-forward (tvApp.ts)
const KEY_STEP = 10;
// A held key moves it at most this often (ms): five steps, 50 s of song, a second
const KEY_REPEAT_MS = 200;
// Presses this close (ms) step on from where the last one went: the player
// (a co-host's: the host's, over the network) takes a moment to report it there
const KEY_CHAIN_MS = 1000;

/**
 * The pixels the cursor's painted edges land on at `pct` — the fill's right
 * end and the thumb's two sides — as a key: while it stays the same, writing
 * the new `pct` would repaint the same picture. Counted in device pixels
 * (Chrome on a phone lays out in those) and in CSS pixels (where the scale is
 * applied after layout, as in device emulation), so it holds either way.
 */
const cursorPixels = (geo: BarGeometry, pct: number) => {
  let key = '';
  for (const scale of [geo.dpr, 1]) {
    const end = grid(geo.left * scale) + percentOf(grid(geo.width * scale), pct);
    const thumb = end + lengthOf(THUMB_MARGIN * scale);
    key += `${pixelOf(end)} ${pixelOf(thumb)} ${pixelOf(thumb + lengthOf(THUMB_WIDTH * scale))} `;
  }
  return key;
};

/**
 * The cursor and the time label follow the store without React: the store
 * changes every frame, but at a song's length the cursor moves only a few
 * device pixels a second. So the width / left are written when a painted edge
 * reaches another pixel (and the label when its text changes); every frame
 * between used to re-lay out and repaint the bar for the same picture.
 */
interface CursorProps {
  store: LiveStore;
  total: number;
  timeRef?: React.RefObject<HTMLElement | null>;
  pending: React.RefObject<Pending | null>;
  /** set to the cursor's update, for a drag to call */
  kick: React.RefObject<(() => void) | null>;
}

const Cursor = ({ store, total, timeRef, pending, kick }: CursorProps) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const fill = fillRef.current, thumb = thumbRef.current, time = timeRef?.current ?? null;
    const bar = fill?.parentElement;
    if (!fill || !thumb || !bar) return undefined; // (rendered below, in the bar)
    // The label as the three text nodes it always was ("1:05", " / ", "3:20"),
    // which the browser places a hair differently from one joined string
    const secText = document.createTextNode('');
    if (time) {
      while (time.firstChild) time.removeChild(time.firstChild);
      for (const node of [secText, document.createTextNode(' / '), document.createTextNode(formatTime(total))]) time.appendChild(node);
    }
    let geo: BarGeometry | null = null; // where the bar is, measured after layout changes
    let shownPixels: string | null = null;

    // The song's time, or where a drag holds the cursor (and then the seek it asked for, until the song is there)
    const shownSeconds = () => {
      const sec = frameSeconds(store.getFrame().tickData);
      const p = pending.current;
      if (!p) return sec;
      if (p.dragging) return p.sec;
      if (Math.abs(sec - p.sec) < SETTLE_SECONDS || performance.now() - p.since > SETTLE_MS) {
        pending.current = null;
        return sec;
      }
      return p.sec;
    };
    const update = () => {
      const sec = shownSeconds();
      const pct = total > 0 ? Math.max(0, Math.min(100, (sec / total) * 100)) : 0;
      const pixels = geo ? cursorPixels(geo, pct) : null;
      if (pixels === null || pixels !== shownPixels) {
        fill.style.width = `${pct}%`;
        thumb.style.left = `${pct}%`;
      }
      shownPixels = pixels;
      const text = formatTime(sec);
      if (text !== secText.data) {
        secText.data = text;
        // (for a screen reader; the slider's other values are React's)
        bar.setAttribute('aria-valuenow', String(Math.round(sec)));
        bar.setAttribute('aria-valuetext', `${text} / ${formatTime(total)}`);
      }
    };
    // Read in a ResizeObserver callback or a resize event, where layout is
    // done anyway, never from the per-frame update (a forced layout).
    const measure = () => {
      const r = bar.getBoundingClientRect();
      geo = { left: r.left, width: r.width, dpr: screenRatio() };
      shownPixels = null;
      update();
    };

    update();
    kick.current = update;
    const unsubscribe = store.subscribe(update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(bar);
    window.addEventListener('resize', measure);
    return () => {
      kick.current = null;
      unsubscribe();
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [store, total, timeRef, pending, kick]);

  return (
    <>
      <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-l bg-gradient-to-r from-neon-cyan/50 to-white/40" />
      {/* The thumb goes with the rest of the controls (useIdleControls); a little larger while dragged */}
      <div className="ui-fade absolute inset-0 pointer-events-none">
        <div ref={thumbRef} className="absolute top-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-transform duration-150 group-data-[dragging]:scale-125" />
      </div>
    </>
  );
};

const SongTimeline = ({ store, regions, duration, onSeek, label, timeRef, className = '' }: SongTimelineProps) => {
  const total = useMemo(() => (duration > 0 ? duration : (regions.length ? regions[regions.length - 1].end + 5 : 0)), [duration, regions]);
  const dragging = useRef(false);
  const pending = useRef<Pending | null>(null);
  const kick = useRef<(() => void) | null>(null);
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  // The seeks of a drag: one at a time, after the next frame (so the cursor's
  // move is painted first), at most every DRAG_SEEK_MS, each to where the drag is then
  const dragSeek = useRef({ frame: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined, at: -Infinity, queued: false });
  const stopDragSeeks = () => {
    const d = dragSeek.current;
    cancelAnimationFrame(d.frame);
    clearTimeout(d.timer);
    d.queued = false;
  };
  useEffect(() => stopDragSeeks, []);
  const queueDragSeek = () => {
    const d = dragSeek.current;
    if (d.queued) return; // the one on its way takes the latest position
    d.queued = true;
    d.frame = requestAnimationFrame(() => {
      d.timer = setTimeout(() => {
        d.queued = false;
        const p = pending.current;
        if (!p?.dragging) return;
        d.at = performance.now();
        onSeekRef.current?.(p.sec, true);
      }, Math.max(0, DRAG_SEEK_MS - (performance.now() - d.at)));
    });
  };

  const secondsAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect(); // the bar (its own handlers)
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * total;
  };
  // While dragged, the bar says so (data-dragging): the controls stay up, the thumb grows
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    delete e.currentTarget.dataset.dragging;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek || total <= 0 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Text selected on the page (a double click's word) made the press the
    // start of dragging that text away: the browser's "no drop" cursor, no seek
    e.preventDefault();
    try { window.getSelection()?.removeAllRanges(); } catch { /* */ }
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.dragging = '';
    pending.current = { sec: secondsAt(e), dragging: true, since: 0 };
    kick.current?.();
    queueDragSeek();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pending.current;
    if (!dragging.current || !p) return;
    p.sec = secondsAt(e);
    kick.current?.();
    queueDragSeek();
  };
  // Let go (or the pointer taken away): the song goes where the cursor is, a full seek
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const p = pending.current;
    endDrag(e);
    stopDragSeeks();
    if (p && onSeek) {
      p.dragging = false;
      p.since = performance.now();
      onSeek(p.sec);
    }
    kick.current?.();
  };

  const keyRef = useRef({ to: 0, at: -Infinity });
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir || !onSeek || total <= 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault(); // (the page's arrow navigation leaves the focus here then; up / down still leave)
    const k = keyRef.current;
    const now = performance.now();
    if (e.repeat && now - k.at < KEY_REPEAT_MS) return;
    const from = now - k.at < KEY_CHAIN_MS ? k.to : frameSeconds(store.getFrame().tickData);
    k.to = Math.max(0, Math.min(total - 1, from + dir * KEY_STEP));
    k.at = now;
    onSeek(k.to);
  };

  return (
    <div
      role={onSeek ? 'slider' : 'progressbar'}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={onSeek ? onKeyDown : undefined}
      // (an invisible strip above and below takes the pointer too: a thin bar is hard to hit)
      className={`group relative h-2.5 rounded bg-white/15 ${onSeek ? "cursor-pointer touch-none before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-['']" : ''} ${className}`}
      onPointerDown={onSeek ? onPointerDown : undefined}
      onPointerMove={onSeek ? onPointerMove : undefined}
      onPointerUp={onSeek ? onPointerUp : undefined}
      onPointerCancel={onSeek ? onPointerUp : undefined}
      onLostPointerCapture={onSeek ? onPointerUp : undefined}
      onDragStart={e => e.preventDefault()}
    >
      {total > 0 && <Regions regions={regions} total={total} />}
      {total > 0 && <Cursor store={store} total={total} timeRef={timeRef} pending={pending} kick={kick} />}
    </div>
  );
};

export default SongTimeline;
