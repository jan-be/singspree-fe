import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMeasure from 'react-use-measure';
import { list, panel } from './AdminParts';
import { bucketMiddle, formatPeople, loadRows, loadSummary, loadTotals, niceTop, siteColour, timeMarks } from '../logic/siteLoad';
import type { SiteLoad } from '../logic/authApi';

/**
 * The Sites tab's chart of people in a song at once: a line per site over the
 * chosen days (logic/siteLoad.ts has the arithmetic, the backend's
 * siteLoad.ts the counting). Each site's average and highest point stand
 * beside its name; pointing at a moment says every site's number then; the
 * same numbers are a table underneath. Hand-drawn SVG like the trends: a
 * chart library would weigh more than the whole admin page.
 */

const HEIGHT = 176;
const LABEL_BAND = 12; // room above the top gridline for its label
const PANEL = '#221c42';

interface Line { name: string; colour: string; players: number[]; average: number; peak: number }

const path = (run: [number, number][]) => run.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

/** The gridlines, the marks of the days and the lines. Drawn once per data and size, not on every pointer move. */
const Plot = memo(({ lines, xs, width, top, topLabel, midLabel, marks }: {
  lines: Line[]; xs: number[]; width: number; top: number; topLabel: string; midLabel: string; marks: { x: number; day: boolean }[];
}) => {
  const base = HEIGHT - 0.5;
  const y = (v: number) => base - (Math.min(v, top) / top) * (base - LABEL_BAND);
  // A site nobody sings at lies on the baseline for hours; three colours drawn there are only a striped baseline.
  // So a line is drawn where its site has people, and the points next to that, where it leaves and reaches the ground.
  const runs = (players: number[]) => {
    const lively = (i: number) => (players[i - 1] ?? 0) > 0 || (players[i] ?? 0) > 0 || (players[i + 1] ?? 0) > 0;
    const out: [number, number][][] = [];
    let run: [number, number][] | null = null;
    players.forEach((v, i) => {
      if (!lively(i)) { run = null; return; }
      if (!run) out.push(run = []);
      run.push([xs[i] ?? 0, y(v)]);
    });
    return out;
  };
  const mid = Math.round(y(top / 2)) + 0.5;
  return (
    <g>
      {marks.map(m => <line key={m.x} x1={m.x} x2={m.x} y1={LABEL_BAND} y2={base} className={m.day ? 'stroke-white/[0.09]' : 'stroke-white/[0.05]'} />)}
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

/** What every site had at the marked moment, above the chart, kept inside the card */
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

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/45 whitespace-nowrap';
const td = 'px-3 py-1.5 text-sm text-white/85 tabular-nums whitespace-nowrap';

const AdminSiteLoad = ({ load, sites }: { load: SiteLoad; sites: { name: string; number: number }[] }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [measure, { width }] = useMeasure();
  const [marked, setMarked] = useState<number | null>(null);

  const lines = useMemo<Line[]>(() => load.sites.map((s) => {
    const { average, peak } = loadSummary(s.players, load.bucketMs, load.lastMs);
    return { name: s.site, colour: siteColour(sites.find(x => x.name === s.site)?.number ?? 0), players: s.players, average, peak };
  }), [load, sites]);
  const totals = useMemo(() => loadTotals(load), [load]);
  const rows = useMemo(() => loadRows(load), [load]);
  const n = lines[0]?.players.length ?? 0;
  const to = load.from + n * load.bucketMs;
  const top = niceTop(Math.max(0, ...lines.map(l => l.peak)));
  const x = (time: number) => ((time - load.from) / Math.max(1, to - load.from)) * width;
  const xs = useMemo(() => Array.from({ length: n }, (_, i) => x(bucketMiddle(load, i, n))), [load, n, width]); // eslint-disable-line react-hooks/exhaustive-deps
  const marks = useMemo(() => timeMarks(load.from, to), [load.from, to]);
  const index = marked !== null && marked < n ? marked : null;
  const quiet = lines.every(l => l.peak === 0);
  const hourly = load.bucketMs < 24 * 3_600_000;

  const time = (ms: number) => new Date(ms).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const day = (ms: number, weekday = true) => new Date(ms).toLocaleDateString(lang, { ...(weekday ? { weekday: 'short' as const } : {}), day: 'numeric', month: 'short' });
  const when = (i: number) => {
    const start = load.from + i * load.bucketMs;
    return hourly ? `${day(start)}, ${time(start)} – ${time(start + load.bucketMs)}` : day(bucketMiddle(load, i, n));
  };

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
    setMarked(Math.min(n - 1, Math.max(0, (index ?? n - 1) + moves[e.key])));
  };
  const base = HEIGHT - 0.5;
  const y = (v: number) => base - (Math.min(v, top) / top) * (base - LABEL_BAND);

  return (
    <>
      <div className={`${panel} px-3.5 sm:px-4 pt-3 pb-2.5 min-w-0`}>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {lines.map(l => (
            <li key={l.name} className="flex items-baseline gap-1.5 text-xs text-white/55">
              <span className="inline-block w-3.5 h-0.5 rounded-full self-center flex-shrink-0" style={{ background: l.colour }} aria-hidden="true" />
              <span className="text-sm font-semibold text-white/90">{l.name}</span>
              <span className="tabular-nums">{t('admin.sites.load.numbers', { average: formatPeople(l.average, lang), peak: formatPeople(l.peak, lang) })}</span>
            </li>
          ))}
        </ul>
        <div
          ref={measure}
          tabIndex={0}
          role="img"
          aria-label={lines.map(l => t('admin.sites.load.spoken', { site: l.name, average: formatPeople(l.average, lang), peak: formatPeople(l.peak, lang) })).join(' ')}
          className="relative mt-2 cursor-crosshair select-none touch-pan-y rounded outline-none focus-visible:ring-1 focus-visible:ring-white/50"
          style={{ height: HEIGHT }}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setMarked(null); }}
          onKeyDown={step}
          onFocus={() => setMarked(m => m ?? n - 1)}
          onBlur={() => setMarked(null)}
        >
          {width > 0 && n > 0 && (
            <svg width={width} height={HEIGHT} className="block overflow-visible" aria-hidden="true">
              <Plot
                lines={lines} xs={xs} width={width} top={top} topLabel={formatPeople(top, lang)} midLabel={formatPeople(top / 2, lang)}
                marks={marks.map(m => ({ x: Math.round(x(m.at)) + 0.5, day: m.day }))}
              />
              {index !== null && (
                <g pointerEvents="none">
                  <line x1={xs[index]} x2={xs[index]} y1={LABEL_BAND} y2={base} className="stroke-white/30" />
                  {lines.map(l => <circle key={l.name} cx={xs[index]} cy={y(l.players[index] ?? 0)} r={4} strokeWidth={2} fill={l.colour} stroke={PANEL} />)}
                </g>
              )}
            </svg>
          )}
          {quiet && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40 pointer-events-none">{t('admin.sites.load.none')}</div>}
          {index !== null && <Tooltip when={when(index)} lines={lines} index={index} total={totals[index] ?? 0} running={index === n - 1} x={xs[index] ?? 0} width={width} />}
        </div>
        {width > 0 && (
          <div className="relative h-4 mt-1 text-[10px] text-white/40" aria-hidden="true">
            {marks.map((m, i) => {
              const left = x(m.at);
              // (a label that would run out of the card, or into the one before it, is left out)
              const prev = marks[i - 1];
              if (left > width - 34 || (prev && left - x(prev.at) < 38)) return null;
              return <span key={m.at} className="absolute top-0 whitespace-nowrap" style={{ left }}>{m.day ? day(m.at, marks.length <= 8 && to - load.from > 36 * 3_600_000) : time(m.at)}</span>;
            })}
          </div>
        )}
      </div>

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
                <tr key={r.from}>
                  <th scope="row" className={`${td} text-left font-normal`}>{r.hour ? `${day(r.from)}, ${time(r.from)}` : day(r.from)}</th>
                  {r.players.map((v, k) => <td key={lines[k]?.name ?? k} className={`${td} text-right ${v > 0 ? '' : 'text-white/30'}`}>{formatPeople(v, lang)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
};

export default AdminSiteLoad;
