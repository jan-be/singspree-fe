import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMeasure from 'react-use-measure';
import { list, panel } from './AdminParts';
import { bucketMiddle, formatPeople, hourIn, hourTime, loadRows, loadSummary, loadTotals, niceTop, siteColour, timeMarks } from '../logic/siteLoad';
import type { SiteHours, SiteLoad } from '../logic/authApi';

/**
 * The Sites tab's charts of people in a song at once, a line per site: over
 * the chosen days (AdminSiteLoad), and over the hours of a day
 * (AdminSiteHours), which shows when each site is busy. logic/siteLoad.ts has
 * the arithmetic, the backend's siteLoad.ts the counting. What a site's line
 * comes to stands beside its name; pointing at a point says every site's
 * number there; the same numbers are a table underneath. Hand-drawn SVG like
 * the trends: a chart library would weigh more than the whole admin page.
 */

const HEIGHT = 176;
const LABEL_BAND = 12; // room above the top gridline for its label
const PANEL = '#221c42';
const HOUR = 3_600_000;

/** A site's line, and the words beside its name (`note`) and for a screen reader (`spoken`) */
interface Line { name: string; colour: string; players: number[]; note: string; spoken: string }

/** A labelled place on the axis: `at` from 0 to 1 across; `strong` for a day's start */
interface Mark { at: number; label: string; strong: boolean }

const path = (run: [number, number][]) => run.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

/**
 * The gridlines, the marks of the axis and the lines. Drawn once per data and size, not on every pointer move.
 * `wrap`: the line goes round (a day's hours): its ends meet the edges halfway between the last point and the first.
 */
