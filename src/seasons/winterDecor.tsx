import { Drift, Snow, Snowflake } from "./snow";

// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: icicles along the
// top, a big ice crystal, snowflakes and falling snow (snow.tsx), snowy pines
// and a snowman on a snowdrift at the foot. Static SVG like the wall itself
// (no blur); only the crystal turns, slowly (winter.css).

/** The icicles: a frosty edge with drips of ice hanging from it, one tile repeated across the width */
const ICICLES_WIDTH = 150;
const ICICLES_HEIGHT = 48;
/** [middle, width, length] */
const DRIPS: [number, number, number][] = [
  [8, 7, 22], [21, 5, 12], [34, 9, 36], [49, 6, 16], [62, 8, 27], [76, 5, 10],
  [89, 10, 42], [104, 6, 18], [117, 8, 29], [131, 5, 13], [143, 7, 21],
];
const EDGE = 4;

const Icicles = () => (
  <svg className="absolute inset-x-0 top-0 w-full" height={ICICLES_HEIGHT} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-winter-ice" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4fbff" stopOpacity="0.8" />
        <stop offset="0.5" stopColor="#a8e0ff" stopOpacity="0.42" />
        <stop offset="1" stopColor="#7cc8ff" stopOpacity="0.12" />
      </linearGradient>
      <pattern id="season-winter-icicles" width={ICICLES_WIDTH} height={ICICLES_HEIGHT} patternUnits="userSpaceOnUse" x="50%">
        <rect width={ICICLES_WIDTH} height={EDGE + 1} fill="#eaf6ff" fillOpacity="0.5" />
        {DRIPS.map(([x, w, len]) => (
          <g key={x}>
            <path
              d={`M${x - w / 2} ${EDGE}Q${x - w / 4} ${EDGE + len * 0.55} ${x} ${EDGE + len}Q${x + w / 4} ${EDGE + len * 0.55} ${x + w / 2} ${EDGE}Z`}
              fill="url(#season-winter-ice)"
            />
            <path d={`M${x - w / 5} ${EDGE + 1}L${x - 0.6} ${EDGE + len * 0.7}`} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        ))}
      </pattern>
    </defs>
    <rect width="100%" height={ICICLES_HEIGHT} fill="url(#season-winter-icicles)" />
  </svg>
);

/** The big ice crystal: six arms with three pairs of branches each, a hexagon in the middle, a cold glow */
const CRYSTAL = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3;
  const at = (x: number, y: number) => `${(x * Math.cos(a) - y * Math.sin(a)).toFixed(2)} ${(x * Math.sin(a) + y * Math.cos(a)).toFixed(2)}`;
  // a branch at `d` from the middle, `len` long, at 60° to the arm on either side
  const branch = (d: number, len: number) => `M${at(0, -d)}L${at(-len * 0.87, -d - len * 0.5)}M${at(0, -d)}L${at(len * 0.87, -d - len * 0.5)}`;
  return `M${at(0, -9)}L${at(0, -46)}${branch(17, 11)}${branch(28, 14)}${branch(38, 8)}M${at(-3, -46)}L${at(0, -50)}L${at(3, -46)}`;
}).join("");
const HEXAGON = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3 - Math.PI / 2;
  return `${k ? "L" : "M"}${(9 * Math.cos(a)).toFixed(2)} ${(9 * Math.sin(a)).toFixed(2)}`;
}).join("") + "Z";

