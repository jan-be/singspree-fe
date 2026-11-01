// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: pleated stars and
// stripes fans along the top with swags between them, fireworks in red,
// white and blue, little stars, a grill with burgers and a hot dog, and a
// slice of watermelon. Static SVG like the wall itself (no blur, no
// filters); only the little glints twinkle, in independenceDay.css.

const RED = "#ff3347";
const WHITE = "#f4f6ff";
const BLUE = "#4f8cff";
const NAVY = "#1d3a8a";

/** A five-pointed star of outer radius `r` around (x, y), point up */
const star = (x: number, y: number, r: number) => Array.from({ length: 10 }, (_, k) => {
  const a = (k * Math.PI) / 5 - Math.PI / 2;
  const d = k % 2 ? r * 0.4 : r;
  return `${k ? "L" : "M"}${(x + d * Math.cos(a)).toFixed(2)} ${(y + d * Math.sin(a)).toFixed(2)}`;
}).join("") + "Z";

/** A pleated fan hanging from the rail at (x, 4): red and white pleats around a blue middle with stars */
const FAN_R = 46;
const FAN_IN = 19;
const fanPleats = (x: number) => Array.from({ length: 10 }, (_, k) => {
  const a1 = (k * Math.PI) / 10, a2 = ((k + 1) * Math.PI) / 10;
  const p = (r: number, a: number) => `${(x + r * Math.cos(a)).toFixed(1)} ${(4 + r * Math.sin(a)).toFixed(1)}`;
  return { d: `M${p(FAN_IN, a1)}L${p(FAN_R, a1)}A${FAN_R} ${FAN_R} 0 0 1 ${p(FAN_R, a2)}L${p(FAN_IN, a2)}A${FAN_IN} ${FAN_IN} 0 0 0 ${p(FAN_IN, a1)}Z`, fill: k % 2 ? WHITE : "#e2283c" };
});

const Fan = ({ x }: { x: number }) => (
  <g>
    {fanPleats(x).map(p => <path key={p.d} d={p.d} fill={p.fill} stroke="#000" strokeOpacity="0.22" strokeWidth="0.7" />)}
    <path d={`M${x - FAN_IN} 4A${FAN_IN} ${FAN_IN} 0 0 0 ${x + FAN_IN} 4Z`} fill={NAVY} />
    {[[-9, 9], [0, 13], [9, 9]].map(([dx, dy]) => <path key={dx} d={star(x + dx, 4 + dy, 3.4)} fill={WHITE} />)}
    <circle cx={x} cy="4" r="3.6" fill="#ffd25a" />
  </g>
);

/** One length of the bunting, 260 wide: a fan at each end, a red, white and blue swag between */
const SWAG = "M44 6Q130 40 216 6";

