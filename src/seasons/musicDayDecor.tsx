// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: an open-air stage on
// a summer evening, with a lighting truss along the top throwing coloured
// beams down the wall, a low sun, music notes in the air, a stack of
// speakers and a guitar. Static SVG like the wall itself (no blur, no
// animation).

const AMBER = "#ffb53a";
const CORAL = "#ff5f6d";
const TURQUOISE = "#3be8cf";
const SUN = "#ffd84a";

/** The truss and its lights, one stretch 480 wide: three cans clamped to it, each throwing its beam down at an angle */
const SPOTS = [
  { x: 80, tilt: 16, colour: AMBER },
  { x: 240, tilt: -10, colour: CORAL },
  { x: 400, tilt: -18, colour: TURQUOISE },
];
const TRUSS_ZIGZAG = Array.from({ length: 24 }, (_, i) => `${i ? "L" : "M"}${i * 20 + 10} ${i % 2 ? 15 : 5}`).join("") + "L480 5";
const BEAM_LENGTH = 230;

/** The beam of a can at x tipped by `tilt` degrees: a cone from its lens, fading out */
const beam = (x: number, tilt: number) => {
  const a = (tilt * Math.PI) / 180;
  const at = (dx: number, dy: number) => `${(x + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(1)} ${(30 + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(1)}`;
  return `M${at(-6, 0)}L${at(6, 0)}L${at(58, BEAM_LENGTH)}L${at(-58, BEAM_LENGTH)}Z`;
};

const Truss = ({ id, scale, className }: { id: string; scale: number; className: string }) => (
  <svg className={`absolute left-0 top-0 w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      {SPOTS.map(s => (
        <linearGradient key={s.colour} id={`${id}-beam-${s.x}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.colour} stopOpacity="0.3" />
          <stop offset="0.6" stopColor={s.colour} stopOpacity="0.08" />
          <stop offset="1" stopColor={s.colour} stopOpacity="0" />
        </linearGradient>
      ))}
      <pattern id={id} width="480" height={30 + BEAM_LENGTH} patternUnits="userSpaceOnUse" x="50%" patternTransform={`scale(${scale})`}>
        {SPOTS.map(s => <path key={s.x} d={beam(s.x, s.tilt)} fill={`url(#${id}-beam-${s.x})`} />)}
        <g stroke="#d8c3b8" strokeOpacity="0.45" fill="none">
          <path d="M0 5H480M0 15H480" strokeWidth="1.6" />
          <path d={TRUSS_ZIGZAG} strokeWidth="1" />
        </g>
        {SPOTS.map(s => (
          <g key={s.x} transform={`translate(${s.x} 15) rotate(${s.tilt})`}>
            <path d="M-9 0V7H9V0" fill="none" stroke="#5b4a4f" strokeWidth="2" />
            <rect x="-8" y="4" width="16" height="13" rx="3" fill="#2a2024" stroke="#5b4a4f" strokeWidth="1" />
            <ellipse cx="0" cy="16.5" rx="7" ry="2.6" fill={s.colour} />
            <ellipse cx="-2" cy="16" rx="2.4" ry="0.9" fill="#fff" fillOpacity="0.7" />
          </g>
        ))}
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/** A low summer sun: the top whole, the bottom in bands thinning towards the horizon */
const SUN_R = 50;
const SUN_BANDS = [[6, 14], [18, 25], [29, 35], [38.5, 43], [46, 49]].map(([y1, y2]) => {
  const w = (y: number) => Math.sqrt(SUN_R * SUN_R - y * y).toFixed(1);
  return `M-${w(y1)} ${y1}L${w(y1)} ${y1}L${w(y2)} ${y2}L-${w(y2)} ${y2}Z`;
}).join("");

const Sun = ({ className }: { className: string }) => (
  <svg viewBox="-70 -70 140 125" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-music-day-sun-glow">
        <stop offset="0.45" stopColor={SUN} stopOpacity="0.28" />
        <stop offset="1" stopColor={CORAL} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="season-music-day-sun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe873" />
        <stop offset="0.55" stopColor={AMBER} />
        <stop offset="1" stopColor={CORAL} />
      </linearGradient>
    </defs>
    <circle r="70" fill="url(#season-music-day-sun-glow)" />
    <path d={`M-${SUN_R} 2A${SUN_R} ${SUN_R} 0 0 1 ${SUN_R} 2Z${SUN_BANDS}`} fill="url(#season-music-day-sun)" />
  </svg>
);

/** Notes in the air: a quaver with its flag, or two beamed together; each drawn with its head at the origin */
const Quaver = ({ colour }: { colour: string }) => (
  <g fill={colour}>
    <ellipse cx="0" cy="0" rx="6.4" ry="4.6" transform="rotate(-22)" />
    <rect x="4.6" y="-30" width="2" height="29" />
    <path d="M6.6 -30C9 -22 18 -20 16 -8C15.5 -13 11 -17 6.6 -19Z" />
  </g>
);
const Beamed = ({ colour }: { colour: string }) => (
  <g fill={colour}>
    <ellipse cx="0" cy="0" rx="6.4" ry="4.6" transform="rotate(-22)" />
    <ellipse cx="22" cy="-6" rx="6.4" ry="4.6" transform="rotate(-22 22 -6)" />
    <rect x="4.6" y="-30" width="2" height="29" />
    <rect x="26.6" y="-36" width="2" height="29" />
    <path d="M4.6 -30L28.6 -36V-30L4.6 -24Z" />
  </g>
);

