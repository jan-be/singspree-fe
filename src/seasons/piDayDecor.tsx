// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: the digits of π
// running along the top, a circle drawn in chalk with its radius and π's
// digits around it, a protractor, a compass, a few π signs and a cherry pie
// with a π cut into its crust. Static SVG like the
// wall itself (no blur, no animation).

/** π to 300 places */
const PI = "3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273";

/** The digits along the top of the wall, from the left edge on (the rest runs off to the right) */
const Digits = ({ size, className }: { size: number; className: string }) => (
  <svg className={`absolute inset-x-0 w-full ${className}`} aria-hidden="true" focusable="false">
    <text x="14" y={size + 4} className="font-mono" fontSize={size} letterSpacing={size / 6} fill="#e6f0ff" fillOpacity="0.3">{PI}</text>
  </svg>
);

/** A π, 24 × 24, drawn in strokes: the bar with its little hook, the curved left leg, the right one turning out */
const PI_SIGN = "M3 9.5Q4 6.5 7.5 6.5H21.5M9.5 6.5Q9.6 14 6 20.5M16 6.5V17Q16 20.5 19.5 19.5";

const PiSign = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={PI_SIGN} fill="none" stroke="#eef5ff" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A circle in chalk: its centre, the radius r, π's digits going round it and C = 2πr below */
const Circle = ({ className }: { className: string }) => (
  <svg viewBox="0 0 200 236" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <path id="season-pi-day-round" d="M100 18A82 82 0 1 1 99.9 18" />
    </defs>
    <g fill="none" stroke="#eef5ff" strokeLinecap="round">
      <circle cx="100" cy="100" r="64" strokeOpacity="0.6" strokeWidth="2.2" />
      <path d="M100 100H164" strokeOpacity="0.6" strokeWidth="1.8" />
      <path d="M36 100H58M70 100H92" strokeOpacity="0.3" strokeWidth="1.4" />
    </g>
    <circle cx="100" cy="100" r="3" fill="#eef5ff" fillOpacity="0.7" />
    <circle cx="164" cy="100" r="2.4" fill="#ffb627" />
    <text x="128" y="92" className="font-mono" fontSize="17" fontStyle="italic" fill="#ffb627" fillOpacity="0.9">r</text>
    <text className="font-mono" fontSize="10.5" letterSpacing="1.2" fill="#e6f0ff" fillOpacity="0.42">
      <textPath href="#season-pi-day-round">{PI.slice(0, 80)}</textPath>
    </text>
    <text x="100" y="222" textAnchor="middle" className="font-mono" fontSize="20" fill="#eef5ff" fillOpacity="0.6">C = 2πr</text>
  </svg>
);

/** A see-through protractor: its half disc, the inner arc, a tick every 10° (longer every 30°) */
const PROTRACTOR_TICKS = Array.from({ length: 19 }, (_, k) => {
  const a = (k * Math.PI) / 18;
  const inner = k % 3 ? 57 : 51;
  const at = (r: number) => `${(70 - r * Math.cos(a)).toFixed(1)} ${(70 - r * Math.sin(a)).toFixed(1)}`;
  return `M${at(63)}L${at(inner)}`;
}).join("");

const Protractor = ({ className }: { className: string }) => (
  <svg viewBox="0 0 140 76" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d="M5 70A65 65 0 0 1 135 70Z" fill="#8fc8ff" fillOpacity="0.16" stroke="#cfe6ff" strokeOpacity="0.6" strokeWidth="1.4" />
    <path d="M40 70A30 30 0 0 1 100 70" fill="none" stroke="#cfe6ff" strokeOpacity="0.45" strokeWidth="1.2" />
    <path d={PROTRACTOR_TICKS} stroke="#eef6ff" strokeOpacity="0.7" strokeWidth="1.1" />
    <path d="M70 70V62M66 70H74" stroke="#ffb627" strokeWidth="1.4" />
    <text x="70" y="40" textAnchor="middle" className="font-mono" fontSize="9" fill="#eef6ff" fillOpacity="0.6">90°</text>
  </svg>
);

/** A compass: the needle's leg, the pencil's, the hinge and its handle */
const Compass = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 130" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-pi-day-steel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7d8899" />
        <stop offset="0.45" stopColor="#e3e9f2" />
        <stop offset="1" stopColor="#8a95a6" />
      </linearGradient>
    </defs>
    {/* the needle's leg and the pencil's */}
    <path d="M47 18L19 116L23 117L52 20Z" fill="url(#season-pi-day-steel)" stroke="#4a5363" strokeWidth="0.8" />
    <path d="M19 116L21 125L23 117Z" fill="#cfd6e0" />
    <path d="M53 20L76 98L80.5 96.5L58 18Z" fill="url(#season-pi-day-steel)" stroke="#4a5363" strokeWidth="0.8" />
    <path d="M74.5 94L80 113L86 111L80.5 92Z" fill="#ffcf3a" stroke="#a87b12" strokeWidth="0.8" />
    <path d="M80 113L84 124L86 111Z" fill="#f2d2a6" />
    <path d="M82.6 120.5L84 124L84.8 119.8Z" fill="#2b2b33" />
    {/* the hinge and the handle */}
    <circle cx="52.5" cy="18" r="7" fill="url(#season-pi-day-steel)" stroke="#4a5363" strokeWidth="0.8" />
    <circle cx="52.5" cy="18" r="2" fill="#4a5363" />
    <rect x="49.5" y="1" width="6" height="11" rx="2" fill="#ffb627" stroke="#a8700f" strokeWidth="0.8" />
  </svg>
);