const Bunting = ({ id, scale, className }: { id: string; scale: number; className: string }) => (
  <svg className={`absolute left-0 top-0 w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={id} width="260" height="64" patternUnits="userSpaceOnUse" x="50%" patternTransform={`scale(${scale})`}>
        <path d={SWAG} fill="none" stroke={BLUE} strokeWidth="4" transform="translate(0 8)" />
        <path d={SWAG} fill="none" stroke={WHITE} strokeWidth="4" transform="translate(0 4)" />
        <path d={SWAG} fill="none" stroke="#e2283c" strokeWidth="4" />
        <path d="M0 3H260" stroke="#c9cfe0" strokeOpacity="0.4" strokeWidth="1.2" />
        <Fan x={0} />
        <Fan x={260} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/** A firework, 200 across around its middle: rays from the centre, dotted trails, a spark at each end */
const burst = (rays: number, tilt: number) => {
  let inner = "", trail = "";
  const tips: [number, number][] = [];
  for (let i = 0; i < rays; i++) {
    const a = ((i / rays) * 360 + tilt) * (Math.PI / 180);
    const long = i % 2 === 0;
    const pt = (r: number) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
    inner += `M${pt(long ? 12 : 16)}L${pt(long ? 46 : 36)}`;
    trail += `M${pt(long ? 54 : 44)}L${pt(long ? 84 : 64)}`;
    tips.push([(long ? 92 : 71) * Math.cos(a), (long ? 92 : 71) * Math.sin(a)]);
  }
  return { inner, trail, tips };
};
const BURST_BIG = burst(20, 6);
const BURST_SMALL = burst(12, 15);

const TONES = {
  red: { ray: RED, tip: "#ffc2c8" },
  white: { ray: "#dfe6ff", tip: "#ffffff" },
  blue: { ray: BLUE, tip: "#cfe0ff" },
};

const Burst = ({ tone, small, className }: { tone: keyof typeof TONES; small?: boolean; className: string }) => {
  const { ray, tip } = TONES[tone];
  const shape = small ? BURST_SMALL : BURST_BIG;
  return (
    <svg viewBox="-100 -100 200 200" className={`absolute ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`season-independence-day-glow-${tone}`}>
          <stop offset="0" stopColor={ray} stopOpacity="0.3" />
          <stop offset="1" stopColor={ray} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="74" fill={`url(#season-independence-day-glow-${tone})`} />
      <g stroke={ray} strokeLinecap="round" fill="none">
        <path d={shape.inner} strokeWidth="2.4" />
        <path d={shape.trail} strokeWidth="3.6" strokeDasharray="0.1 7.4" strokeOpacity="0.85" />
      </g>
      <g fill={tip}>
        {shape.tips.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={i % 2 ? 2.2 : 3.2} />)}
        <circle r="4.5" />
      </g>
    </svg>
  );
};

/** A little five-pointed star on the wall */
const Star = ({ className, color = WHITE }: { className: string; color?: string }) => (
  <svg viewBox="-12 -12 24 24" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={star(0, 1, 11)} fill={color} fillOpacity="0.8" />
  </svg>
);

/** A four-pointed glint; independenceDay.css makes it twinkle, each at its own `delay` */
const Glint = ({ className, delay = 0, color = WHITE }: { className: string; delay?: number; color?: string }) => (
  <svg viewBox="-12 -12 24 24" className={`absolute season-independence-day-twinkle ${className}`} style={{ animationDelay: `${delay}s` }} aria-hidden="true" focusable="false">
    <path d="M0 -12Q1.3 -1.3 12 0Q1.3 1.3 0 12Q-1.3 1.3 -12 0Q-1.3 -1.3 0 -12Z" fill={color} />
  </svg>
);

/** A red kettle grill on three legs, two burgers and a hot dog on it, smoke rising */
const Grill = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 104" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-independence-day-kettle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff5a68" />
        <stop offset="0.5" stopColor="#d81e33" />
        <stop offset="1" stopColor="#8e0f1f" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="#e6ecf8" strokeOpacity="0.3" strokeWidth="2.4" strokeLinecap="round">
      <path d="M34 34C28 26 40 20 34 10" />
      <path d="M52 32C46 22 58 16 52 4" />
      <path d="M68 34C62 26 74 20 68 12" />
    </g>
    <g stroke="#2a2f3c" strokeWidth="3" strokeLinecap="round">
      <path d="M32 70L22 98" />
      <path d="M68 70L78 98" />
      <path d="M50 76V96" />
    </g>
    <circle cx="22" cy="98" r="4" fill="#3a404f" />
    <circle cx="78" cy="98" r="4" fill="#3a404f" />
    <ellipse cx="50" cy="86" rx="14" ry="3" fill="#3a404f" />
    <ellipse cx="34" cy="44" rx="11" ry="4.6" fill="#6b3a22" />
    <path d="M25 43L43 44" stroke="#3b1d0f" strokeWidth="1.2" />
    <path d="M27 40.5L37 48" stroke="#ffc93c" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="66" cy="45" rx="11" ry="4.6" fill="#734027" />
    <rect x="42" y="37" width="24" height="6.5" rx="3.2" fill="#c8553a" />
    <path d="M47 39L49 42M53 39L55 42M59 39L61 42" stroke="#7b2a17" strokeWidth="1.1" />
    <path d="M10 48H90" stroke="#9aa3b5" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 49A38 28 0 0 0 88 49Z" fill="url(#season-independence-day-kettle)" stroke="#6d0b17" strokeWidth="1" />
    <path d="M22 56Q30 66 44 70" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M8 52H14M86 52H92" stroke="#2a2f3c" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** A slice of watermelon: rind, a pale band, red flesh and seeds */
const Watermelon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 110 64" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g transform="rotate(-8 55 30)">
      <path d="M7 10A48 48 0 0 0 103 10Z" fill="#2d8a45" />
      <path d="M11 10A44 44 0 0 0 99 10Z" fill="#a9e3a0" />
      <path d="M14 10A41 41 0 0 0 96 10Z" fill="#ffe4dc" />
      <path d="M17 10A38 38 0 0 0 93 10Z" fill="#ff4458" />
      <path d="M17 10H93" stroke="#ff7887" strokeWidth="1.6" />
      <g fill="#1d1416">
        {[[38, 20], [55, 24], [72, 20], [46, 34], [64, 34], [55, 42], [30, 26], [80, 26]].map(([x, y]) => (
          <ellipse key={`${x} ${y}`} cx={x} cy={y} rx="1.7" ry="2.8" transform={`rotate(${(x - 55) * 0.9} ${x} ${y})`} />
        ))}
      </g>
    </g>
  </svg>
);