const Plot = memo(({ lines, xs, width, top, topLabel, midLabel, marks, wrap }: {
  lines: Line[]; xs: number[]; width: number; top: number; topLabel: string; midLabel: string; marks: { x: number; strong: boolean }[]; wrap: boolean;
}) => {
  const base = HEIGHT - 0.5;
  const y = (v: number) => base - (Math.min(v, top) / top) * (base - LABEL_BAND);
  // A site nobody sings at lies on the baseline for hours; three colours drawn there are only a striped baseline.
  // So a line is drawn where its site has people, and the points next to that, where it leaves and reaches the ground.
  const runs = (players: number[]) => {
    let points = players.map((v, i): [number, number] => [xs[i] ?? 0, v]);
    if (wrap && players.length > 1) {
      const edge = ((players[0] ?? 0) + (players[players.length - 1] ?? 0)) / 2;
      points = [[0, edge], ...points, [width, edge]];
    }
    const lively = (i: number) => (points[i - 1]?.[1] ?? 0) > 0 || (points[i]?.[1] ?? 0) > 0 || (points[i + 1]?.[1] ?? 0) > 0;
    const out: [number, number][][] = [];
    let run: [number, number][] | null = null;
    points.forEach(([px, v], i) => {
      if (!lively(i)) { run = null; return; }
      if (!run) out.push(run = []);
      run.push([px, y(v)]);
    });
    return out;
  };
  const mid = Math.round(y(top / 2)) + 0.5;
  return (
    <g>
      {marks.map(m => <line key={m.x} x1={m.x} x2={m.x} y1={LABEL_BAND} y2={base} className={m.strong ? 'stroke-white/[0.09]' : 'stroke-white/[0.05]'} />)}
      <line x1={0} x2={width} y1={LABEL_BAND + 0.5} y2={LABEL_BAND + 0.5} className="stroke-white/10" />
      <line x1={0} x2={width} y1={mid} y2={mid} className="stroke-white/[0.07]" />
      <line x1={0} x2={width} y1={base} y2={base} className="stroke-white/20" />
      <text x={0} y={LABEL_BAND - 3} className="fill-white/40 tabular-nums" fontSize={9.5}>{topLabel}</text>
      <text x={0} y={mid - 3} className="fill-white/30 tabular-nums" fontSize={9.5}>{midLabel}</text>
      {lines.map(l => runs(l.players).map(run => (run.length === 1
        ? <circle key={`${l.name}:${run[0][0]}`} cx={run[0][0]} cy={run[0][1]} r={1.5} fill={l.colour} />
        : <path key={`${l.name}:${run[0][0]}`} d={path(run)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" stroke={l.colour} />)))}
    </g>
  );
});

/** What every site had at the marked point, above the chart, kept inside the card */
const Tooltip = ({ when, lines, index, total, running, x, width }: {
  when: string; lines: Line[]; index: number; total: number; running: boolean; x: number; width: number;
}) => {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(x - w / 2, 0), Math.max(0, width - w))}px`;
  });
  return (
    <div ref={ref} role="tooltip" className="pop absolute z-20 pointer-events-none rounded-xl px-3 py-2 text-xs leading-snug whitespace-nowrap" style={{ bottom: 'calc(100% + 6px)', left: 0 }}>
      <div className="text-white/55">{when}{running && <span className="text-white/40"> · {t('admin.sites.load.soFar')}</span>}</div>
      {lines.map(l => (
        <div key={l.name} className="mt-0.5 flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded-full flex-shrink-0" style={{ background: l.colour }} aria-hidden="true" />
          <span className="font-semibold tabular-nums text-white">{formatPeople(l.players[index] ?? 0, i18n.language)}</span>
          <span className="text-white/55">{l.name}</span>
        </div>
      ))}
      {lines.length > 1 && (
        <div className="mt-1 pt-1 border-t border-white/10 text-white/55">
          <span className="font-semibold tabular-nums text-white/85">{formatPeople(total, i18n.language)}</span> {t('admin.sites.load.together')}
        </div>
      )}
    </div>
  );
};

/**
 * A card with a line per site: the sites and their notes above, the lines, a point marked by pointer or keys with
 * every site's number there (`when` names it; `running(i)`: it is still going), and the axis' labels below.
 * `positions`: each point's place across, 0 to 1; `first`: the point the keys start at.
 */
const SiteLines = ({ lines, totals, positions, marks, wrap = false, when, running, first }: {
  lines: Line[]; totals: number[]; positions: number[]; marks: Mark[]; wrap?: boolean;
  when: (i: number) => string; running?: (i: number) => boolean; first: number;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [measure, { width }] = useMeasure();
  const [marked, setMarked] = useState<number | null>(null);
  const n = positions.length;
  const xs = useMemo(() => positions.map(p => p * width), [positions, width]);
  const peak = Math.max(0, ...lines.flatMap(l => l.players));
  const top = niceTop(peak);
  const index = marked !== null && marked < n ? marked : null;

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    // (the nearest point: the running stretch's sits left of its slot's middle)
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(v - px) < Math.abs((xs[best] ?? 0) - px)) best = i; });
    setMarked(best);
  };
  const step = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setMarked(Math.min(n - 1, Math.max(0, (index ?? first) + moves[e.key])));
  };
  const base = HEIGHT - 0.5;
  const y = (v: number) => base - (Math.min(v, top) / top) * (base - LABEL_BAND);

  return (
    <div className={`${panel} px-3.5 sm:px-4 pt-3 pb-2.5 min-w-0`}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {lines.map(l => (
          <li key={l.name} className="flex items-baseline gap-1.5 text-xs text-white/55">
            <span className="inline-block w-3.5 h-0.5 rounded-full self-center flex-shrink-0" style={{ background: l.colour }} aria-hidden="true" />
            <span className="text-sm font-semibold text-white/90">{l.name}</span>
            <span className="tabular-nums">{l.note}</span>
          </li>
        ))}
      </ul>
      <div
        ref={measure}
        tabIndex={0}
        role="img"
        aria-label={lines.map(l => l.spoken).join(' ')}
        className="relative mt-2 cursor-crosshair select-none touch-pan-y rounded outline-none focus-visible:ring-1 focus-visible:ring-white/50"
        style={{ height: HEIGHT }}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setMarked(null); }}
        onKeyDown={step}
        onFocus={() => setMarked(m => m ?? first)}
        onBlur={() => setMarked(null)}
      >
        {width > 0 && n > 0 && (
          <svg width={width} height={HEIGHT} className="block overflow-visible" aria-hidden="true">
            <Plot
              lines={lines} xs={xs} width={width} top={top} topLabel={formatPeople(top, lang)} midLabel={formatPeople(top / 2, lang)} wrap={wrap}
              marks={marks.map(m => ({ x: Math.round(m.at * width) + 0.5, strong: m.strong }))}
            />
            {index !== null && (
              <g pointerEvents="none">
                <line x1={xs[index]} x2={xs[index]} y1={LABEL_BAND} y2={base} className="stroke-white/30" />
                {lines.map(l => <circle key={l.name} cx={xs[index]} cy={y(l.players[index] ?? 0)} r={4} strokeWidth={2} fill={l.colour} stroke={PANEL} />)}
              </g>
            )}
          </svg>
        )}
        {!(peak > 0) && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40 pointer-events-none">{t('admin.sites.load.none')}</div>}
        {index !== null && <Tooltip when={when(index)} lines={lines} index={index} total={totals[index] ?? 0} running={running?.(index) ?? false} x={xs[index] ?? 0} width={width} />}
      </div>
      {width > 0 && (
        <div className="relative h-4 mt-1 text-[10px] text-white/40" aria-hidden="true">
          {(() => {
            // A label that would run out of the card (into its padding is fine), or into the one shown before it, is
            // left out. Its width from its length: up to 6 px a character at this size ("03:00 AM" 47 px, "Mon, Nov 23" 57).
            let free = 0;
            return marks.map((m) => {
              const left = m.at * width;
              const right = left + m.label.length * 6;
              if (left < free || right > width + 12) return null;
              free = right + 6;
              return <span key={m.at} className="absolute top-0 whitespace-nowrap" style={{ left }}>{m.label}</span>;
            });
          })()}
        </div>
      )}
    </div>
  );
};

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/45 whitespace-nowrap';
const td = 'px-3 py-1.5 text-sm text-white/85 tabular-nums whitespace-nowrap';

/** The same numbers as a table, folded away: a row per stretch, a column per site */
const SiteTable = ({ lines, rows }: { lines: Line[]; rows: { key: number; label: string; players: number[] }[] }) => {
  const { t, i18n } = useTranslation();
  return (
    <details className="mt-2 group">
      <summary className="cursor-pointer select-none text-xs text-white/45 hover:text-white/70 w-fit">{t('admin.sites.load.table')}</summary>
      <div className={`${list} overflow-x-auto mt-2 max-h-80 overflow-y-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={th}>{t('admin.sites.load.when')}</th>
              {lines.map(l => <th key={l.name} scope="col" className={`${th} text-right`}>{l.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.07]">
            {rows.map(r => (
              <tr key={r.key}>
                <th scope="row" className={`${td} text-left font-normal`}>{r.label}</th>
                {r.players.map((v, k) => <td key={lines[k]?.name ?? k} className={`${td} text-right ${v > 0 ? '' : 'text-white/30'}`}>{formatPeople(v, i18n.language)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

const clock = (ms: number, lang: string) => new Date(ms).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
const date = (ms: number, lang: string, weekday = true) =>
  new Date(ms).toLocaleDateString(lang, { ...(weekday ? { weekday: 'short' as const } : {}), day: 'numeric', month: 'short' });

type SiteNumbers = { name: string; number: number }[];
const colourOf = (sites: SiteNumbers, name: string) => siteColour(sites.find(x => x.name === name)?.number ?? 0);

/** People in a song at once over the chosen days: each site's average and highest point beside its name */
const AdminSiteLoad = ({ load, sites }: { load: SiteLoad; sites: SiteNumbers }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const n = load.sites[0]?.players.length ?? 0;
  const to = load.from + n * load.bucketMs;
  const span = Math.max(1, to - load.from);

  const lines = useMemo<Line[]>(() => load.sites.map((s) => {
    const { average, peak } = loadSummary(s.players, load.bucketMs, load.lastMs);
    const numbers = { site: s.site, average: formatPeople(average, lang), peak: formatPeople(peak, lang) };
    return { name: s.site, colour: colourOf(sites, s.site), players: s.players, note: t('admin.sites.load.numbers', numbers), spoken: t('admin.sites.load.spoken', numbers) };
  }), [load, sites, lang, t]);
  const totals = useMemo(() => loadTotals(load), [load]);
  const positions = useMemo(() => Array.from({ length: n }, (_, i) => (bucketMiddle(load, i, n) - load.from) / span), [load, n, span]);
  const marks = useMemo<Mark[]>(() => {
    const at = timeMarks(load.from, to);
    const weekday = at.length <= 8 && to - load.from > 36 * HOUR;
    return at.map(m => ({ at: (m.at - load.from) / span, strong: m.day, label: m.day ? date(m.at, lang, weekday) : clock(m.at, lang) }));
  }, [load.from, to, span, lang]);
  const rows = useMemo(() => loadRows(load).map(r => ({
    key: r.from, label: r.hour ? `${date(r.from, lang)}, ${clock(r.from, lang)}` : date(r.from, lang), players: r.players,
  })), [load, lang]);

  const hourly = load.bucketMs < 24 * HOUR;
  const when = (i: number) => {
    const start = load.from + i * load.bucketMs;
    return hourly ? `${date(start, lang)}, ${clock(start, lang)} – ${clock(start + load.bucketMs, lang)}` : date(bucketMiddle(load, i, n), lang);
  };

  return (
    <>
      <SiteLines lines={lines} totals={totals} positions={positions} marks={marks} when={when} running={i => i === n - 1} first={n - 1} />
      <SiteTable lines={lines} rows={rows} />
    </>
  );
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_POSITIONS = HOURS.map(h => (h + 0.5) / 24);

/**
 * People in a song at once per hour of the day, in the time zone the hours came in: when each site is busy. Beside
 * each site's name its busiest hour.
 */
export const AdminSiteHours = ({ hours, sites }: { hours: SiteHours; sites: SiteNumbers }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const hourSpan = (h: number) => `${hourTime(h, lang)} – ${hourTime(h + 1, lang)}`;

  const lines = useMemo<Line[]>(() => hours.sites.map((s) => {
    const { peak, peakIndex } = loadSummary(s.players, HOUR, HOUR);
    const numbers = { site: s.site, hour: peakIndex === null ? '' : `${hourTime(peakIndex, lang)} – ${hourTime(peakIndex + 1, lang)}`, peak: formatPeople(peak, lang) };
    return {
      name: s.site, colour: colourOf(sites, s.site), players: s.players,
      note: peakIndex === null ? t('admin.sites.hours.nobody') : t('admin.sites.hours.busiest', numbers),
      spoken: peakIndex === null ? t('admin.sites.hours.spokenNobody', numbers) : t('admin.sites.hours.spoken', numbers),
    };
  }), [hours, sites, lang, t]);
  const totals = useMemo(() => loadTotals(hours), [hours]);
  const marks = useMemo<Mark[]>(() => HOURS.filter(h => h % 3 === 0).map(h => ({ at: h / 24, label: hourTime(h, lang), strong: h % 12 === 0 })), [lang]);
  const rows = useMemo(() => HOURS.map(h => ({
    key: h, label: `${hourTime(h, lang)} – ${hourTime(h + 1, lang)}`, players: hours.sites.map(s => s.players[h] ?? 0),
  })), [hours, lang]);

  return (
    <>
      <SiteLines lines={lines} totals={totals} positions={HOUR_POSITIONS} marks={marks} wrap when={hourSpan} first={hourIn(hours.zone)} />
      <SiteTable lines={lines} rows={rows} />
    </>
  );
};

export default AdminSiteLoad;
