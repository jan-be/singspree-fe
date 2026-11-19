import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "../GlobalConsts";
import { MicIcon } from "./Icons";
import { DropdownChevron } from "./Dropdown";
import { VOICE_MIN, VOICE_MAX, noteName, windowOf, endsOf, sameWindow, type VoiceWindow } from "../logic/voiceWindow";

/** How many songs sit at each pitch (backend GET /songs/pitches), fetched once */
let histogram: Promise<Map<number, number>> | null = null;
const loadHistogram = () => (histogram ??= fetch(`${apiUrl}/songs/pitches`)
  .then(r => r.json())
  .then(j => new Map<number, number>((j.data ?? []).map((b: { pitch: number; count: number }) => [b.pitch, b.count])))
  .catch(() => { histogram = null; return new Map<number, number>(); }));

/** The slider settles this long after the last move before the songs follow */
const COMMIT_MS = 350;
/** The panel's width, and how near the screen's edge it may come (px) */
const PANEL_WIDTH = 336;
const EDGE = 8;

const pct = (v: number) => `${((v - VOICE_MIN) / (VOICE_MAX - VOICE_MIN)) * 100}%`;

/**
 * The song filters' voice slider (SongFilterBar): a window on each song's
 * average pitch, the median of its melody measured from the recording
 * (backend voiceRange.ts). A song sits at one place on it, so two windows side
 * by side share no song. The chip names the window; its panel holds the
 * two-thumb slider over a histogram of the songs.
 *
 * It may sit in the queue's own window (QueueWindow): the panel keeps to the
 * screen and hears the clicks of the document it is in.
 */
const VoiceFilter = ({ value, onChange, chipClass }: { value: VoiceWindow | null; onChange: (w: VoiceWindow | null) => void; chipClass: string }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ left: 0, width: PANEL_WIDTH });
  const [[lo, hi], setEnds] = useState<[number, number]>(() => endsOf(value));
  const [counts, setCounts] = useState<Map<number, number> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const committed = useRef(value);

  // the filters changed elsewhere (back, clear filters): the thumbs follow
  useEffect(() => {
    committed.current = value;
    setEnds(endsOf(value));
  }, [value?.min, value?.max]); // eslint-disable-line react-hooks/exhaustive-deps

  // the songs follow once the thumbs rest
  useEffect(() => {
    const next = windowOf(lo, hi);
    if (sameWindow(next, committed.current)) return undefined;
    const timer = setTimeout(() => { committed.current = next; onChange(next); }, COMMIT_MS);
    return () => clearTimeout(timer);
  }, [lo, hi]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    if (!open || !doc) return undefined;
    let gone = false;
    loadHistogram().then(c => { if (!gone) setCounts(c); });
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node | null)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    doc.addEventListener('mousedown', onDown);
    doc.addEventListener('keydown', onKey);
    return () => { gone = true; doc.removeEventListener('mousedown', onDown); doc.removeEventListener('keydown', onKey); };
  }, [open]);

  // the panel stays inside what it can be seen in: the screen, or the scrolling panel it opens in (the queue's
  // drawer, a playlist's dialog), under the chip, moved as little as it takes
  useLayoutEffect(() => {
    const el = ref.current;
    const view = el?.ownerDocument.defaultView;
    if (!open || !el || !view) return;
    let lo = 0, hi = view.innerWidth;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const style = view.getComputedStyle(p);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const b = p.getBoundingClientRect();
        lo = Math.max(lo, b.left);
        hi = Math.min(hi, b.right);
        break;
      }
    }
    const r = el.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, hi - lo - 2 * EDGE);
    const left = Math.min(Math.max(lo + EDGE, r.left), hi - EDGE - width);
    setPlace({ left: left - r.left, width });
  }, [open]);

  const label = (w: VoiceWindow | null) => {
    if (!w) return t('sections.voice');
    if (w.min !== null && w.max !== null) return w.min === w.max ? noteName(w.min, lang) : `${noteName(w.min, lang)} – ${noteName(w.max, lang)}`;
    return w.min !== null ? `≥ ${noteName(w.min, lang)}` : `≤ ${noteName(w.max!, lang)}`;
  };
  const shown = windowOf(lo, hi);
  // the ends hold everything past them
  const bars = Array.from({ length: VOICE_MAX - VOICE_MIN + 1 }, (_, i) => {
    const p = VOICE_MIN + i;
    let n = counts?.get(p) ?? 0;
    if (counts && p === VOICE_MIN) for (const [q, c] of counts) if (q < VOICE_MIN) n += c;
    if (counts && p === VOICE_MAX) for (const [q, c] of counts) if (q > VOICE_MAX) n += c;
    return { p, n };
  });
  const most = Math.max(1, ...bars.map(b => b.n));
  const inWindow = bars.filter(b => b.p >= lo && b.p <= hi).reduce((s, b) => s + b.n, 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('sections.voicePitch')}
        className={`${chipClass} ${value ? 'is-on' : ''}`}
      >
        <MicIcon size={14} />
        {label(value)}
        <DropdownChevron open={open} className="-mr-0.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('sections.voicePitch')}
          className="pop absolute top-full mt-2 z-50 p-4"
          style={{ left: place.left, width: place.width }}
        >
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <span className="text-white/60 text-xs">{t('sections.voicePitch')}</span>
            {shown && <span className="text-white font-semibold text-sm tabular-nums">{label(shown)}</span>}
          </div>

          {/* the songs at each pitch, the window's lit */}
          <div className="relative h-14 flex items-end gap-px px-[9px]" aria-hidden="true">
            {bars.map(b => (
              <div
                key={b.p}
                className={`flex-1 rounded-t-sm transition-colors ${b.p >= lo && b.p <= hi ? 'bg-hot/70' : 'bg-white/15'}`}
                style={{ height: `${Math.max(b.n ? 6 : 2, (b.n / most) * 100)}%` }}
              />
            ))}
          </div>

          <div className="range-dual mt-1">
            <div className="absolute left-[9px] right-[9px] top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/20">
              <div className="absolute h-full rounded-full bg-hot" style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }} />
            </div>
            <input
              type="range" min={VOICE_MIN} max={VOICE_MAX} step={1} value={lo}
              onChange={e => setEnds([Math.min(Number(e.target.value), hi), hi])}
              aria-label={t('sections.voiceFrom')}
              aria-valuetext={lo === VOICE_MIN ? t('sections.voiceLowest') : noteName(lo, lang)}
              style={{ zIndex: lo > VOICE_MAX - 3 ? 3 : 2 }}
            />
            <input
              type="range" min={VOICE_MIN} max={VOICE_MAX} step={1} value={hi}
              onChange={e => setEnds([lo, Math.max(Number(e.target.value), lo)])}
              aria-label={t('sections.voiceTo')}
              aria-valuetext={hi === VOICE_MAX ? t('sections.voiceHighest') : noteName(hi, lang)}
              style={{ zIndex: 2 }}
            />
          </div>

          {/* the notes where they are on the slider, and which way is which */}
          <div className="relative h-4 mt-1 mx-[9px] text-[11px] text-white/45 tabular-nums" aria-hidden="true">
            {[VOICE_MIN, 60, VOICE_MAX].map(p => (
              <span key={p} className="absolute -translate-x-1/2" style={{ left: pct(p) }}>{noteName(p, lang)}</span>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-white/30" aria-hidden="true">
            <span>← {t('sections.voiceLower')}</span>
            {counts && shown && <span className="text-white/50 tabular-nums">{t('again.songs', { count: inWindow })}</span>}
            <span>{t('sections.voiceHigher')} →</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceFilter;
