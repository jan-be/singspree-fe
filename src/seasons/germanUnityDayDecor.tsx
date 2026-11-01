// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign, on an autumn evening
// in Berlin: the Brandenburg Gate lit gold with fireworks over it, a piece
// of the Wall covered in graffiti with a gap in it, a bunch of red balloons
// (99 Luftballons) and a few falling leaves. Black, red and gold only as
// light, no flags. Static SVG like the wall itself (no blur); only the
// balloons sway (germanUnityDay.css).

const GOLD = "#ffcf5a";
const RED = "#ff4b3e";
const WHITE = "#fff3dc";

/** A firework burst, 200 × 200 around its middle: `rays` lines from the centre, a dot at each tip */
const burst = (rays: number, inner: number, outer: number, tilt: number) => {
  let lines = "";
  const tips: [number, number][] = [];
  for (let i = 0; i < rays; i++) {
    const a = ((i / rays) * 360 + tilt) * (Math.PI / 180);
    const r = i % 2 ? outer * 0.84 : outer;
    lines += `M${(inner * Math.cos(a)).toFixed(1)} ${(inner * Math.sin(a)).toFixed(1)}L${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
    tips.push([(r + 7) * Math.cos(a), (r + 7) * Math.sin(a)]);
  }
  return { lines, tips };
};
const BURST_BIG = burst(24, 16, 74, 0);
const BURST_SMALL = burst(16, 10, 52, 11);

const Firework = ({ colour, small, className }: { colour: string; small?: boolean; className: string }) => {
  const shape = small ? BURST_SMALL : BURST_BIG;
  const id = `season-german-unity-day-glow-${colour.slice(1)}`;
  return (
    <svg viewBox="-100 -100 200 200" className={`absolute ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={colour} stopOpacity="0.32" />
          <stop offset="1" stopColor={colour} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="80" fill={`url(#${id})`} />
      <path d={shape.lines} stroke={colour} strokeWidth="2.2" strokeLinecap="round" fill="none" strokeOpacity="0.9" />
      <g fill={WHITE}>
        {shape.tips.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={i % 3 ? 1.8 : 2.8} />)}
        <circle r="4" />
      </g>
    </svg>
  );
};

/** The Brandenburg Gate in floodlight: six columns, the attic, the Quadriga on top */
const COLUMNS = [24, 56, 92, 138, 174, 206];

const Gate = ({ className }: { className: string }) => (
  <svg viewBox="0 0 240 150" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-german-unity-day-floodlight" cx="50%" cy="80%" r="60%">
        <stop offset="0" stopColor="#ffc95a" stopOpacity="0.3" />
        <stop offset="1" stopColor="#ffc95a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="season-german-unity-day-stone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe7b0" />
        <stop offset="0.55" stopColor="#f0bd62" />
        <stop offset="1" stopColor="#b9792a" />
      </linearGradient>
      <linearGradient id="season-german-unity-day-column" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c98a35" />
        <stop offset="0.45" stopColor="#ffe3a4" />
        <stop offset="1" stopColor="#b27126" />
      </linearGradient>
    </defs>
    <ellipse cx="120" cy="110" rx="130" ry="60" fill="url(#season-german-unity-day-floodlight)" />
    {/* the gatehouses at the sides */}
    <rect x="2" y="98" width="18" height="48" fill="url(#season-german-unity-day-stone)" fillOpacity="0.8" />
    <rect x="220" y="98" width="18" height="48" fill="url(#season-german-unity-day-stone)" fillOpacity="0.8" />
    <rect x="0" y="94" width="22" height="5" fill="#ffe0a0" fillOpacity="0.85" />
    <rect x="218" y="94" width="22" height="5" fill="#ffe0a0" fillOpacity="0.85" />
    {/* columns on their plinth */}
    {COLUMNS.map(x => (
      <g key={x}>
        <rect x={x} y="74" width="10" height="64" fill="url(#season-german-unity-day-column)" />
        <rect x={x - 1.5} y="71" width="13" height="4" fill="#ffe7b0" />
      </g>
    ))}
    <rect x="16" y="138" width="208" height="8" fill="url(#season-german-unity-day-stone)" />
    {/* entablature, frieze and the stepped attic */}
    <rect x="14" y="57" width="212" height="4" fill="#fff0c8" />
    <rect x="16" y="61" width="208" height="11" fill="url(#season-german-unity-day-stone)" />
    <path d="M18 66H222" stroke="#a8691f" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="3 3" />
    <rect x="58" y="40" width="124" height="17" fill="url(#season-german-unity-day-stone)" />
    <rect x="56" y="38" width="128" height="3" fill="#fff0c8" />
    <rect x="98" y="31" width="44" height="7" fill="url(#season-german-unity-day-stone)" />
    {/* the Quadriga: Victoria with her staff in a chariot behind four horses, bronze gone green */}
    <g fill="#4f8573" stroke="#2c5446" strokeWidth="0.6">
      <path d="M110 31V24Q120 20 130 24V31Z" />
      {[101, 110, 127, 136].map((x, i) => (
        <path key={x} d={`M${x} 31L${x + 1} 22Q${x + 2} ${15 + (i % 2)} ${x + (i < 2 ? -2 : 6)} 14L${x + (i < 2 ? 0 : 4)} 18Q${x + 3} 22 ${x + 4} 31Z`} />
      ))}
      <path d="M118 24L119 11Q120 8 121 11L122 24Z" />
      <circle cx="120" cy="8" r="2.2" />
      <path d="M116 15Q111 9 113 4Q116 9 119 13ZM124 15Q129 9 127 4Q124 9 121 13Z" />
    </g>
    <path d="M121 13L127 9V0" fill="none" stroke="#4f8573" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="127" cy="0.5" r="2.4" fill="none" stroke="#4f8573" strokeWidth="1.1" />
  </svg>
);

