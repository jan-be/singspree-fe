// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: bunting along the
// top, shamrocks, a rainbow coming down into a pot of gold and a
// leprechaun's hat. Static SVG like the wall itself (no blur, no
// animation).

/** A shamrock: three heart-shaped leaves around the middle, the stem below */
const LEAF = "M0 0C-3 -5 -15 -9 -15 -19C-15 -27 -5 -30 0 -23C5 -30 15 -27 15 -19C15 -9 3 -5 0 0Z";

const Shamrock = ({ className }: { className: string }) => (
  <svg viewBox="-34 -34 68 72" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-st-patricks-leaf" cx="50%" cy="35%" r="75%">
        <stop offset="0" stopColor="#6ff2a6" />
        <stop offset="0.55" stopColor="#1fb864" />
        <stop offset="1" stopColor="#0b7a3e" />
      </radialGradient>
    </defs>
    <path d="M1 3Q4 20 13 34" fill="none" stroke="#0e6b39" strokeWidth="3.2" strokeLinecap="round" />
    {[0, 120, 240].map(a => (
      <g key={a} transform={`rotate(${a})`}>
        <path d={LEAF} fill="url(#season-st-patricks-leaf)" stroke="#06502a" strokeWidth="1" />
        <path d="M0 -3V-19" stroke="#d2ffe2" strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    ))}
  </svg>
);

/** One swag of the bunting, 240 wide: the string sags 20 in the middle, a flag every 30 hangs from it */
const SWAG_FLAGS = Array.from({ length: 8 }, (_, i) => {
  const x = 15 + i * 30;
  const t = x / 240;
  const y = 3 + 40 * t * (1 - t);
  return { d: `M${x - 10} ${y.toFixed(1)}H${x + 10}L${x} ${(y + 24).toFixed(1)}Z`, fill: ["#1db368", "#f3ead2", "#f2b52c", "#0f7f47"][i % 4] };
});

