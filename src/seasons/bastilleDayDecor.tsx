// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: a bal populaire on
// the night of 14 July, with paper lanterns in blue, white and red strung
// along the top, fireworks over a golden-lit Eiffel Tower and an accordion.
// Static SVG like the wall itself (no blur, no animation).

const BLUE = "#3a6cf0";
const WHITE = "#f6f3ec";
const RED = "#e8303f";

/** The lantern string: a wire sagging between hooks every 260 px, five round paper lanterns a swag in turning colours */
const SWAG = 260;
const SAG = 24;
const LANTERN_COLOURS = [BLUE, WHITE, RED];
const LANTERNS = [0.14, 0.32, 0.5, 0.68, 0.86].map((t, i) => ({ i, x: SWAG * t, y: 4 + 4 * SAG * t * (1 - t), colour: LANTERN_COLOURS[i % 3], drop: i % 2 ? 10 : 4 }));
const LANTERNS_HEIGHT = 74;

const Lanterns = ({ id, scale, className }: { id: string; scale: number; className: string }) => (
  <svg className={`absolute left-0 top-0 w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      {LANTERN_COLOURS.map((c, k) => (
        <radialGradient key={c} id={`${id}-paper-${k}`} cx="45%" cy="45%" r="60%">
          <stop offset="0" stopColor="#fff8e6" />
          <stop offset="0.45" stopColor={c} />
          <stop offset="1" stopColor={c} stopOpacity="0.85" />
        </radialGradient>
      ))}
      <radialGradient id={`${id}-halo`}>
        <stop offset="0" stopColor="#ffe2a8" stopOpacity="0.35" />
        <stop offset="1" stopColor="#ffe2a8" stopOpacity="0" />
      </radialGradient>
      <pattern id={id} width={SWAG} height={LANTERNS_HEIGHT} patternUnits="userSpaceOnUse" x="50%" patternTransform={`scale(${scale})`}>
        <path d={`M0 4Q${SWAG / 2} ${4 + 2 * SAG} ${SWAG} 4`} fill="none" stroke="#c9c3d6" strokeOpacity="0.5" strokeWidth="1.3" />
        <circle cx="0" cy="4" r="2.4" fill="#c9c3d6" fillOpacity="0.7" />
        <circle cx={SWAG} cy="4" r="2.4" fill="#c9c3d6" fillOpacity="0.7" />
        {LANTERNS.map(l => {
          const k = LANTERN_COLOURS.indexOf(l.colour);
          const cy = l.y + l.drop + 14;
          return (
            <g key={l.i}>
              <circle cx={l.x} cy={cy} r="24" fill={`url(#${id}-halo)`} />
              <path d={`M${l.x} ${l.y}V${l.y + l.drop}`} stroke="#c9c3d6" strokeOpacity="0.5" strokeWidth="1" />
              <rect x={l.x - 4} y={l.y + l.drop} width="8" height="3" rx="0.8" fill="#2b2a3a" />
              <ellipse cx={l.x} cy={cy} rx="10.5" ry="11.5" fill={`url(#${id}-paper-${k})`} />
              <g fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="0.8">
                <path d={`M${l.x - 9.6} ${cy - 5}H${l.x + 9.6}M${l.x - 10.5} ${cy}H${l.x + 10.5}M${l.x - 9.6} ${cy + 5}H${l.x + 9.6}`} />
              </g>
              <rect x={l.x - 4} y={cy + 10.5} width="8" height="3" rx="0.8" fill="#2b2a3a" />
            </g>
          );
        })}
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/** A firework, 200 across around its middle: long rays ending in a star, short ones in a dot, a ring of sparks inside */
const burst = (rays: number, tilt: number) => {
  let lines = "";
  const tips: { x: number; y: number; long: boolean }[] = [];
  const ring: [number, number][] = [];
  for (let i = 0; i < rays; i++) {
    const a = ((i / rays) * 360 + tilt) * (Math.PI / 180);
    const long = i % 2 === 0;
    const r0 = long ? 22 : 30, r1 = long ? 78 : 58;
    lines += `M${(r0 * Math.cos(a)).toFixed(1)} ${(r0 * Math.sin(a)).toFixed(1)}L${(r1 * Math.cos(a)).toFixed(1)} ${(r1 * Math.sin(a)).toFixed(1)}`;
    const rt = long ? 88 : 65;
    tips.push({ x: rt * Math.cos(a), y: rt * Math.sin(a), long });
    const b = a + Math.PI / rays;
    ring.push([16 * Math.cos(b), 16 * Math.sin(b)]);
  }
  return { lines, tips, ring };
};
const BURST_BIG = burst(16, 0);
const BURST_SMALL = burst(12, 8);

