// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: a garland of painted
// eggs in the top-left corner, a blossoming branch reaching in from the
// right, butterflies, a nest of eggs and tulips in the grass, and a bunny
// peeking out of it next to a chick in its shell. Static SVG like the wall
// itself (no blur, no filters, no animation).

/** An egg, 60 × 78 */
const EGG = "M30 2C46 2 58 28 58 48C58 66 45 76 30 76C15 76 2 66 2 48C2 28 14 2 30 2Z";

type Paint = "zigzag" | "dots" | "bands" | "waves";

const ZIGZAG = "M-2 40L6 31L14 40L22 31L30 40L38 31L46 40L54 31L62 40";
const DOTS = [[16, 20, 3.4], [34, 14, 2.8], [46, 26, 3.6], [12, 40, 3.2], [30, 34, 4], [50, 44, 3.2], [20, 58, 3.6], [40, 56, 3], [30, 70, 2.6]];
const wave = (y: number) => `M-2 ${y}Q6 ${y - 6} 14 ${y}T30 ${y}T46 ${y}T62 ${y}`;

const EggPaint = ({ paint, ink }: { paint: Paint; ink: string }) => {
  switch (paint) {
    case "zigzag":
      return <g fill="none" stroke={ink} strokeWidth="4" strokeLinejoin="round"><path d={ZIGZAG} /><path d="M0 22H60M0 58H60" strokeWidth="3" /></g>;
    case "dots":
      return <g fill={ink}>{DOTS.map(([x, y, r]) => <circle key={`${x} ${y}`} cx={x} cy={y} r={r} />)}</g>;
    case "bands":
      return <g fill={ink}><rect y="34" width="60" height="12" /><rect y="25" width="60" height="2.6" /><rect y="53" width="60" height="2.6" /></g>;
    case "waves":
      return <g fill="none" stroke={ink} strokeWidth="3.2"><path d={wave(26)} /><path d={wave(44)} /><path d={wave(62)} /></g>;
  }
};

/** Light from the top left and a shadow at the bottom right, over any egg (one per drawing, `id` its own) */
const EggShade = ({ id }: { id: string }) => (
  <radialGradient id={id} cx="36%" cy="30%" r="78%">
    <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
    <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
    <stop offset="1" stopColor="#2a1650" stopOpacity="0.4" />
  </radialGradient>
);

/** A painted egg inside a drawing: its top-left corner at (x, y), `height` tall */
const Egg = ({ id, shade, x, y, height, tilt = 0, shell, ink, paint }: {
  id: string; shade: string; x: number; y: number; height: number; tilt?: number; shell: string; ink: string; paint: Paint;
}) => (
  <g transform={`translate(${x} ${y}) scale(${height / 78}) rotate(${tilt} 30 39)`}>
    <clipPath id={id}><path d={EGG} /></clipPath>
    <path d={EGG} fill={shell} />
    <g clipPath={`url(#${id})`}><EggPaint paint={paint} ink={ink} /></g>
    <path d={EGG} fill={`url(#${shade})`} stroke="#3b2266" strokeOpacity="0.35" strokeWidth="1.4" />
  </g>
);

/** Blades of grass standing on the bottom of a `width` × `height` box, `n` + 1 of them */
const grass = (width: number, height: number, n: number, seed: number) => {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * width;
    const tall = height * (0.5 + 0.5 * Math.abs(Math.sin(i * 2.3 + seed)));
    const lean = 7 * Math.sin(i * 1.7 + seed * 2);
    const f = (v: number) => v.toFixed(1);
    d += `M${f(x - 4)} ${height}Q${f(x - 1 + lean / 2)} ${f(height - tall / 2)} ${f(x + lean)} ${f(height - tall)}Q${f(x + 2 + lean / 2)} ${f(height - tall / 2)} ${f(x + 4)} ${height}Z`;
  }
  return d;
};

const GrassFill = ({ id }: { id: string }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#8be8a6" />
    <stop offset="1" stopColor="#2c7a52" />
  </linearGradient>
);