/** A wall segment with its round top, 62 wide */
const Segment = ({ x }: { x: number }) => (
  <g>
    <rect x={x} y="22" width="62" height="106" fill="url(#season-german-unity-day-concrete)" />
    <rect x={x - 2} y="12" width="66" height="13" rx="6.5" fill="#b5b4b0" />
    <path d={`M${x - 2} 21.5H${x + 64}`} stroke="#6d6c69" strokeWidth="1.2" />
  </g>
);

/** A piece of the Wall, broken open: two segments painted over in colour, light through the gap */
const Wall = ({ className }: { className: string }) => (
  <svg viewBox="0 0 170 130" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-german-unity-day-concrete" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a9a8a3" />
        <stop offset="1" stopColor="#77746f" />
      </linearGradient>
      <radialGradient id="season-german-unity-day-gap" cx="50%" cy="70%" r="60%">
        <stop offset="0" stopColor="#ffd77a" stopOpacity="0.75" />
        <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="85" cy="92" rx="36" ry="52" fill="url(#season-german-unity-day-gap)" />
    <Segment x={4} />
    <Segment x={104} />
    {/* graffiti on the left one: a heart, a rainbow, stars and a scribble */}
    <path d="M30 70C18 60 12 52 18 45C23 39 30 43 30 49C30 43 37 39 42 45C48 52 42 60 30 70Z" fill="#ff3d57" stroke="#ffd34d" strokeWidth="1.6" />
    <g fill="none" strokeWidth="3.4" strokeLinecap="round">
      <path d="M10 112Q34 82 60 112" stroke="#ffcf3a" />
      <path d="M14 112Q34 89 56 112" stroke="#2fd47c" />
      <path d="M18 112Q34 96 52 112" stroke="#3a8dff" />
    </g>
    <path d="M12 34L18 28L24 34L30 28L36 34L42 28L48 34L54 28" fill="none" stroke="#38c6ff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M52 52l2 4.5 5 .6-3.7 3.4 1 5-4.3-2.5-4.3 2.5 1-5-3.7-3.4 5-.6z" fill="#fff06a" />
    {/* and on the right one: a big smiling face, colour blocks, a swirl */}
    <circle cx="136" cy="56" r="17" fill="#ffd83d" stroke="#ff7a2f" strokeWidth="2" />
    <circle cx="130" cy="52" r="2.4" fill="#1d1d1d" />
    <circle cx="142" cy="52" r="2.4" fill="#1d1d1d" />
    <path d="M127 60Q136 69 145 60" fill="none" stroke="#1d1d1d" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M108 92h18v14h-18z" fill="#c23cff" fillOpacity="0.85" />
    <path d="M128 98h22v18h-22z" fill="#ff5a36" fillOpacity="0.85" />
    <path d="M118 104h16v14h-16z" fill="#2fd4c0" fillOpacity="0.8" />
    <path d="M150 84c-6 0-8 6-4 8s8-2 5-6-11-2-11 6 12 10 15 2" fill="none" stroke="#7dff5a" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M110 36q6-6 12 0t12 0 12 0 12 0" fill="none" stroke="#ff4fa8" strokeWidth="2.4" strokeLinecap="round" />
    {/* broken edges at the gap */}
    <path d="M66 22L63 40L67 58L62 80L66 104L63 128" fill="none" stroke="#5f5d59" strokeWidth="1.2" />
    <path d="M104 22L107 46L103 70L108 94L104 128" fill="none" stroke="#5f5d59" strokeWidth="1.2" />
  </svg>
);