const Note = ({ beamed, colour, turn = 0, className }: { beamed?: boolean; colour: string; turn?: number; className: string }) => (
  <svg viewBox={beamed ? "-10 -42 46 50" : "-10 -36 30 44"} className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g transform={`rotate(${turn} ${beamed ? 13 : 5} -14)`}>{beamed ? <Beamed colour={colour} /> : <Quaver colour={colour} />}</g>
  </svg>
);

/** A woofer or tweeter: rings round a dust cap */
const Cone = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="url(#season-music-day-cone)" stroke="#6a5a60" strokeWidth="1.2" />
    <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="1" />
    <circle cx={x} cy={y} r={r * 0.3} fill="#3b3035" stroke="#7d6c72" strokeWidth="0.8" />
  </g>
);

/** Two speaker cabinets stacked, 100 × 130 */
const Speakers = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 130" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-music-day-cone" cx="40%" cy="35%" r="75%">
        <stop offset="0" stopColor="#4b3f45" />
        <stop offset="1" stopColor="#141012" />
      </radialGradient>
    </defs>
    <rect x="6" y="56" width="88" height="72" rx="4" fill="#1d1619" stroke="#4e4146" strokeWidth="1.2" />
    <Cone x={50} y={96} r={24} />
    <Cone x={22} y={68} r={6} />
    <Cone x={78} y={68} r={6} />
    <rect x="18" y="8" width="64" height="48" rx="3.5" fill="#211a1d" stroke="#4e4146" strokeWidth="1.2" />
    <Cone x={50} y={36} r={14} />
    <circle cx="72" cy="16" r="2.2" fill={TURQUOISE} />
    <path d="M10 60H90M22 12H78" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="1.5" />
  </svg>
);

/** An acoustic guitar leaning to the right, 80 × 180 */
const Guitar = ({ className }: { className: string }) => (
  <svg viewBox="0 0 80 180" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-music-day-wood" cx="45%" cy="40%" r="70%">
        <stop offset="0" stopColor="#f2b066" />
        <stop offset="0.7" stopColor="#c46a2a" />
        <stop offset="1" stopColor="#7a3814" />
      </radialGradient>
    </defs>
    <g transform="translate(40 176) rotate(14)">
      {/* the neck and the head with its pegs */}
      <rect x="-3.6" y="-158" width="7.2" height="92" fill="#5a3216" />
      <path d="M-5 -158L-6 -176L6 -176L5 -158Z" fill="#3e2210" />
      <g fill="#e8d9b0">
        {[-172, -167, -162].map(y => <circle key={y} cx="-8" cy={y} r="1.6" />)}
        {[-172, -167, -162].map(y => <circle key={y} cx="8" cy={y} r="1.6" />)}
      </g>
      <path d="M-3.6 -140H3.6M-3.6 -126H3.6M-3.6 -113H3.6M-3.6 -101H3.6M-3.6 -90H3.6" stroke="#c9b28a" strokeOpacity="0.7" strokeWidth="0.8" />
      {/* the body: upper and lower bouts */}
      <path d="M0 -76C-15 -76 -21 -66 -19 -56C-17 -48 -27 -44 -27 -26C-27 -8 -15 0 0 0C15 0 27 -8 27 -26C27 -44 17 -48 19 -56C21 -66 15 -76 0 -76Z" fill="url(#season-music-day-wood)" stroke="#4a210b" strokeWidth="1.2" />
      <circle cx="0" cy="-48" r="7.5" fill="#1a0d06" stroke="#e8c48a" strokeWidth="1.2" />
      <rect x="-9" y="-20" width="18" height="4" rx="1.2" fill="#3e2210" />
      <g stroke="#f4ecd8" strokeOpacity="0.8" strokeWidth="0.5">
        {[-2.4, -0.8, 0.8, 2.4].map(x => <path key={x} d={`M${x} -176V-18`} />)}
      </g>
    </g>
  </svg>
);

const MusicDayDecor = () => (
  <>
    <Truss id="season-music-day-truss" scale={1} className="hidden sm:block h-[260px]" />
    <Truss id="season-music-day-truss-small" scale={0.6} className="sm:hidden h-[156px]" />
    <Sun className="hidden lg:block left-[calc(50%+330px)] top-[96px] w-[120px] xl:left-[calc(50%+400px)] xl:w-[150px]" />
    <Note colour={AMBER} className="left-3 top-[56px] w-[18px] sm:left-8 sm:top-[90px] sm:w-[24px] lg:left-[calc(50%-560px)] lg:top-[110px] lg:w-[30px]" turn={-12} />
    <Note beamed colour={TURQUOISE} className="hidden sm:block left-[calc(50%-360px)] top-[180px] w-[34px] lg:left-[calc(50%-470px)] lg:top-[220px] lg:w-[44px]" turn={8} />
    <Note colour={CORAL} className="hidden lg:block left-[calc(50%-640px)] top-[300px] w-[24px]" turn={14} />
    <Note beamed colour={SUN} className="right-3 top-[64px] w-[26px] sm:right-8 sm:top-[96px] sm:w-[32px] lg:right-auto lg:left-[calc(50%+250px)] lg:top-[70px] lg:w-[40px]" turn={-10} />
    <Note colour={TURQUOISE} className="hidden lg:block left-[calc(50%+600px)] top-[290px] w-[26px]" turn={10} />
    <Speakers className="left-2 bottom-1 w-[52px] sm:w-[68px] md:left-[calc(50%-330px)] md:bottom-2 lg:left-[calc(50%-440px)] lg:w-[100px]" />
    <Guitar className="right-2 bottom-1 w-[34px] sm:w-[46px] md:right-auto md:left-[calc(50%+260px)] md:bottom-2 lg:left-[calc(50%+300px)] lg:w-[78px]" />
  </>
);

export default MusicDayDecor;
