// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: a neon heart beside
// it, hearts floating up the bricks, one with Cupid's arrow through it, and
// roses at its foot. Static SVG like the wall itself (no blur, no animation);
// the neon heart's beat is in valentines.css.

/** A heart, 100 × 84 around its middle */
const HEART = "M0 40C-14 29 -47 7 -47 -16C-47 -33 -34 -43 -21 -43C-11 -43 -4 -37 0 -29C4 -37 11 -43 21 -43C34 -43 47 -33 47 -16C47 7 14 29 0 40Z";

/** The gradients the drawings share, defined once for the page */
const Defs = () => (
  <svg className="absolute w-0 h-0" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-valentines-rose" cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="#ff7088" />
        <stop offset="0.55" stopColor="#e8264f" />
        <stop offset="1" stopColor="#9e1238" />
      </radialGradient>
      <radialGradient id="season-valentines-blush" cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="#ffd6e0" />
        <stop offset="0.55" stopColor="#ff9fb8" />
        <stop offset="1" stopColor="#d9587e" />
      </radialGradient>
      <radialGradient id="season-valentines-halo">
        <stop offset="0.35" stopColor="#ff2d55" stopOpacity="0.28" />
        <stop offset="1" stopColor="#ff2d55" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="season-valentines-petal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff4d6d" />
        <stop offset="1" stopColor="#a8113c" />
      </linearGradient>
      <linearGradient id="season-valentines-cup" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff6b85" />
        <stop offset="0.5" stopColor="#e01e4b" />
        <stop offset="1" stopColor="#8a0f33" />
      </linearGradient>
    </defs>
  </svg>
);