const Firework = ({ colour, small, className }: { colour: string; small?: boolean; className: string }) => {
  const shape = small ? BURST_SMALL : BURST_BIG;
  const key = colour.slice(1);
  return (
    <svg viewBox="-100 -100 200 200" className={`absolute ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`season-bastille-day-glow-${key}`}>
          <stop offset="0" stopColor={colour} stopOpacity="0.28" />
          <stop offset="1" stopColor={colour} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="80" fill={`url(#season-bastille-day-glow-${key})`} />
      <path d={shape.lines} stroke={colour} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="10 5" fill="none" />
      <g fill={colour}>
        {shape.ring.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2" />)}
      </g>
      <g fill="#ffffff">
        {shape.tips.map((t, i) => t.long
          ? <path key={i} d={`M${t.x.toFixed(1)} ${(t.y - 6).toFixed(1)}l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6Z`} />
          : <circle key={i} cx={t.x.toFixed(1)} cy={t.y.toFixed(1)} r="2.6" />)}
      </g>
    </svg>
  );
};

// The Eiffel Tower, 120 × 300 around x 60 (330 m to the tip of the mast, so a
// unit is 1.1 m), its four feet (two seen) on the ground at y 300. Its sides
// are one concave curve, half-width w(y): 4.5 at the top platform (y 54), 57
// at the feet, rising as a power of the depth below the top, so the shaft is
// nearly upright high up and the legs splay out low down. The legs stand
// apart up to the second floor: the great arch under the first floor, a
// narrower opening between the first and second.
const TOP = 54;
const GROUND = 300;
const w = (y: number) => 4.5 + 52.5 * ((y - TOP) / (GROUND - TOP)) ** 2.32;
const n1 = (v: number) => v.toFixed(1);
/** A point on the tower's left edge at height y, or its mirror on the right */
const edge = (y: number, side: -1 | 1) => `${n1(60 + side * w(y))} ${n1(y)}`;

const SIDE_YS = Array.from({ length: 31 }, (_, i) => TOP + ((GROUND - TOP) * i) / 30);
/** The great arch between the feet, from the left foot's inner corner up under the first floor */
const ARCH: [number, number][] = [[24, 300], [26, 266], [42, 251], [60, 251]];
/** The opening between the legs from the first floor up to just under the second */
const GAP_FOOT = 39.4, GAP_TOP = 47, GAP_LOW = 241, GAP_HIGH = 206;
const TOWER_BODY =
  `M${SIDE_YS.map(y => edge(y, -1)).join("L")}L${[...SIDE_YS].reverse().map(y => edge(y, 1)).join("L")}Z` +
  `M${ARCH[0].join(" ")}C${ARCH[1].join(" ")} ${ARCH[2].join(" ")} ${ARCH[3].join(" ")}C${120 - ARCH[2][0]} ${ARCH[2][1]} ${120 - ARCH[1][0]} ${ARCH[1][1]} ${120 - ARCH[0][0]} ${ARCH[0][1]}Z` +
  `M${GAP_FOOT} ${GAP_LOW}L${GAP_TOP} ${GAP_HIGH}Q60 197 ${120 - GAP_TOP} ${GAP_HIGH}L${120 - GAP_FOOT} ${GAP_LOW}Z`;

/** A point on the arch's left half, t from the foot (0) to the top (1) */
const archAt = (t: number): [number, number] => {
  const u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map(c => ARCH.reduce((s, p, i) => s + k[i] * p[c], 0)) as [number, number];
};

/** Criss-cross girders across a section's rungs, each [left x, right x, y]; mirrored for the right leg when asked */
const girders = (rungs: [number, number, number][], mirror = false) => {
  let d = "";
  for (let i = 0; i + 1 < rungs.length; i++) {
    const [a0, b0, y0] = rungs[i], [a1, b1, y1] = rungs[i + 1];
    d += `M${n1(a0)} ${n1(y0)}L${n1(b1)} ${n1(y1)}M${n1(b0)} ${n1(y0)}L${n1(a1)} ${n1(y1)}M${n1(a1)} ${n1(y1)}H${n1(b1)}`;
    if (mirror) d += `M${n1(120 - a0)} ${n1(y0)}L${n1(120 - b1)} ${n1(y1)}M${n1(120 - b0)} ${n1(y0)}L${n1(120 - a1)} ${n1(y1)}M${n1(120 - a1)} ${n1(y1)}H${n1(120 - b1)}`;
  }
  return d;
};
const range = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
const TOWER_GIRDERS =
  // the shaft, from under the top platform down to the second floor
  girders(range(58, 189, 10).map(y => [60 - w(y), 60 + w(y), y])) +
  // the legs between the first and second floors, out to the opening's edge
  girders(range(GAP_HIGH, GAP_LOW, 3).map(y => [60 - w(y), GAP_TOP + ((GAP_FOOT - GAP_TOP) * (y - GAP_HIGH)) / (GAP_LOW - GAP_HIGH), y]), true) +
  // the feet, from under the first floor down to the ground, out to the arch
  girders([0.7, 0.45, 0.2, 0].map(t => { const [x, y] = archAt(t); return [60 - w(y), x, y]; }), true);

/** A platform across the tower at y, h high, reaching `over` past its sides */
const platform = (y: number, h: number, over: number) => ({ x: n1(60 - w(y + h / 2) - over), y, width: n1(2 * (w(y + h / 2) + over)), height: h });
const FLOOR_1 = platform(241, 8, 2.5);
const FLOOR_2 = platform(190, 6, 2);
/** The arches along the first floor's face */
const FLOOR_1_ARCHES = Array.from({ length: 13 }, (_, i) => {
  const x = Number(FLOOR_1.x) + 3 + (i * (Number(FLOOR_1.width) - 6)) / 12;
  return `M${n1(x - 2.2)} 249V246.4A2.2 2.2 0 0 1 ${n1(x + 2.2)} 246.4V249`;
}).join("");

const EiffelTower = ({ className }: { className: string }) => (
  <svg viewBox="-2 -6 124 307" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-bastille-day-tower" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0.1" stopColor="#b8741c" />
        <stop offset="0.45" stopColor="#ffd27a" />
        <stop offset="0.9" stopColor="#a8661a" />
      </linearGradient>
      <radialGradient id="season-bastille-day-beacon">
        <stop offset="0.1" stopColor="#fff4d0" stopOpacity="0.75" />
        <stop offset="1" stopColor="#fff4d0" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="8" r="13" fill="url(#season-bastille-day-beacon)" />
    {/* the mast, the lantern with its dome, the top platform */}
    <rect x="59.3" y="6" width="1.4" height="28" fill="#ffd27a" />
    <path d="M56 38Q60 30 64 38Z" fill="url(#season-bastille-day-tower)" />
    <rect x="56.5" y="38" width="7" height="12" fill="url(#season-bastille-day-tower)" />
    <rect x="52.5" y="50" width="15" height="4.5" rx="0.6" fill="#ffe2a0" />
    <path d={TOWER_BODY} fillRule="evenodd" fill="url(#season-bastille-day-tower)" fillOpacity="0.94" stroke="#7a4a12" strokeWidth="0.8" strokeLinejoin="round" />
    <path d={TOWER_GIRDERS} stroke="#6e420f" strokeOpacity="0.75" strokeWidth="0.7" fill="none" />
    <rect {...FLOOR_2} rx="0.8" fill="#ffe2a0" stroke="#7a4a12" strokeWidth="0.7" />
    <rect {...FLOOR_1} rx="0.8" fill="#ffe2a0" stroke="#7a4a12" strokeWidth="0.7" />
    <path d={FLOOR_1_ARCHES} stroke="#7a4a12" strokeWidth="0.6" fill="none" />
  </svg>
);

/** An accordion, 130 × 96: red ends, keys on the right, the bellows in blue and white between them */
const BELLOWS = Array.from({ length: 9 }, (_, i) => ({ x: 34 + i * 6.4, fill: i % 2 ? WHITE : "#2a4bb8" }));

const Accordion = ({ className }: { className: string }) => (
  <svg viewBox="0 0 130 96" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g transform="rotate(-6 65 48)">
      {BELLOWS.map(b => <path key={b.x} d={`M${b.x} 16L${b.x + 6.4} 13V83L${b.x} 80Z`} fill={b.fill} stroke="#141a3a" strokeWidth="0.8" />)}
      {/* the left end with its buttons */}
      <rect x="10" y="10" width="26" height="76" rx="4" fill="#c8263a" stroke="#6e0f1c" strokeWidth="1" />
      <g fill="#f6f3ec">
        {[22, 32, 42, 52, 62, 72].flatMap((y, row) => [17, 26].map(x => <circle key={`${x} ${y}`} cx={x + (row % 2 ? 2 : -1)} cy={y} r="2.2" />))}
      </g>
      {/* the right end with its keyboard */}
      <rect x="92" y="6" width="30" height="84" rx="4" fill="#c8263a" stroke="#6e0f1c" strokeWidth="1" />
      <rect x="98" y="12" width="18" height="72" rx="1.5" fill="#f6f3ec" />
      <g stroke="#9b97a0" strokeWidth="0.6">
        {[20, 28, 36, 44, 52, 60, 68, 76].map(y => <path key={y} d={`M98 ${y}H116`} />)}
      </g>
      <g fill="#1b1b22">
        {[17, 25, 41, 49, 57, 73].map(y => <rect key={y} x="98" y={y} width="10" height="4.6" rx="0.6" />)}
      </g>
      <path d="M14 14V82M118 10V86" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  </svg>
);

const BastilleDayDecor = () => (
  <>
    <Lanterns id="season-bastille-day-lanterns" scale={1} className="hidden sm:block h-[74px]" />
    <Lanterns id="season-bastille-day-lanterns-small" scale={0.62} className="sm:hidden h-[46px]" />
    <Firework colour={BLUE} className="left-2 top-[36px] w-[46px] sm:left-3 sm:top-[56px] sm:w-[80px] lg:left-[calc(50%-500px)] lg:top-[70px] lg:w-[130px] xl:left-[calc(50%-600px)] xl:top-[80px] xl:w-[170px]" />
    <Firework colour={RED} small className="hidden md:block left-[calc(50%-400px)] top-[150px] w-[80px] lg:left-[calc(50%-400px)] lg:top-[210px] lg:w-[96px] xl:left-[calc(50%-420px)] xl:top-[190px]" />
    <Firework colour={WHITE} className="right-2 top-[38px] w-[42px] sm:right-6 sm:top-[74px] sm:w-[96px] lg:right-auto lg:left-[calc(50%+330px)] lg:top-[60px] lg:w-[150px]" />
    <Firework colour={RED} small className="hidden lg:block left-[calc(50%+520px)] top-[130px] w-[100px]" />
    <Firework colour={BLUE} small className="hidden xl:block left-[calc(50%+470px)] top-[260px] w-[70px]" />
    <Accordion className="left-2 bottom-1 w-[58px] sm:w-[78px] md:left-[calc(50%-340px)] md:bottom-2 lg:left-[calc(50%-450px)] lg:w-[118px]" />
    <EiffelTower className="right-2 bottom-0 w-[40px] sm:w-[54px] md:right-auto md:left-[calc(50%+270px)] lg:left-[calc(50%+320px)] lg:w-[86px]" />
  </>
);

export default BastilleDayDecor;
