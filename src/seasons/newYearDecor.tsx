import type { ReactNode } from "react";

// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: fireworks bursting in
// the sky, a clock at five to midnight, streamers from the top corners,
// confetti, two glasses of champagne clinking and a bottle popping its cork.
// Static SVG like the wall itself (no blur, no filters); only the little
// sparkles twinkle, in newYear.css.

const GOLD = "#ffc94a";
const CHAMPAGNE = "#ffe6a6";
const SILVER = "#e2e8ff";
const BLUE = "#7fa6ff";
const PINK = "#ff6ec7";

/** A burst, 200 across around its middle: rays from the centre, dotted trails, a spark at each end */
const burst = (rays: number, tilt: number) => {
  let inner = "", trail = "";
  const tips: [number, number][] = [];
  for (let i = 0; i < rays; i++) {
    const a = ((i / rays) * 360 + tilt) * (Math.PI / 180);
    const long = i % 2 === 0;
    const pt = (r: number) => [r * Math.cos(a), r * Math.sin(a)] as [number, number];
    const f = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
    inner += `M${f(pt(long ? 14 : 18))}L${f(pt(long ? 44 : 34))}`;
    trail += `M${f(pt(long ? 52 : 42))}L${f(pt(long ? 82 : 62))}`;
    tips.push(pt(long ? 90 : 69));
  }
  return { inner, trail, tips };
};
const BURST_BIG = burst(18, 4);
const BURST_SMALL = burst(12, 15);

const TONES = {
  gold: { ray: GOLD, tip: CHAMPAGNE },
  silver: { ray: BLUE, tip: SILVER },
  pink: { ray: PINK, tip: "#ffd3ef" },
};