const Crystal = ({ className }: { className: string }) => (
  <svg viewBox="-60 -60 120 120" className={`season-winter-crystal absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-winter-crystal-glow">
        <stop offset="0.1" stopColor="#d8f1ff" stopOpacity="0.42" />
        <stop offset="0.5" stopColor="#8fd2ff" stopOpacity="0.12" />
        <stop offset="1" stopColor="#8fd2ff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle r="60" fill="url(#season-winter-crystal-glow)" />
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={CRYSTAL + HEXAGON} stroke="#7cc8ff" strokeOpacity="0.35" strokeWidth="5" />
      <path d={CRYSTAL + HEXAGON} stroke="#f2faff" strokeWidth="2" />
    </g>
  </svg>
);

/** A pine in four tiers, each with snow on its shoulders */
const pine = (cx: number, base: number, height: number, width: number) => {
  const trunk = height * 0.1;
  const top = base - trunk - height * 0.9;
  const tiers = Array.from({ length: 4 }, (_, i) => {
    const ty = top + (i * height * 0.9) / 4.6;
    const tb = top + ((i + 1.6) * height * 0.9) / 4.6; // (the last one down to the trunk)
    const hw = (width / 2) * (0.42 + i * 0.19);
    const yc = ty + (tb - ty) * 0.42;
    const cw = hw * 0.42;
    return {
      tier: `M${cx} ${ty}L${cx + hw} ${tb}Q${cx} ${tb - 5} ${cx - hw} ${tb}Z`,
      snow: `M${cx} ${ty}L${cx - cw} ${yc}Q${cx - cw * 0.66} ${yc + 4} ${cx - cw / 3} ${yc}Q${cx} ${yc + 5} ${cx + cw / 3} ${yc}Q${cx + cw * 0.66} ${yc + 4} ${cx + cw} ${yc}Z`,
    };
  });
  return { trunk: `M${cx - 3.5} ${base - trunk - 2}h7v${trunk + 2}h-7Z`, tiers };
};
const PINES = [pine(46, 124, 116, 70), pine(102, 124, 82, 52), pine(134, 124, 54, 36)];

const Pines = ({ className }: { className: string }) => (
  <svg viewBox="0 0 160 130" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-winter-pine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2f6a86" />
        <stop offset="1" stopColor="#0f2c40" />
      </linearGradient>
    </defs>
    {PINES.map(({ trunk, tiers }, p) => (
      <g key={p}>
        <path d={trunk} fill="#3a2f2b" />
        {tiers.map((t, i) => <path key={i} d={t.tier} fill="url(#season-winter-pine)" stroke="#0a2233" strokeWidth="0.8" />)}
        {tiers.map((t, i) => <path key={`s${i}`} d={t.snow} fill="#eef6ff" fillOpacity="0.92" />)}
      </g>
    ))}
    <ellipse cx="88" cy="125" rx="78" ry="5" fill="#eef6ff" fillOpacity="0.35" />
  </svg>
);

/** A snowman in a top hat and an ice-blue scarf, twigs for arms */
const Snowman = ({ className }: { className: string }) => (
  <svg viewBox="0 0 90 130" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-winter-snowball" cx="36%" cy="30%" r="75%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.6" stopColor="#dbe9f8" />
        <stop offset="1" stopColor="#a6c0de" />
      </radialGradient>
    </defs>
    <ellipse cx="45" cy="123" rx="34" ry="5" fill="#eef6ff" fillOpacity="0.35" />
    <g fill="none" stroke="#6b4a33" strokeWidth="2.4" strokeLinecap="round">
      <path d="M30 60L9 45M15 49L11 40M15 49L6 50" />
      <path d="M60 60L81 47M76 50L84 53M76 50L78 41" />
    </g>
    <circle cx="45" cy="98" r="25" fill="url(#season-winter-snowball)" />
    <circle cx="45" cy="62" r="18" fill="url(#season-winter-snowball)" />
    <circle cx="45" cy="33" r="13" fill="url(#season-winter-snowball)" />
    <g fill="#1d2433">
      <circle cx="45" cy="56" r="2" />
      <circle cx="45" cy="64" r="2" />
      <circle cx="45" cy="72" r="2" />
      <circle cx="45" cy="88" r="2.2" />
      <circle cx="40.5" cy="30" r="1.8" />
      <circle cx="49.5" cy="30" r="1.8" />
      {[[38.5, 37], [41.5, 39], [45, 39.8], [48.5, 39], [51.5, 37]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" />)}
    </g>
    <path d="M45 32.6L58 35.4L45 36.6Z" fill="#ff8a3d" />
    <path d="M31 43Q45 50 59 43L59 48.5Q45 55.5 31 48.5Z" fill="#4fb6ff" />
    <path d="M51 48L55 63L61.5 61L56.5 46.5Z" fill="#3a8fe0" />
    <path d="M53.6 55.5L58.6 54M54.9 60L60.4 58.4" stroke="#e8f6ff" strokeWidth="1.3" />
    <path d="M38 47.6V51.4M44 49V52.8M50 48.2V52" stroke="#e8f6ff" strokeWidth="1.3" />
    <ellipse cx="45" cy="21.5" rx="15" ry="3.2" fill="#1a2440" />
    <rect x="36" y="4" width="18" height="18" rx="1.5" fill="#202c4c" />
    <rect x="36" y="16" width="18" height="3.6" fill="#7cc8ff" />
  </svg>
);

const WinterDecor = () => (
  <>
    <Snow id="season-winter" top={24} />
    <Icicles />
    <Crystal className="right-2 top-[46px] w-[70px] sm:w-[96px] lg:right-auto lg:left-[calc(50%+300px)] lg:top-[50px] lg:w-[130px]" />
    <Snowflake colour="#dff3ff" className="hidden sm:block left-[calc(50%-330px)] top-[96px] sm:w-[26px] lg:left-[calc(50%-430px)] lg:top-[110px] lg:w-[34px] rotate-[10deg]" />
    <Snowflake colour="#dff3ff" className="hidden lg:block left-[calc(50%-300px)] top-[70px] w-[22px]" />
    <Snowflake colour="#dff3ff" className="hidden md:block left-[calc(50%-520px)] top-[210px] w-[24px] rotate-[22deg]" />
    <Snowflake colour="#dff3ff" className="hidden sm:block right-[10%] top-[170px] w-[16px] lg:right-auto lg:left-[calc(50%+470px)] lg:top-[190px] lg:w-[28px] rotate-[-14deg]" />
    <Snowflake colour="#dff3ff" className="hidden lg:block left-[calc(50%+240px)] top-[200px] w-[18px]" />
    <Snowflake colour="#dff3ff" className="hidden xl:block left-[calc(50%+560px)] top-[90px] w-[20px] rotate-[30deg]" />
    <Drift id="season-winter" />
    <Pines className="left-1 bottom-1 w-[72px] sm:w-[100px] md:left-[calc(50%-380px)] md:bottom-2 lg:left-[calc(50%-480px)] lg:w-[150px]" />
    <Snowman className="right-2 bottom-1 w-[44px] sm:w-[60px] md:right-auto md:left-[calc(50%+260px)] md:bottom-2 lg:left-[calc(50%+310px)] lg:w-[84px]" />
  </>
);

export default WinterDecor;