/** A tulip on its stem, standing at (x, y): about 20 wide and 52 tall */
const Tulip = ({ x, y, color, lean = 0 }: { x: number; y: number; color: string; lean?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${lean})`}>
    <path d="M0 0V-38" stroke="#4fa86c" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M0 -8Q-14 -18 -11 -32Q-4 -20 0 -14Z" fill="#5fbf7c" />
    <path d="M-9 -38Q-10 -52 -5 -55L0 -47L5 -55Q10 -52 9 -38Q0 -31 -9 -38Z" fill={color} />
    <path d="M-4 -40Q-5 -49 -2 -52" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </g>
);

const NEST_BACK = grass(180, 34, 22, 1);
const NEST_FRONT = grass(180, 26, 26, 4);

/** Three eggs in the grass with tulips, 180 × 100 */
const Nest = ({ className }: { className: string }) => (
  <svg viewBox="0 0 180 100" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <EggShade id="season-easter-shade-nest" />
      <GrassFill id="season-easter-grass-nest" />
    </defs>
    <path d={NEST_BACK} transform="translate(0 66)" fill="#2f7a55" />
    <Tulip x={14} y={96} color="#ff8fc6" lean={-8} />
    <Tulip x={164} y={96} color="#ffd75e" lean={7} />
    <Egg id="season-easter-egg-a" shade="season-easter-shade-nest" x={28} y={40} height={50} tilt={-14} shell="#ffb3d6" ink="#fff1a8" paint="zigzag" />
    <Egg id="season-easter-egg-b" shade="season-easter-shade-nest" x={64} y={28} height={62} tilt={3} shell="#9cf0d0" ink="#ffffff" paint="dots" />
    <Egg id="season-easter-egg-c" shade="season-easter-shade-nest" x={108} y={42} height={48} tilt={15} shell="#c8b2ff" ink="#ffe27a" paint="bands" />
    <path d={NEST_FRONT} transform="translate(0 74)" fill="url(#season-easter-grass-nest)" />
  </svg>
);

const BUNNY_FRONT = grass(200, 30, 28, 7);

/** A bunny peeking out of the grass, a chick in its shell beside it, 200 × 130 */
const Bunny = ({ className }: { className: string }) => (
  <svg viewBox="0 0 200 130" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-easter-fur" cx="42%" cy="30%" r="75%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.6" stopColor="#ece5fa" />
        <stop offset="1" stopColor="#c2b4e4" />
      </radialGradient>
      <radialGradient id="season-easter-chick" cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor="#fff2a0" />
        <stop offset="0.7" stopColor="#ffd84a" />
        <stop offset="1" stopColor="#f0b324" />
      </radialGradient>
      <GrassFill id="season-easter-grass-bunny" />
    </defs>
    {/* ears */}
    <g transform="rotate(-14 44 70)">
      <ellipse cx="44" cy="38" rx="11" ry="33" fill="url(#season-easter-fur)" />
      <ellipse cx="44" cy="41" rx="5.5" ry="24" fill="#ffaccf" />
    </g>
    <g transform="rotate(12 76 70)">
      <ellipse cx="76" cy="38" rx="11" ry="33" fill="url(#season-easter-fur)" />
      <ellipse cx="76" cy="41" rx="5.5" ry="24" fill="#ffaccf" />
    </g>
    <ellipse cx="60" cy="94" rx="35" ry="29" fill="url(#season-easter-fur)" />
    <circle cx="40" cy="101" r="6" fill="#ff9cc8" fillOpacity="0.45" />
    <circle cx="80" cy="101" r="6" fill="#ff9cc8" fillOpacity="0.45" />
    <circle cx="48" cy="88" r="4.4" fill="#2a1c3a" />
    <circle cx="72" cy="88" r="4.4" fill="#2a1c3a" />
    <circle cx="49.6" cy="86.4" r="1.5" fill="#ffffff" />
    <circle cx="73.6" cy="86.4" r="1.5" fill="#ffffff" />
    <path d="M56.5 96.5H63.5L60 100.5Z" fill="#ff7fb2" />
    <path d="M60 100.5Q57 105.5 53 104M60 100.5Q63 105.5 67 104" stroke="#8a6f9e" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M50 99L30 95M50 102L30 104M70 99L90 95M70 102L90 104" stroke="#d8cdf0" strokeWidth="1" strokeLinecap="round" />
    {/* the chick, hatched: the bottom of its shell, the top on its head */}
    <circle cx="157" cy="82" r="17" fill="url(#season-easter-chick)" />
    <circle cx="151.5" cy="79" r="2.4" fill="#2a1c3a" />
    <circle cx="162.5" cy="79" r="2.4" fill="#2a1c3a" />
    <path d="M154.5 85H159.5L157 89.5Z" fill="#ff9a2e" />
    <path d="M140 66C141 54 171 52 174 64L167 61L161 67L155 60L149 67Z" fill="#fff6e8" stroke="#d9c6ad" strokeWidth="1" transform="rotate(-12 157 62)" />
    <path d="M130 92L138 86L144 94L151 85L158 94L165 86L172 94L180 88C183 110 171 124 155 124C139 124 127 110 130 92Z" fill="#fff6e8" stroke="#d9c6ad" strokeWidth="1" />
    <path d="M136 104Q140 116 152 120" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d={BUNNY_FRONT} transform="translate(0 100)" fill="url(#season-easter-grass-bunny)" />
  </svg>
);

/** The garland's string across the top-left corner, and where its eggs hang from it */
const GARLAND_STRING: [number, number, number, number, number, number] = [0, 4, 100, 64, 200, 2];
const garlandAt = (t: number) => {
  const [x0, y0, x1, y1, x2, y2] = GARLAND_STRING;
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2];
};
const GARLAND_EGGS: { t: number; drop: number; shell: string; ink: string; paint: Paint }[] = [
  { t: 0.12, drop: 6, shell: "#ffd75e", ink: "#ff8fc6", paint: "dots" },
  { t: 0.3, drop: 12, shell: "#9cf0d0", ink: "#7a5af0", paint: "zigzag" },
  { t: 0.5, drop: 8, shell: "#ffb3d6", ink: "#ffffff", paint: "waves" },
  { t: 0.7, drop: 13, shell: "#c8b2ff", ink: "#9cf0d0", paint: "bands" },
  { t: 0.88, drop: 6, shell: "#ffe9a8", ink: "#ff8fc6", paint: "zigzag" },
];

const Garland = ({ className }: { className: string }) => (
  <svg viewBox="0 0 200 110" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs><EggShade id="season-easter-shade-garland" /></defs>
    <path d={`M${GARLAND_STRING.slice(0, 2).join(" ")}Q${GARLAND_STRING.slice(2).join(" ")}`} fill="none" stroke="#e8dcff" strokeOpacity="0.5" strokeWidth="1.2" />
    {GARLAND_EGGS.map(({ t, drop, ...egg }, i) => {
      const [x, y] = garlandAt(t);
      return (
        <g key={t}>
          <path d={`M${x.toFixed(1)} ${y.toFixed(1)}V${(y + drop).toFixed(1)}`} stroke="#e8dcff" strokeOpacity="0.5" strokeWidth="1" />
          <Egg id={`season-easter-egg-g${i}`} shade="season-easter-shade-garland" x={x - 10} y={y + drop - 1} height={27} tilt={i % 2 ? 5 : -5} {...egg} />
        </g>
      );
    })}
  </svg>
);

/** A blossom: five petals around a deeper middle */
const Blossom = ({ x, y, r = 1, turn = 0 }: { x: number; y: number; r?: number; turn?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${r}) rotate(${turn})`}>
    <g fill="#ffd3e6" stroke="#ff9cc8" strokeWidth="0.8">
      {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-6" rx="4.6" ry="6" transform={`rotate(${a})`} />)}
    </g>
    <circle r="2.6" fill="#ff7fb2" />
    <g fill="#ffe27a">
      <circle cx="0" cy="-3.4" r="0.9" /><circle cx="3.2" cy="-1" r="0.9" /><circle cx="2" cy="2.8" r="0.9" /><circle cx="-2" cy="2.8" r="0.9" /><circle cx="-3.2" cy="-1" r="0.9" />
    </g>
  </g>
);