const Burst = ({ tone, small, className }: { tone: keyof typeof TONES; small?: boolean; className: string }) => {
  const { ray, tip } = TONES[tone];
  const shape = small ? BURST_SMALL : BURST_BIG;
  return (
    <svg viewBox="-100 -100 200 200" className={`absolute ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`season-new-year-glow-${tone}`}>
          <stop offset="0" stopColor={ray} stopOpacity="0.3" />
          <stop offset="1" stopColor={ray} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="72" fill={`url(#season-new-year-glow-${tone})`} />
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

/** A four-pointed glint; newYear.css makes it twinkle, each at its own `delay` */
const Sparkle = ({ className, delay = 0, color = SILVER }: { className: string; delay?: number; color?: string }) => (
  <svg viewBox="-12 -12 24 24" className={`absolute season-new-year-twinkle ${className}`} style={{ animationDelay: `${delay}s` }} aria-hidden="true" focusable="false">
    <path d="M0 -12Q1.3 -1.3 12 0Q1.3 1.3 0 12Q-1.3 1.3 -12 0Q-1.3 -1.3 0 -12Z" fill={color} />
  </svg>
);

/** Five to midnight */
const CLOCK_TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  const r1 = i % 3 === 0 ? 25 : 28.5;
  return `M${(r1 * Math.sin(a)).toFixed(1)} ${(-r1 * Math.cos(a)).toFixed(1)}L${(33 * Math.sin(a)).toFixed(1)} ${(-33 * Math.cos(a)).toFixed(1)}`;
}).join("");

const Clock = ({ className }: { className: string }) => (
  <svg viewBox="-60 -60 120 120" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-new-year-clock-glow">
        <stop offset="0.5" stopColor="#ffd77a" stopOpacity="0.3" />
        <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="season-new-year-clock-face" cx="42%" cy="38%" r="70%">
        <stop offset="0" stopColor="#fffbef" />
        <stop offset="0.7" stopColor="#f5e6c0" />
        <stop offset="1" stopColor="#dcc08a" />
      </radialGradient>
    </defs>
    <circle r="60" fill="url(#season-new-year-clock-glow)" />
    <circle r="38" fill="url(#season-new-year-clock-face)" stroke="#e2a524" strokeWidth="4.5" />
    <circle r="40.5" fill="none" stroke="#fff1c4" strokeOpacity="0.55" strokeWidth="1" />
    <path d={CLOCK_TICKS} stroke="#5a4626" strokeWidth="2.2" strokeLinecap="round" />
    <g stroke="#3e2f18" strokeLinecap="round">
      <path d="M0 3L0 -19" strokeWidth="4" transform="rotate(-2.5)" />
      <path d="M0 5L0 -29" strokeWidth="2.6" transform="rotate(-30)" />
    </g>
    <circle r="3" fill="#e2a524" />
  </svg>
);

/** Ribbons curling down from the top-left corner, 170 × 170 */
const ribbon = (x: number, length: number, swing: number) => {
  let d = `M${x} 0`;
  for (let y = 0, side = 1; y < length; y += 18, side = -side) {
    d += `C${x + side * swing} ${y + 4} ${x + side * swing} ${y + 14} ${x + side * 2} ${y + 18}`;
    x += 2.2; // drifting a little away from the corner
  }
  return d;
};
const RIBBONS: [string, string][] = [
  [ribbon(12, 150, 11), GOLD],
  [ribbon(48, 96, 9), PINK],
  [ribbon(84, 128, 10), BLUE],
  [ribbon(124, 70, 8), CHAMPAGNE],
];

const Streamers = ({ className }: { className: string }) => (
  <svg viewBox="0 0 170 170" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d="M0 3Q70 16 170 2" fill="none" stroke={SILVER} strokeOpacity="0.35" strokeWidth="1.2" />
    <g fill="none" strokeWidth="3.4" strokeLinecap="round" strokeOpacity="0.9">
      {RIBBONS.map(([d, color]) => <path key={d} d={d} stroke={color} />)}
    </g>
  </svg>
);

/** Confetti strewn over a 300 × 140 patch; the same `seed` lays the same pieces */
const confetti = (seed: number, count: number) => {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const colors = [GOLD, CHAMPAGNE, SILVER, BLUE, PINK, GOLD];
  return Array.from({ length: count }, (_, i) => {
    const x = (rnd() * 300).toFixed(1), y = (rnd() * 140).toFixed(1), turn = Math.round(rnd() * 180);
    const color = colors[Math.floor(rnd() * colors.length)];
    const kind = rnd();
    if (kind < 0.55) return <rect key={i} x="-2" y="-4" width="4" height="8" rx="0.8" fill={color} transform={`translate(${x} ${y}) rotate(${turn})`} />;
    if (kind < 0.8) return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
    return <path key={i} d="M-6 0Q-3 -4 0 0T6 0" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" transform={`translate(${x} ${y}) rotate(${turn})`} />;
  });
};
const CONFETTI_A = confetti(7, 34);
const CONFETTI_B = confetti(23, 34);

const Confetti = ({ pieces, className }: { pieces: ReactNode; className: string }) => (
  <svg viewBox="0 0 300 140" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g opacity="0.85">{pieces}</g>
  </svg>
);

/** A champagne flute standing at the origin, 100 high */
const Flute = ({ transform, id }: { transform: string; id: string }) => (
  <g transform={transform}>
    <path d="M-12.4 -86C-12.2 -66 -9.6 -52 -2 -47L2 -47C9.6 -52 12.2 -66 12.4 -86Z" fill={`url(#${id})`} />
    <g fill="#fff6d8">
      <circle cx="-3" cy="-58" r="1.2" />
      <circle cx="3.5" cy="-66" r="1" />
      <circle cx="-1.5" cy="-74" r="1.3" />
      <circle cx="4" cy="-80" r="0.9" />
    </g>
    <path d="M-13 -100C-13 -70 -10 -52 -2 -46L2 -46C10 -52 13 -70 13 -100" fill="#ffffff" fillOpacity="0.06" stroke={SILVER} strokeOpacity="0.8" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M-9 -96C-9 -78 -8 -64 -5 -56" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M0 -46V-5" stroke={SILVER} strokeOpacity="0.8" strokeWidth="2.2" />
    <ellipse cx="0" cy="-3.5" rx="13" ry="3.2" fill="#ffffff" fillOpacity="0.08" stroke={SILVER} strokeOpacity="0.8" strokeWidth="1.5" />
  </g>
);

const Glasses = ({ className }: { className: string }) => (
  <svg viewBox="0 0 120 112" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-new-year-bubbly" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe9a3" />
        <stop offset="1" stopColor="#e2a524" />
      </linearGradient>
    </defs>
    <Flute id="season-new-year-bubbly" transform="translate(32 108) rotate(10)" />
    <Flute id="season-new-year-bubbly" transform="translate(88 108) rotate(-10)" />
    <g stroke={CHAMPAGNE} strokeWidth="1.6" strokeLinecap="round">
      <path d="M60 2V-5M51 6L46 1M69 6L74 1" transform="translate(0 6)" />
    </g>
  </svg>
);

/** A bottle of champagne at an angle, its cork flying off in a spray */
const Bottle = ({ className }: { className: string }) => (
  <svg viewBox="0 0 110 124" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-new-year-bottle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0d3b2b" />
        <stop offset="0.45" stopColor="#1f6a4c" />
        <stop offset="1" stopColor="#0a2a1f" />
      </linearGradient>
    </defs>
    <g transform="translate(34 118) rotate(28)">
      <path d="M-14 0L-14 -46C-14 -56 -6 -60 -5 -68L-5 -86L5 -86L5 -68C6 -60 14 -56 14 -46L14 0Q14 3 11 3L-11 3Q-14 3 -14 0Z" fill="url(#season-new-year-bottle)" stroke="#05170f" strokeWidth="1" />
      <path d="M-5.8 -87L5.8 -87L5.8 -70C6.4 -64 9 -61 10.5 -59L-10.5 -59C-9 -61 -6.4 -64 -5.8 -70Z" fill={GOLD} stroke="#b37a12" strokeWidth="0.8" />
      <rect x="-11.5" y="-38" width="23" height="17" rx="1.5" fill={CHAMPAGNE} stroke="#c9922a" strokeWidth="1" />
      <path d="M-6 -30H6M-4 -26H4" stroke="#b37a12" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M-9 -48V-6" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2.2" strokeLinecap="round" />
      <g fill={CHAMPAGNE}>
        <circle cx="0" cy="-93" r="2" />
        <circle cx="-4" cy="-99" r="1.6" />
        <circle cx="4.5" cy="-100" r="1.8" />
        <circle cx="-8" cy="-106" r="1.3" />
        <circle cx="1" cy="-108" r="1.4" />
        <circle cx="9" cy="-108" r="1.2" />
        <circle cx="-3" cy="-115" r="1" />
        <circle cx="6" cy="-117" r="1" />
      </g>
      <g transform="translate(-1 -128) rotate(-24)">
        <rect x="-4.5" y="-6" width="9" height="12" rx="2.4" fill="#d9ad74" stroke="#8a6232" strokeWidth="1" />
      </g>
      <path d="M-11 -121L-15 -125M10 -122L14 -127M-1 -138V-143" stroke={SILVER} strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  </svg>
);

const NewYearDecor = () => (
  <>
    <Streamers className="left-0 top-0 w-[86px] sm:w-[140px]" />
    <Streamers className="hidden xl:block right-0 top-0 w-[140px] -scale-x-100" />
    <Confetti pieces={CONFETTI_B} className="left-[24%] top-[2px] w-[200px] sm:left-[calc(50%-150px)] sm:-top-[36px] sm:w-[300px] xl:hidden" />
    <Confetti pieces={CONFETTI_A} className="hidden xl:block left-[calc(50%-660px)] top-[150px] w-[300px]" />
    <Confetti pieces={CONFETTI_B} className="hidden xl:block left-[calc(50%+360px)] top-[170px] w-[300px]" />
    <Burst tone="gold" className="left-[30%] -top-[6px] w-[78px] sm:left-[calc(50%-230px)] sm:top-[2px] sm:w-[110px] xl:left-[calc(50%-520px)] xl:top-[6px] xl:w-[200px]" />
    <Burst tone="pink" small className="hidden sm:block left-[calc(50%-80px)] top-[-10px] w-[64px] xl:left-[calc(50%-240px)] xl:top-[-12px] xl:w-[96px]" />
    <Burst tone="silver" className="right-[84px] top-[26px] w-[44px] sm:right-auto sm:left-[calc(50%+120px)] sm:top-[-18px] sm:w-[96px] lg:left-[calc(50%+110px)] lg:top-[-28px] lg:w-[140px]" />
    <Burst tone="gold" small className="hidden xl:block left-[calc(50%+450px)] top-[150px] w-[110px]" />
    <Clock className="right-1 top-0 w-[74px] sm:w-[104px] lg:right-auto lg:left-[calc(50%+300px)] lg:top-[4px] lg:w-[150px]" />
    <Sparkle className="left-[16%] top-[98px] w-[12px] sm:left-[calc(50%-360px)] sm:top-[150px] sm:w-[16px]" delay={0} />
    <Sparkle className="right-[22%] top-[70px] w-[10px] sm:right-auto sm:left-[calc(50%+250px)] sm:top-[120px] sm:w-[14px]" delay={1.3} color={CHAMPAGNE} />
    <Sparkle className="hidden sm:block left-[calc(50%+20px)] top-[50px] w-[12px] xl:left-[calc(50%-80px)] xl:top-[40px]" delay={2.1} />
    <Sparkle className="hidden md:block left-[calc(50%+330px)] top-[250px] w-[18px]" delay={0.7} color={CHAMPAGNE} />
    <Sparkle className="hidden lg:block left-[calc(50%-440px)] top-[280px] w-[14px]" delay={1.8} />
    <Sparkle className="hidden xl:block left-[calc(50%+520px)] top-[60px] w-[16px]" delay={2.6} color={CHAMPAGNE} />
    <Glasses className="left-2 bottom-2 w-[56px] sm:w-[74px] md:left-[calc(50%-330px)] md:bottom-3 lg:left-[calc(50%-430px)] lg:w-[108px]" />
    <Bottle className="right-2 bottom-2 w-[50px] sm:w-[66px] md:right-auto md:left-[calc(50%+250px)] md:bottom-3 lg:left-[calc(50%+320px)] lg:w-[100px]" />
  </>
);

export default NewYearDecor;
