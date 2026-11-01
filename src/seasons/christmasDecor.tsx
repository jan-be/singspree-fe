import { Drift, Snow, Snowflake } from "./snow";

// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: a string of fairy
// lights along the top, a bright star, snowflakes and a little falling
// snow (snow.tsx), a tree and presents on a snowdrift at the foot. Static
// SVG like the wall itself (no blur); only the lights' glow breathes
// (christmas.css).

/** The fairy lights: a wire sagging between hooks every 200 px, five bulbs a swag in turning colours */
const SWAG = 200;
const SAG = 26;
const TOP = 4;
const BULB_COLOURS = ["#ff3346", "#ffc23a", "#2fe07a", "#43a6ff"];
const BULBS = [0, SWAG].flatMap((x0, swag) => [0.12, 0.31, 0.5, 0.69, 0.88].map((t, i) => {
  // the wire is a quadratic curve: y = TOP + 4·SAG·t(1 − t), its slope 4·SAG(1 − 2t)/SWAG
  const angle = (Math.atan((4 * SAG * (1 - 2 * t)) / SWAG) * 180) / Math.PI;
  const n = swag * 5 + i;
  return { n, x: x0 + SWAG * t, y: TOP + 4 * SAG * t * (1 - t), angle, colour: n % BULB_COLOURS.length };
}));
const WIRE = `M0 ${TOP}Q${SWAG / 2} ${TOP + 2 * SAG} ${SWAG} ${TOP}T${2 * SWAG} ${TOP}`;
const LIGHTS_HEIGHT = 70;

/** A bulb at its socket on the wire, hanging square to it */
const bulbAt = (b: (typeof BULBS)[number]) => `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.angle.toFixed(1)})`;