/** A blossoming branch reaching in from the top right, 260 × 170 */
const Branch = ({ className }: { className: string }) => (
  <svg viewBox="0 0 260 170" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g fill="none" stroke="#4b3550" strokeLinecap="round">
      <path d="M262 8Q200 20 160 52Q120 84 60 92" strokeWidth="6" />
      <path d="M160 52Q150 22 118 14" strokeWidth="3.4" />
      <path d="M112 76Q96 108 104 140" strokeWidth="3" />
      <path d="M210 26Q214 52 236 64" strokeWidth="3" />
      <path d="M60 92Q36 92 18 104" strokeWidth="2.4" />
    </g>
    <g fill="#ff9cc8">
      <ellipse cx="16" cy="106" rx="3" ry="4.4" transform="rotate(50 16 106)" />
      <ellipse cx="104" cy="144" rx="3" ry="4.4" />
      <ellipse cx="118" cy="11" rx="3" ry="4.4" transform="rotate(-70 118 11)" />
      <ellipse cx="238" cy="67" rx="3" ry="4.4" transform="rotate(-40 238 67)" />
    </g>
    <Blossom x={64} y={86} r={1.15} turn={10} />
    <Blossom x={38} y={98} r={0.9} turn={40} />
    <Blossom x={136} y={22} r={1.05} turn={20} />
    <Blossom x={106} y={118} r={1.1} turn={-15} />
    <Blossom x={150} y={64} r={1.25} />
    <Blossom x={188} y={38} r={1} turn={30} />
    <Blossom x={224} y={54} r={1.15} turn={-20} />
    <Blossom x={96} y={86} r={0.85} turn={55} />
    <Blossom x={240} y={18} r={0.9} turn={12} />
  </svg>
);

