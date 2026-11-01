// Snow for the hero wall of the snowy seasons (winter.tsx, christmas.tsx):
// a tile of drifting flakes, single snowflakes and a drift along the foot.
// Static SVG; `id` keeps each season's definitions apart ('season-winter').

/** Snow drifting down the wall: a sparse tile of flakes in a few sizes */
const SNOW: [number, number, number, number][] = [
  [18, 22, 1.6, 0.5], [92, 8, 1.1, 0.35], [150, 46, 2.1, 0.45], [60, 78, 1.3, 0.4], [124, 104, 1.8, 0.5],
  [30, 132, 1.2, 0.3], [178, 150, 1.5, 0.4], [88, 168, 2.2, 0.35], [200, 70, 1.1, 0.3], [6, 190, 1.7, 0.45],
];

/** The falling snow, from `top` down (below the lights or icicles along the top) */
export const Snow = ({ id, top = 0 }: { id: string; top?: number }) => (
  <svg className="absolute inset-0 w-full h-full" aria-hidden="true" focusable="false">
    <defs>
      <pattern id={`${id}-snow`} width="220" height="210" patternUnits="userSpaceOnUse" x="50%">
        {SNOW.map(([x, y, r, o]) => <circle key={`${x} ${y}`} cx={x} cy={y} r={r} fill="#eef5ff" fillOpacity={o} />)}
      </pattern>
    </defs>
    <rect y={top} width="100%" height="100%" fill={`url(#${id}-snow)`} />
  </svg>
);

/** A six-armed snowflake, 24 × 24 around its middle */
const FLAKE = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3;
  const at = (x: number, y: number) => `${(x * Math.cos(a) - y * Math.sin(a)).toFixed(2)} ${(x * Math.sin(a) + y * Math.cos(a)).toFixed(2)}`;
  return `M0 0L${at(0, -10.5)}M${at(0, -6)}L${at(-3.2, -8.8)}M${at(0, -6)}L${at(3.2, -8.8)}M${at(0, -3)}L${at(-2.2, -5)}M${at(0, -3)}L${at(2.2, -5)}`;
}).join("");

export const Snowflake = ({ className, colour = "#eaf4ff" }: { className: string; colour?: string }) => (
  <svg viewBox="-12 -12 24 24" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={FLAKE} fill="none" stroke={colour} strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** A snowdrift along the foot of the wall */
export const Drift = ({ id }: { id: string }) => (
  <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-[22px] sm:h-[30px]" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-drift`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f2f7ff" stopOpacity="0.42" />
        <stop offset="1" stopColor="#eef5ff" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    <path d="M0 40V24C90 10 190 28 300 18S490 6 600 16S800 30 910 15S1100 8 1200 22V40Z" fill={`url(#${id}-drift)`} />
    <path d="M0 24C90 10 190 28 300 18S490 6 600 16S800 30 910 15S1100 8 1200 22" fill="none" stroke="#f6faff" strokeOpacity="0.5" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
  </svg>
);