const Lights = () => (
  <>
    {/* the glow, half of the bulbs to a drawing, so the two can breathe in turn */}
    {[0, 1].map(half => (
      <svg key={half} className="season-christmas-glow absolute inset-x-0 top-0 w-full" height={LIGHTS_HEIGHT} aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`season-christmas-glow-${half}`} width={2 * SWAG} height={LIGHTS_HEIGHT} patternUnits="userSpaceOnUse" x="50%">
            {BULBS.filter(b => b.n % 2 === half).map(b => (
              <circle key={b.n} cx="0" cy="12" r="19" transform={bulbAt(b)} fill={`url(#season-christmas-halo-${b.colour})`} />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height={LIGHTS_HEIGHT} fill={`url(#season-christmas-glow-${half})`} />
      </svg>
    ))}
    <svg className="absolute inset-x-0 top-0 w-full" height={LIGHTS_HEIGHT} aria-hidden="true" focusable="false">
      <defs>
        {BULB_COLOURS.map((c, i) => (
          <radialGradient key={c} id={`season-christmas-halo-${i}`}>
            <stop offset="0" stopColor={c} stopOpacity="0.7" />
            <stop offset="0.4" stopColor={c} stopOpacity="0.26" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
        <pattern id="season-christmas-lights" width={2 * SWAG} height={LIGHTS_HEIGHT} patternUnits="userSpaceOnUse" x="50%">
          <path d={WIRE} fill="none" stroke="#3f5f4c" strokeWidth="1.5" />
          {[0, SWAG, 2 * SWAG].map(x => <circle key={x} cx={x} cy={TOP} r="2.2" fill="#55705f" />)}
          {BULBS.map(b => (
            <g key={b.n} transform={bulbAt(b)}>
              <rect x="-2.6" y="0" width="5.2" height="5" rx="0.9" fill="#284536" />
              <ellipse cx="0" cy="12" rx="4.8" ry="7.6" fill={BULB_COLOURS[b.colour]} />
              <ellipse cx="-1.6" cy="9.8" rx="1.2" ry="2.7" fill="#fff" fillOpacity="0.6" />
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height={LIGHTS_HEIGHT} fill="url(#season-christmas-lights)" />
    </svg>
  </>
);

/** The star over it all: four long rays, four short ones, a soft glow */
const STAR = Array.from({ length: 16 }, (_, k) => {
  const r = k % 2 ? 5.5 : k % 4 ? 17 : 38;
  const a = (k * Math.PI) / 8 - Math.PI / 2;
  return `${k ? "L" : "M"}${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
}).join("") + "Z";

const Star = ({ className }: { className: string }) => (
  <svg viewBox="0 0 120 120" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-christmas-star-glow">
        <stop offset="0.1" stopColor="#fff3cf" stopOpacity="0.5" />
        <stop offset="0.45" stopColor="#ffe6a0" stopOpacity="0.14" />
        <stop offset="1" stopColor="#ffe6a0" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="60" fill="url(#season-christmas-star-glow)" />
    <path d={STAR} fill="#fff7de" />
  </svg>
);

/** A fir in three tiers with baubles, a gold garland and a star on top */
const Tree = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 140" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-christmas-fir" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2fae66" />
        <stop offset="1" stopColor="#0f4a2b" />
      </linearGradient>
      <radialGradient id="season-christmas-tree-star">
        <stop offset="0.2" stopColor="#ffd84a" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffd84a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="43" y="116" width="14" height="18" rx="1.5" fill="#5c3a22" />
    <g fill="url(#season-christmas-fir)" stroke="#0b3a21" strokeWidth="1">
      <path d="M50 58L93 118Q50 128 7 118Z" />
      <path d="M50 34L82 84Q50 92 18 84Z" />
      <path d="M50 14L71 52Q50 58 29 52Z" />
    </g>
    <g fill="none" stroke="#ffd36a" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round">
      <path d="M34 47Q52 53 64 44" />
      <path d="M26 76Q50 86 74 72" />
      <path d="M17 108Q48 120 83 104" />
    </g>
    <g>
      <circle cx="42" cy="40" r="3.4" fill="#ff3346" />
      <circle cx="59" cy="51" r="3.2" fill="#43a6ff" />
      <circle cx="33" cy="70" r="3.8" fill="#ffc23a" />
      <circle cx="62" cy="68" r="3.8" fill="#ff3346" />
      <circle cx="47" cy="88" r="4" fill="#43a6ff" />
      <circle cx="24" cy="100" r="4.2" fill="#ff3346" />
      <circle cx="72" cy="96" r="4.2" fill="#ffc23a" />
      <circle cx="54" cy="112" r="4.2" fill="#ffc23a" />
    </g>
    <circle cx="50" cy="12" r="15" fill="url(#season-christmas-tree-star)" />
    <path d="M50 3.5L52.4 9.2L58.6 9.7L53.9 13.7L55.3 19.8L50 16.6L44.7 19.8L46.1 13.7L41.4 9.7L47.6 9.2Z" fill="#ffd84a" />
  </svg>
);

/** A bow on a present: two loops and a knot */
const Bow = ({ x, y, colour }: { x: number; y: number; colour: string }) => (
  <g fill={colour}>
    <ellipse cx={x - 6} cy={y - 3} rx="6.5" ry="3.6" transform={`rotate(-25 ${x - 6} ${y - 3})`} />
    <ellipse cx={x + 6} cy={y - 3} rx="6.5" ry="3.6" transform={`rotate(25 ${x + 6} ${y - 3})`} />
    <circle cx={x} cy={y} r="2.6" />
  </g>
);

/** Presents piled up: a big red one, a green one, a small blue one in front */
const Presents = ({ className }: { className: string }) => (
  <svg viewBox="0 0 110 84" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <rect x="6" y="34" width="54" height="46" rx="2" fill="#c81a33" />
    <rect x="3" y="27" width="60" height="10" rx="2" fill="#e8293f" />
    <rect x="29" y="27" width="8" height="53" fill="#ffcf4a" />
    <Bow x={33} y={27} colour="#ffcf4a" />
    <rect x="62" y="48" width="40" height="32" rx="2" fill="#178a4e" />
    <rect x="59" y="42" width="46" height="8" rx="2" fill="#20a95f" />
    <rect x="79" y="42" width="6" height="38" fill="#ffe3e7" />
    <Bow x={82} y={42} colour="#ffe3e7" />
    <rect x="40" y="62" width="28" height="18" rx="1.5" fill="#2f74d6" />
    <rect x="52" y="62" width="4" height="18" fill="#ffcf4a" />
  </svg>
);

const ChristmasDecor = () => (
  <>
    <Snow id="season-christmas" top={LIGHTS_HEIGHT} />
    <Lights />
    <Star className="right-2 top-[30px] w-[70px] sm:w-[96px] lg:right-auto lg:left-[calc(50%+300px)] lg:top-[34px] lg:w-[130px]" />
    <Snowflake className="hidden sm:block left-[calc(50%-330px)] top-[96px] sm:w-[26px] lg:left-[calc(50%-430px)] lg:top-[110px] lg:w-[34px] rotate-[10deg]" />
    <Snowflake className="hidden lg:block left-[calc(50%-300px)] top-[70px] w-[22px]" />
    <Snowflake className="hidden md:block left-[calc(50%-520px)] top-[210px] w-[24px] rotate-[22deg]" />
    <Snowflake className="hidden sm:block right-[10%] top-[150px] w-[16px] lg:right-auto lg:left-[calc(50%+470px)] lg:top-[170px] lg:w-[28px] rotate-[-14deg]" />
    <Snowflake className="hidden lg:block left-[calc(50%+250px)] top-[160px] w-[18px]" />
    <Drift id="season-christmas" />
    <Tree className="left-2 bottom-1 w-[50px] sm:w-[70px] md:left-[calc(50%-330px)] md:bottom-2 lg:left-[calc(50%-420px)] lg:w-[104px]" />
    <Presents className="right-2 bottom-1 w-[56px] sm:w-[76px] md:right-auto md:left-[calc(50%+250px)] md:bottom-2 lg:left-[calc(50%+300px)] lg:w-[100px]" />
  </>
);

export default ChristmasDecor;