const IndependenceDayDecor = () => (
  <>
    <Bunting id="season-independence-day-bunting" scale={1} className="hidden sm:block h-[64px]" />
    <Bunting id="season-independence-day-bunting-small" scale={0.6} className="sm:hidden h-[40px]" />
    <Burst tone="red" className="left-1 top-[34px] w-[76px] sm:left-4 sm:top-[60px] sm:w-[110px] lg:left-[calc(50%-620px)] lg:top-[78px] lg:w-[180px]" />
    <Burst tone="blue" small className="hidden md:block left-[calc(50%-400px)] top-[70px] w-[84px] lg:left-[calc(50%-420px)] lg:top-[64px] lg:w-[100px]" />
    <Burst tone="white" className="right-1 top-[44px] w-[64px] sm:right-4 sm:top-[64px] sm:w-[100px] lg:right-auto lg:left-[calc(50%+400px)] lg:top-[70px] lg:w-[160px]" />
    <Burst tone="red" small className="hidden lg:block left-[calc(50%+580px)] top-[210px] w-[86px]" />
    <Burst tone="blue" small className="hidden xl:block left-[calc(50%+300px)] top-[48px] w-[70px]" />
    <Star className="hidden sm:block left-[calc(50%-330px)] top-[110px] w-[18px]" />
    <Star className="hidden md:block left-[calc(50%-520px)] top-[260px] w-[22px]" color="#ff8a96" />
    <Star className="hidden lg:block left-[calc(50%-640px)] top-[330px] w-[16px]" color="#9fc0ff" />
    <Star className="hidden sm:block left-[calc(50%+320px)] top-[220px] w-[16px]" color="#9fc0ff" />
    <Star className="hidden lg:block left-[calc(50%+470px)] top-[300px] w-[20px]" />
    <Glint className="left-[22%] top-[96px] w-[11px] sm:left-[calc(50%-260px)] sm:top-[64px] sm:w-[14px]" delay={0} />
    <Glint className="right-[24%] top-[80px] w-[10px] sm:right-auto sm:left-[calc(50%+270px)] sm:top-[110px] sm:w-[14px]" delay={1.4} color="#ffc2c8" />
    <Glint className="hidden md:block left-[calc(50%-470px)] top-[200px] w-[16px]" delay={2.2} color="#cfe0ff" />
    <Glint className="hidden lg:block left-[calc(50%+540px)] top-[140px] w-[14px]" delay={0.8} />
    <Grill className="left-2 bottom-1 w-[50px] sm:w-[68px] md:left-[calc(50%-330px)] md:bottom-2 lg:left-[calc(50%-430px)] lg:w-[100px]" />
    <Watermelon className="right-2 bottom-2 w-[56px] sm:w-[74px] md:right-auto md:left-[calc(50%+250px)] md:bottom-3 lg:left-[calc(50%+310px)] lg:w-[110px]" />
  </>
);

export default IndependenceDayDecor;