/** A butterfly, 60 × 48 around its middle */
const Butterfly = ({ className, wings, spots }: { className: string; wings: string; spots: string }) => (
  <svg viewBox="-30 -24 60 48" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    {[1, -1].map(side => (
      <g key={side} transform={`scale(${side} 1)`} fill={wings} stroke="#2a1c3a" strokeOpacity="0.5" strokeWidth="0.8">
        <path d="M0 -2C-6 -16 -26 -24 -26 -10C-26 0 -14 2 0 0Z" />
        <path d="M0 1C-12 2 -22 10 -16 18C-11 23 -3 14 0 4Z" />
        <circle cx="-15" cy="-10" r="3.6" fill={spots} stroke="none" />
        <circle cx="-10" cy="11" r="2.4" fill={spots} stroke="none" />
      </g>
    ))}
    <ellipse cx="0" cy="1" rx="1.8" ry="10" fill="#2a1c3a" />
    <path d="M-1 -8Q-4 -16 -8 -19M1 -8Q4 -16 8 -19" stroke="#2a1c3a" strokeWidth="1" fill="none" strokeLinecap="round" />
  </svg>
);

const EasterDecor = () => (
  <>
    <Garland className="left-0 top-0 w-[110px] sm:w-[170px] lg:w-[230px]" />
    <Branch className="right-0 top-0 w-[120px] sm:w-[180px] lg:w-[270px]" />
    <Butterfly wings="#ffd75e" spots="#ff8fc6" className="left-[38%] top-[16px] w-[26px] sm:left-[calc(50%-150px)] sm:top-[28px] sm:w-[32px] lg:left-[calc(50%-390px)] lg:top-[120px] lg:w-[36px] rotate-[-14deg]" />
    <Butterfly wings="#9cf0d0" spots="#7a5af0" className="hidden lg:block left-[calc(50%+390px)] top-[170px] w-[38px] rotate-[12deg]" />
    <Butterfly wings="#c8b2ff" spots="#ffe27a" className="hidden lg:block left-[calc(50%-470px)] top-[240px] w-[28px] rotate-[8deg]" />
    <Nest className="left-1 bottom-0 w-[96px] sm:w-[130px] md:left-[calc(50%-380px)] lg:left-[calc(50%-480px)] lg:w-[180px]" />
    <Bunny className="right-1 bottom-0 w-[96px] sm:w-[130px] md:right-auto md:left-[calc(50%+250px)] lg:left-[calc(50%+300px)] lg:w-[190px]" />
  </>
);

export default EasterDecor;