const Heart = ({ className, tone = "rose" }: { className: string; tone?: "rose" | "blush" }) => (
  <svg viewBox="-50 -46 100 88" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={HEART} fill={`url(#season-valentines-${tone})`} stroke={tone === "rose" ? "#ff8fa3" : "#ffe3ea"} strokeOpacity="0.5" strokeWidth="2" />
    <path d="M-33 -20Q-32 -32 -20 -34" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

/** A heart-shaped neon tube beside the sign, drawn like the sign's own: glow, tube, white-hot core */
const NeonHeart = ({ className }: { className: string }) => (
  <svg viewBox="-62 -58 124 112" className={`absolute season-valentines-beat ${className}`} aria-hidden="true" focusable="false">
    <circle r="58" fill="url(#season-valentines-halo)" />
    <g fill="none" stroke="#ff2d55" strokeLinejoin="round">
      <path d={HEART} strokeWidth="17" strokeOpacity="0.13" />
      <path d={HEART} strokeWidth="11" strokeOpacity="0.3" />
      <path d={HEART} strokeWidth="6" />
      <path d={HEART} stroke="#ffe3e8" strokeWidth="1.8" />
    </g>
  </svg>
);

/** Cupid's arrow: its shaft, then the feathers at the tail, 12 units apart along it */
const ARROW = (() => {
  const [tx, ty, hx, hy] = [8, 104, 150, 23];
  const len = Math.hypot(hx - tx, hy - ty);
  const [dx, dy] = [(hx - tx) / len, (hy - ty) / len];
  const [nx, ny] = [-dy, dx];
  let feathers = "";
  for (const k of [4, 11, 18]) {
    const [px, py] = [tx + k * dx, ty + k * dy];
    for (const side of [1, -1]) {
      feathers += `M${px.toFixed(1)} ${py.toFixed(1)}L${(px - 9 * dx + side * 8 * nx).toFixed(1)} ${(py - 9 * dy + side * 8 * ny).toFixed(1)}`;
    }
  }
  const head = [[hx, hy], [hx - 13 * dx + 6 * nx, hy - 13 * dy + 6 * ny], [hx - 13 * dx - 6 * nx, hy - 13 * dy - 6 * ny]]
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";
  return { shaft: `M${tx} ${ty}L${(hx - 10 * dx).toFixed(1)} ${(hy - 10 * dy).toFixed(1)}`, feathers, head };
})();

/** A heart with Cupid's arrow through it: the shaft behind the heart, its ends showing */
const ArrowHeart = ({ className }: { className: string }) => (
  <svg viewBox="0 0 160 124" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={ARROW.shaft} stroke="#f2c46d" strokeWidth="3" strokeLinecap="round" />
    <path d={ARROW.feathers} stroke="#ffe7b0" strokeWidth="2.2" strokeLinecap="round" />
    <g transform="translate(80 64) scale(0.92)">
      <path d={HEART} fill="url(#season-valentines-rose)" stroke="#ff8fa3" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M-33 -20Q-32 -32 -20 -34" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
    </g>
    <path d={ARROW.head} fill="#f2c46d" />
  </svg>
);

/** A rose in bloom from the side, about 40 × 50 around its middle: back petals, the bud between two wrapping ones, the cup in front, green sepals below */
const Bloom = ({ transform }: { transform: string }) => (
  <g transform={transform}>
    <path d="M-19 -2C-23 -14 -15 -25 -6 -22C-3 -27 3 -27 6 -22C15 -25 23 -14 19 -2Z" fill="#9e1238" stroke="#5c0820" strokeWidth="0.8" />
    <path d="M-9 -10C-9 -19 9 -19 9 -10C5 -7 -5 -7 -9 -10Z" fill="url(#season-valentines-petal)" stroke="#5c0820" strokeWidth="0.8" />
    <path d="M-4 -12C-3 -16 4 -16 4 -12" fill="none" stroke="#6e0a26" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M-19 -2C-20 -13 -9 -16 1 -12C-4 -7 -3 3 3 10C-12 10 -18 6 -19 -2Z" fill="url(#season-valentines-petal)" stroke="#5c0820" strokeWidth="0.8" />
    <path d="M19 -2C20 -13 9 -16 -1 -12C4 -7 3 3 -3 10C12 10 18 6 19 -2Z" fill="url(#season-valentines-petal)" stroke="#5c0820" strokeWidth="0.8" />
    <path d="M-17 0C-12 5 12 5 17 0C16 14 8 22 0 22C-8 22 -16 14 -17 0Z" fill="url(#season-valentines-cup)" stroke="#5c0820" strokeWidth="0.8" />
    <path d="M-10 6C-5 9 5 9 10 6" fill="none" stroke="#ff8fa3" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M-3 20C-8 21 -15 21 -19 26C-11 27 -5 25 -1 22ZM3 20C8 21 15 21 19 26C11 27 5 25 1 22Z" fill="#2f7a46" stroke="#1d4a2b" strokeWidth="0.8" />
  </g>
);

/** Two roses on their stems with leaves, and a few fallen petals */
const Roses = ({ className }: { className: string }) => (
  <svg viewBox="0 0 120 96" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g stroke="#2f6b3f" strokeWidth="3" strokeLinecap="round" fill="none">
      <path d="M40 54Q46 76 58 94" />
      <path d="M82 58Q74 78 62 94" />
    </g>
    <g fill="#2f7a46" stroke="#1d4a2b" strokeWidth="1">
      <path d="M47 72Q30 66 24 76Q38 84 47 72Z" />
      <path d="M72 74Q89 66 97 75Q83 85 72 74Z" />
    </g>
    <Bloom transform="translate(82 38) rotate(14) scale(0.82)" />
    <Bloom transform="translate(40 32) rotate(-8)" />
    <g fill="#e8264f" fillOpacity="0.85">
      <path d="M10 90Q14 82 20 88Q15 94 10 90Z" />
      <path d="M100 91Q107 85 111 92Q104 96 100 91Z" />
      <path d="M86 94Q90 88 95 93Q90 97 86 94Z" />
    </g>
  </svg>
);

const ValentinesDecor = () => (
  <>
    <Defs />
    <NeonHeart className="right-2 top-1 w-[70px] sm:w-[96px] lg:right-auto lg:left-[calc(50%+262px)] lg:top-1 lg:w-[150px]" />
    <ArrowHeart className="hidden md:block left-3 top-[30px] w-[100px] lg:left-[calc(50%-480px)] lg:top-[40px] lg:w-[150px] rotate-[-6deg]" />
    <Heart className="left-3 top-[22px] w-[24px] sm:left-6 sm:top-[40px] sm:w-[30px] md:left-[14px] md:top-[170px] lg:left-[calc(50%-520px)] lg:top-[150px] rotate-[-12deg]" tone="blush" />
    <Heart className="left-[32%] top-[10px] w-[16px] sm:left-[calc(50%-270px)] sm:top-[26px] sm:w-[22px] rotate-[10deg]" />
    <Heart className="hidden lg:block left-[calc(50%-600px)] top-[40px] w-[22px] rotate-[8deg]" />
    <Heart className="hidden md:block left-[calc(50%+440px)] top-[44px] w-[30px] rotate-[14deg]" />
    <Heart className="hidden lg:block left-[calc(50%+540px)] top-[170px] w-[22px] rotate-[-8deg]" tone="blush" />
    <Heart className="hidden md:block left-[calc(50%+250px)] top-[300px] w-[24px] rotate-[-10deg]" tone="blush" />
    <Roses className="left-1 bottom-1 w-[66px] sm:w-[86px] md:left-[calc(50%-340px)] md:bottom-2 lg:left-[calc(50%-430px)] lg:w-[112px]" />
    <Roses className="right-1 bottom-1 w-[56px] sm:w-[74px] md:right-auto md:left-[calc(50%+250px)] md:bottom-2 lg:left-[calc(50%+320px)] lg:w-[96px] -scale-x-100" />
  </>
);

export default ValentinesDecor;