/** A crimp along the crust's edge, at `t` round the rim */
const RIM = Array.from({ length: 26 }, (_, k) => {
  const t = (k / 26) * 2 * Math.PI;
  return { k, x: 80 + 69 * Math.cos(t), y: 58 + 27 * Math.sin(t) };
});

/** A cherry pie in its tin, seen from a little above: a crimped crust with a π cut into it and the filling showing */
const Pie = ({ className }: { className: string }) => (
  <svg viewBox="0 0 160 112" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-pi-day-tin" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#6c7686" />
        <stop offset="0.4" stopColor="#c7cfdb" />
        <stop offset="1" stopColor="#5d6676" />
      </linearGradient>
      <radialGradient id="season-pi-day-crust" cx="45%" cy="35%" r="70%">
        <stop offset="0" stopColor="#ffd98a" />
        <stop offset="0.6" stopColor="#f0ae52" />
        <stop offset="1" stopColor="#c8762a" />
      </radialGradient>
      <radialGradient id="season-pi-day-glow">
        <stop offset="0.2" stopColor="#ffb627" stopOpacity="0.3" />
        <stop offset="1" stopColor="#ffb627" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="80" cy="66" rx="80" ry="46" fill="url(#season-pi-day-glow)" />
    {/* the tin */}
    <path d="M8 60L18 86Q80 106 142 86L152 60Z" fill="url(#season-pi-day-tin)" stroke="#434b58" strokeWidth="1" />
    <path d="M18 86Q80 106 142 86" fill="none" stroke="#e9eef5" strokeOpacity="0.5" strokeWidth="1" />
    {/* the crust: the crimped rim, then the top a little lower */}
    <g fill="#e79c45" stroke="#a9611f" strokeWidth="0.8">
      {RIM.map(c => <circle key={c.k} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="6.2" />)}
    </g>
    <ellipse cx="80" cy="58" rx="66" ry="25" fill="url(#season-pi-day-crust)" stroke="#b8702a" strokeWidth="0.8" />
    {/* the π cut out: the cherry filling showing through */}
    <g transform="translate(56 37) scale(2 1.25)">
      <path d={PI_SIGN} fill="none" stroke="#7a0a24" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={PI_SIGN} fill="none" stroke="#d81e45" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* vents around it */}
    <g fill="none" stroke="#9c5a1c" strokeWidth="1.6" strokeLinecap="round">
      <path d="M30 52Q34 50 38 52" />
      <path d="M122 52Q126 50 130 52" />
      <path d="M44 72Q48 74 52 72" />
      <path d="M108 72Q112 74 116 72" />
    </g>
    {/* two cherries beside the tin */}
    <path d="M20 96Q26 82 34 80M30 98Q30 86 34 80" fill="none" stroke="#3f7a2a" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="20" cy="100" r="6.5" fill="#d81e45" stroke="#7a0a24" strokeWidth="0.8" />
    <circle cx="31" cy="102" r="6.5" fill="#c7163b" stroke="#7a0a24" strokeWidth="0.8" />
    <circle cx="18" cy="97.5" r="1.6" fill="#fff" fillOpacity="0.6" />
    <circle cx="29" cy="99.5" r="1.6" fill="#fff" fillOpacity="0.6" />
  </svg>
);

const PiDayDecor = () => (
  <>
    <Digits size={15} className="hidden sm:block top-[2px] h-[28px]" />
    <Digits size={11} className="sm:hidden top-0 h-[20px]" />
    <Circle className="hidden lg:block left-[calc(50%-650px)] top-[64px] w-[190px]" />
    <Protractor className="hidden sm:block right-6 top-[70px] w-[90px] md:right-auto md:left-[calc(50%+300px)] lg:left-[calc(50%+420px)] lg:top-[86px] lg:w-[150px] rotate-[-8deg]" />
    <PiSign className="left-3 top-[34px] w-[22px] sm:left-8 sm:top-[90px] sm:w-[30px] lg:left-[calc(50%-360px)] lg:top-[100px] lg:w-[38px] -rotate-[12deg]" />
    <PiSign className="right-4 top-[46px] w-[18px] sm:hidden rotate-[10deg]" />
    <PiSign className="hidden md:block left-[calc(50%-470px)] top-[250px] w-[26px] lg:left-[calc(50%-560px)] lg:top-[330px] rotate-[16deg]" />
    <PiSign className="hidden lg:block left-[calc(50%+600px)] top-[250px] w-[30px] rotate-[-6deg]" />
    <PiSign className="hidden lg:block left-[calc(50%+250px)] top-[60px] w-[20px] rotate-[20deg]" />
    <Compass className="left-2 bottom-1 w-[42px] sm:w-[58px] md:left-[calc(50%-330px)] md:bottom-2 lg:left-[calc(50%-440px)] lg:w-[92px] -rotate-[4deg]" />
    <Pie className="right-2 bottom-1 w-[76px] sm:w-[110px] md:right-auto md:left-[calc(50%+240px)] md:bottom-2 lg:left-[calc(50%+300px)] lg:w-[190px]" />
  </>
);

export default PiDayDecor;