/** A bunch of balloons on their strings, mostly red and one gold: 99 Luftballons */
const BALLOONS: [number, number, string][] = [
  [26, 30, "#e8302c"], [52, 18, "#ff4a3e"], [72, 40, "#d92420"], [40, 52, "#ffc23a"], [62, 66, "#f03c35"],
];

const Balloons = ({ className }: { className: string }) => (
  <div className={`season-german-unity-day-sway absolute ${className}`} aria-hidden="true">
    <svg viewBox="0 0 96 150" className="w-full" focusable="false">
      <g fill="none" stroke="#f3e2c8" strokeOpacity="0.5" strokeWidth="0.9">
        {BALLOONS.map(([x, y]) => <path key={x} d={`M${x} ${y + 17}Q${x + (48 - x) * 0.3 + 4} ${y + 60} 48 146`} />)}
      </g>
      {BALLOONS.map(([x, y, fill]) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx="13" ry="16" fill={fill} />
          <path d={`M${x - 2.5} ${y + 18.5}L${x} ${y + 15}L${x + 2.5} ${y + 18.5}Z`} fill={fill} />
          <ellipse cx={x - 4.5} cy={y - 6} rx="3.2" ry="5.2" fill="#fff" fillOpacity="0.38" transform={`rotate(-24 ${x - 4.5} ${y - 6})`} />
        </g>
      ))}
    </svg>
  </div>
);

/** A falling autumn leaf, 24 × 24 around its middle */
const Leaf = ({ fill, className }: { fill: string; className: string }) => (
  <svg viewBox="-12 -12 24 24" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d="M0 -11C5 -8 9 -3 8 3C7 8 3 10 0 11C-3 10 -7 8 -8 3C-9 -3 -5 -8 0 -11Z" fill={fill} fillOpacity="0.8" />
    <path d="M0 -9V12M0 -2L-4 -5M0 2L4 -1M0 6L-4 3" fill="none" stroke="#5a2a10" strokeOpacity="0.55" strokeWidth="0.9" strokeLinecap="round" />
  </svg>
);

const GermanUnityDayDecor = () => (
  <>
    <Firework colour={GOLD} className="right-2 top-[8px] w-[84px] sm:right-6 sm:w-[110px] lg:right-auto lg:left-[calc(50%+330px)] lg:top-[24px] lg:w-[170px]" />
    <Firework colour={RED} small className="hidden sm:block right-[130px] top-[10px] w-[60px] lg:right-auto lg:left-[calc(50%+160px)] lg:top-[40px] lg:w-[86px]" />
    <Firework colour={WHITE} small className="hidden lg:block left-[calc(50%+500px)] top-[120px] w-[90px]" />
    <Firework colour={RED} className="hidden xl:block left-[calc(50%-420px)] top-[10px] w-[120px]" />
    <Balloons className="left-2 top-[8px] w-[34px] sm:left-6 sm:top-[50px] sm:w-[58px] lg:left-[calc(50%-620px)] lg:top-[64px] lg:w-[84px]" />
    <Leaf fill="#ffb53a" className="hidden sm:block left-[calc(50%-330px)] top-[250px] w-[16px] lg:left-[calc(50%-500px)] lg:top-[240px] lg:w-[22px] rotate-[30deg]" />
    <Leaf fill="#e9542c" className="hidden md:block left-[calc(50%-260px)] top-[60px] w-[18px] rotate-[-40deg]" />
    <Leaf fill="#d8902a" className="hidden lg:block left-[calc(50%+220px)] top-[40px] w-[18px] rotate-[70deg]" />
    <Leaf fill="#ff7a32" className="hidden lg:block left-[calc(50%+560px)] top-[300px] w-[20px] rotate-[-15deg]" />
    <Wall className="left-2 bottom-0 w-[66px] sm:w-[88px] md:left-[calc(50%-340px)] lg:left-[calc(50%-470px)] lg:w-[150px]" />
    <Gate className="right-2 bottom-0 w-[104px] sm:w-[140px] md:right-auto md:left-[calc(50%+230px)] lg:left-[calc(50%+260px)] lg:w-[250px]" />
  </>
);

export default GermanUnityDayDecor;