/** The bunting along the top of the wall: one swag repeated across the whole width (smaller on phones) */
const Bunting = ({ id, scale, className }: { id: string; scale: number; className: string }) => (
  <svg className={`absolute left-0 top-0 w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={id} width="240" height="56" patternUnits="userSpaceOnUse" x="50%" patternTransform={`scale(${scale})`}>
        <path d="M0 3Q120 43 240 3" fill="none" stroke="#d9cfae" strokeOpacity="0.55" strokeWidth="1.4" />
        {SWAG_FLAGS.map(f => <path key={f.d} d={f.d} fill={f.fill} fillOpacity="0.88" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />)}
        <circle cx="0" cy="3" r="2.6" fill="#f2b52c" />
        <circle cx="240" cy="3" r="2.6" fill="#f2b52c" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/** A gold coin lying in the heap, or standing on its edge */
const Coin = ({ x, y, standing }: { x: number; y: number; standing?: boolean }) => standing ? (
  <g>
    <circle cx={x} cy={y} r="7" fill="url(#season-st-patricks-gold)" stroke="#9a6a08" strokeWidth="1" />
    <circle cx={x} cy={y} r="4.4" fill="none" stroke="#fff2b0" strokeOpacity="0.55" strokeWidth="0.9" />
  </g>
) : (
  <g>
    <ellipse cx={x} cy={y + 1.2} rx="7.5" ry="4.2" fill="#9a6a08" />
    <ellipse cx={x} cy={y} rx="7.5" ry="4.2" fill="url(#season-st-patricks-gold)" stroke="#9a6a08" strokeWidth="0.8" />
  </g>
);

/** A glint on the gold: a four-pointed star */
const Glint = ({ x, y, size }: { x: number; y: number; size: number }) => (
  <path
    d={`M${x} ${y - size}Q${x} ${y} ${x + size} ${y}Q${x} ${y} ${x} ${y + size}Q${x} ${y} ${x - size} ${y}Q${x} ${y} ${x} ${y - size}Z`}
    fill="#fffbe0"
  />
);

/** A black pot brimming with gold, 100 × 90; drawn alone and at the rainbow's foot */
const PotOfGold = () => (
  <>
    <defs>
      <radialGradient id="season-st-patricks-gold" cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor="#fff1a0" />
        <stop offset="0.5" stopColor="#ffd23f" />
        <stop offset="1" stopColor="#d79a12" />
      </radialGradient>
      <radialGradient id="season-st-patricks-pot" cx="38%" cy="30%" r="80%">
        <stop offset="0" stopColor="#4a4f57" />
        <stop offset="0.6" stopColor="#1b1e22" />
        <stop offset="1" stopColor="#0b0c0e" />
      </radialGradient>
      <radialGradient id="season-st-patricks-pot-glow">
        <stop offset="0.25" stopColor="#ffd23f" stopOpacity="0.38" />
        <stop offset="1" stopColor="#ffd23f" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="44" rx="50" ry="40" fill="url(#season-st-patricks-pot-glow)" />
    <path d="M22 80L18 89M78 80L82 89" stroke="#0b0c0e" strokeWidth="5" strokeLinecap="round" />
    <path d="M13 42C8 66 22 85 50 85C78 85 92 66 87 42Z" fill="url(#season-st-patricks-pot)" stroke="#2e3238" strokeWidth="1" />
    <path d="M22 52C21 63 26 72 34 77" fill="none" stroke="#9aa3ad" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" />
    {/* the heap: coins piled above the rim */}
    <path d="M16 41C22 24 36 17 50 17C64 17 78 24 84 41Z" fill="url(#season-st-patricks-gold)" />
    <Coin x={30} y={33} />
    <Coin x={46} y={27} />
    <Coin x={62} y={30} />
    <Coin x={74} y={37} />
    <Coin x={40} y={37} />
    <Coin x={56} y={22} standing />
    <Coin x={36} y={23} standing />
    <ellipse cx="50" cy="42" rx="38" ry="6.5" fill="none" stroke="#3a4048" strokeWidth="4" />
    <Glint x={47} y={16} size={6} />
    <Glint x={70} y={29} size={4.5} />
  </>
);

const Pot = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 90" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <PotOfGold />
  </svg>
);

/** A rainbow rising out of the pot of gold and coming down behind a cloud */
const RAINBOW = ["#ff5a5a", "#ff9d3c", "#ffe14d", "#4fdc7c", "#4aa8ff", "#9c6bff"];

const RainbowPot = ({ className }: { className: string }) => (
  <svg viewBox="0 0 420 270" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <g fill="none" strokeWidth="8.4" strokeOpacity="0.62">
      {RAINBOW.map((c, i) => {
        const r = 166 - i * 8;
        return <path key={c} d={`M${246 - r} 236A${r} ${r} 0 0 1 ${246 + r} 236`} stroke={c} />;
      })}
    </g>
    {/* the cloud over the far foot */}
    <g fill="#e9eef7" fillOpacity="0.9">
      <circle cx="364" cy="230" r="22" />
      <circle cx="392" cy="222" r="26" />
      <circle cx="404" cy="242" r="16" />
      <rect x="342" y="232" width="78" height="24" rx="12" />
    </g>
    <g fill="#b9c4d8" fillOpacity="0.55">
      <rect x="346" y="246" width="70" height="10" rx="5" />
    </g>
    <g transform="translate(50 180)">
      <PotOfGold />
    </g>
  </svg>
);

/** A leprechaun's hat: green top hat, black band, gold buckle, a shamrock in the band */
const Hat = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 82" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-st-patricks-hat" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0b5e31" />
        <stop offset="0.4" stopColor="#1fa65c" />
        <stop offset="1" stopColor="#0a4d29" />
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="70" rx="47" ry="10" fill="#0a4d29" stroke="#06381d" strokeWidth="1" />
    <path d="M25 68L29 13Q50 6 71 13L75 68Q50 76 25 68Z" fill="url(#season-st-patricks-hat)" stroke="#06381d" strokeWidth="1" />
    <ellipse cx="50" cy="13" rx="21" ry="5" fill="#26b868" stroke="#06381d" strokeWidth="1" />
    <path d="M26.5 50Q50 57 73.5 50L74.3 61Q50 68 25.7 61Z" fill="#111" />
    <rect x="42" y="49.5" width="16" height="14" rx="1.5" fill="none" stroke="#ffd23f" strokeWidth="3" />
    <g transform="translate(33 48) scale(0.32) rotate(-18)">
      <path d="M1 3Q4 20 13 34" fill="none" stroke="#0e6b39" strokeWidth="5" strokeLinecap="round" />
      {[0, 120, 240].map(a => <path key={a} d={LEAF} transform={`rotate(${a})`} fill="#3fd57f" stroke="#06502a" strokeWidth="2" />)}
    </g>
  </svg>
);

const StPatricksDecor = () => (
  <>
    <Bunting id="season-st-patricks-bunting" scale={1} className="hidden sm:block h-[56px]" />
    <Bunting id="season-st-patricks-bunting-small" scale={0.6} className="sm:hidden h-[34px]" />
    <Shamrock className="left-2 top-[46px] w-[30px] sm:left-6 sm:top-[74px] sm:w-[44px] lg:left-[calc(50%-600px)] lg:top-[96px] lg:w-[62px] -rotate-[14deg]" />
    <Shamrock className="hidden md:block left-[calc(50%-470px)] top-[230px] w-[34px] lg:left-[calc(50%-520px)] lg:top-[250px] rotate-[22deg]" />
    <Shamrock className="hidden lg:block left-[calc(50%-640px)] top-[330px] w-[26px] rotate-[-30deg]" />
    <Shamrock className="right-3 top-[52px] w-[24px] sm:right-8 sm:top-[80px] sm:w-[36px] lg:right-auto lg:left-[calc(50%+420px)] lg:top-[96px] lg:w-[42px] rotate-[18deg]" />
    <Shamrock className="hidden lg:block left-[calc(50%+600px)] top-[170px] w-[30px] rotate-[-8deg]" />
    <RainbowPot className="hidden lg:block left-[calc(50%+250px)] bottom-1 w-[400px]" />
    <Pot className="right-2 bottom-2 w-[52px] sm:w-[68px] md:right-auto md:left-[calc(50%+250px)] md:bottom-3 lg:hidden" />
    <Hat className="left-2 bottom-2 w-[54px] sm:w-[70px] md:left-[calc(50%-330px)] md:bottom-3 lg:left-[calc(50%-420px)] lg:w-[88px] -rotate-[6deg]" />
  </>
);

export default StPatricksDecor;
