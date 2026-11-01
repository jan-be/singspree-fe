// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: a Jolly Roger, a
// treasure map with its X, a crescent moon over a pirate ship, an open
// chest of gold and the sea rolling along the foot of the wall. Static SVG
// like the wall itself (no blur, no animation).

/** The Jolly Roger on its pole: a black flag in the wind, a skull over crossed bones */
const Flag = ({ className }: { className: string }) => (
  <svg viewBox="0 0 130 112" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <rect x="5" y="6" width="4.5" height="104" rx="2" fill="#7a5532" stroke="#3d2914" strokeWidth="0.8" />
    <circle cx="7.25" cy="5" r="4.2" fill="#e3b04a" stroke="#8a6214" strokeWidth="0.8" />
    <path d="M9.5 10Q40 2 68 10T126 9V72Q98 64 68 72T9.5 74Z" fill="#14171c" stroke="#3a4049" strokeWidth="1" />
    <path d="M9.5 10Q40 2 68 10T126 9" fill="none" stroke="#5a626e" strokeOpacity="0.6" strokeWidth="1" />
    {/* the crossed bones, then the skull over them */}
    <g stroke="#efe8d6" strokeWidth="5.5" strokeLinecap="round">
      <path d="M48 64L88 46M48 46L88 64" />
    </g>
    <g fill="#efe8d6">
      {[[46, 66], [46, 44], [90, 44], [90, 66]].map(([x, y]) => (
        <g key={`${x} ${y}`}>
          <circle cx={x - 2.4} cy={y - 1.6} r="3.6" />
          <circle cx={x + 1.6} cy={y + 2.4} r="3.6" />
        </g>
      ))}
      <circle cx="68" cy="33" r="14.5" />
      <rect x="59.5" y="38" width="17" height="12" rx="3.5" />
    </g>
    <g fill="#14171c">
      <ellipse cx="62" cy="33" rx="4.4" ry="4.8" />
      <ellipse cx="74" cy="33" rx="4.4" ry="4.8" />
      <path d="M68 38L65.6 42.5H70.4Z" />
      <rect x="63.4" y="45.5" width="1.6" height="4.5" />
      <rect x="67.2" y="45.5" width="1.6" height="4.5" />
      <rect x="71" y="45.5" width="1.6" height="4.5" />
    </g>
  </svg>
);

/** A torn treasure map: an island, the dotted way to the X, a compass rose and a few waves */
const TreasureMap = ({ className }: { className: string }) => (
  <svg viewBox="0 0 132 100" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-pirate-day-parchment" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f3e2b6" />
        <stop offset="0.6" stopColor="#e2c48a" />
        <stop offset="1" stopColor="#c49a5a" />
      </linearGradient>
    </defs>
    <path d="M6 10Q20 4 34 9T64 7T96 10T126 6L123 30Q128 52 121 70T125 94Q96 99 66 92T8 96Q12 74 6 52T6 10Z" fill="url(#season-pirate-day-parchment)" stroke="#8a6a3a" strokeWidth="1.2" />
    {/* the island */}
    <path d="M66 32Q82 16 106 22Q122 32 108 46Q90 54 74 46Q60 40 66 32Z" fill="#b99a5c" fillOpacity="0.55" stroke="#7a5a30" strokeWidth="1.2" />
    <path d="M86 30L88 22M88 22Q83 20 80 23M88 22Q93 19 96 22M88 22Q86 17 89 15" fill="none" stroke="#5f6e2c" strokeWidth="1.3" strokeLinecap="round" />
    {/* the way there and the X */}
    <path d="M20 84Q34 58 52 66T82 48T98 36" fill="none" stroke="#8a3b2a" strokeWidth="1.8" strokeDasharray="4 3.5" strokeLinecap="round" />
    <path d="M94 30L104 40M104 30L94 40" stroke="#c8231f" strokeWidth="3.4" strokeLinecap="round" />
    {/* the compass rose */}
    <circle cx="26" cy="32" r="11" fill="none" stroke="#8a6a3a" strokeWidth="1" />
    <path d="M26 17L28.5 29.5L41 32L28.5 34.5L26 47L23.5 34.5L11 32L23.5 29.5Z" fill="#8a3b2a" fillOpacity="0.85" />
    <path d="M26 17L28.5 29.5L26 32Z" fill="#c8231f" />
    {/* the sea's little waves */}
    <g fill="none" stroke="#6f7f86" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round">
      <path d="M44 22Q47 19 50 22T56 22" />
      <path d="M100 66Q103 63 106 66T112 66" />
      <path d="M58 84Q61 81 64 84T70 84" />
    </g>
  </svg>
);

/** A crescent moon with its glow and a few stars */
const Moon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 100" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-pirate-day-moon-glow">
        <stop offset="0.3" stopColor="#fff1c4" stopOpacity="0.3" />
        <stop offset="1" stopColor="#fff1c4" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="48" cy="50" r="50" fill="url(#season-pirate-day-moon-glow)" />
    <path d="M60 21A30 30 0 1 0 60 79A34 34 0 0 1 60 21Z" fill="#fff4d2" />
    <g fill="#fff4d2">
      <circle cx="84" cy="22" r="1.6" />
      <circle cx="90" cy="64" r="1.2" />
      <circle cx="12" cy="14" r="1.1" />
    </g>
  </svg>
);

/** A sail filling with wind, `w` wide, `h` high, its top at x, y */
const sail = (x: number, y: number, w: number, h: number) =>
  `M${x - w / 2} ${y}Q${x} ${y + 4} ${x + w / 2} ${y}Q${x + w / 2 + 5} ${y + h / 2} ${x + w / 2} ${y + h}Q${x} ${y + h + 7} ${x - w / 2} ${y + h}Q${x - w / 2 + 5} ${y + h / 2} ${x - w / 2} ${y}Z`;

/** A three-master under full sail, the Jolly Roger on the main mast, lantern light in the stern */
const Ship = ({ className }: { className: string }) => (
  <svg viewBox="0 0 210 180" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-pirate-day-hull" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a371c" />
        <stop offset="1" stopColor="#24150a" />
      </linearGradient>
      <linearGradient id="season-pirate-day-sail" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c9b78f" />
        <stop offset="0.5" stopColor="#f0e4c4" />
        <stop offset="1" stopColor="#bfa97d" />
      </linearGradient>
    </defs>
    {/* the rigging */}
    <g fill="none" stroke="#cdbb98" strokeOpacity="0.45" strokeWidth="0.8">
      <path d="M6 112L62 26M62 26L104 12M104 12L146 30M146 30L192 108M62 26L40 128M104 12L104 128M146 30L168 124" />
    </g>
    {/* the masts and the bowsprit */}
    <g stroke="#4a2f17" strokeWidth="3" strokeLinecap="round">
      <path d="M62 132V24M104 132V10M146 132V28" />
      <path d="M30 124L4 110" strokeWidth="2.4" />
    </g>
    {/* the sails */}
    <g fill="url(#season-pirate-day-sail)" stroke="#8f7a52" strokeWidth="0.8">
      <path d={sail(62, 36, 40, 30)} />
      <path d={sail(62, 72, 48, 34)} />
      <path d={sail(104, 22, 44, 34)} />
      <path d={sail(104, 62, 54, 40)} />
      <path d={sail(146, 40, 38, 28)} />
      <path d={sail(146, 74, 46, 32)} />
      <path d="M30 120L58 46L58 116Z" />
    </g>
    {/* the Jolly Roger at the top of the main mast */}
    <path d="M105 9Q114 6 124 9V21Q114 18 105 21Z" fill="#14171c" stroke="#3a4049" strokeWidth="0.6" />
    <circle cx="114.5" cy="13.6" r="2.6" fill="#efe8d6" />
    <path d="M110.5 18.5L118.5 15.5M110.5 15.5L118.5 18.5" stroke="#efe8d6" strokeWidth="1" />
    {/* the hull: the stern castle, the gunwale in gold, the gun ports, the lit windows */}
    <path d="M150 118V100H194L190 118Z" fill="url(#season-pirate-day-hull)" stroke="#120a04" strokeWidth="1" />
    <path d="M12 116L196 112Q188 150 160 160H54Q24 154 12 116Z" fill="url(#season-pirate-day-hull)" stroke="#120a04" strokeWidth="1" />
    <path d="M12 116L196 112" stroke="#d9a53a" strokeWidth="2" />
    <path d="M150 100H194" stroke="#d9a53a" strokeWidth="1.6" />
    <g fill="#120a04">
      {[40, 62, 84, 106, 128, 150].map(x => <rect key={x} x={x} y="124" width="9" height="7" rx="1" />)}
    </g>
    <g fill="#ffcf5a">
      <rect x="160" y="105" width="6" height="7" rx="1" />
      <rect x="172" y="105" width="6" height="7" rx="1" />
      <rect x="184" y="105" width="5" height="7" rx="1" />
    </g>
  </svg>
);

/** A gold coin in the heap, lying flat */
const Coin = ({ x, y }: { x: number; y: number }) => (
  <g>
    <ellipse cx={x} cy={y + 1.2} rx="6.5" ry="3.6" fill="#9a6a08" />
    <ellipse cx={x} cy={y} rx="6.5" ry="3.6" fill="url(#season-pirate-day-gold)" stroke="#9a6a08" strokeWidth="0.7" />
  </g>
);

/** An open treasure chest brimming with gold, jewels and pearls */
const Chest = ({ className }: { className: string }) => (
  <svg viewBox="0 0 120 100" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-pirate-day-gold" cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor="#fff1a0" />
        <stop offset="0.5" stopColor="#ffd23f" />
        <stop offset="1" stopColor="#d79a12" />
      </radialGradient>
      <radialGradient id="season-pirate-day-chest-glow">
        <stop offset="0.25" stopColor="#ffd23f" stopOpacity="0.4" />
        <stop offset="1" stopColor="#ffd23f" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="season-pirate-day-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8a5428" />
        <stop offset="1" stopColor="#4a2a12" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="42" rx="60" ry="42" fill="url(#season-pirate-day-chest-glow)" />
    {/* the lid, open behind it */}
    <path d="M14 46L19 14Q60 4 101 14L106 46Z" fill="#3a200c" stroke="#24130a" strokeWidth="1" />
    <path d="M19 14Q60 4 101 14" fill="none" stroke="#d9a53a" strokeWidth="2.4" />
    {/* the treasure */}
    <path d="M14 48Q26 26 60 24Q94 26 106 48Z" fill="url(#season-pirate-day-gold)" />
    <Coin x={30} y={40} />
    <Coin x={46} y={33} />
    <Coin x={66} y={30} />
    <Coin x={84} y={37} />
    <Coin x={56} y={42} />
    <path d="M36 30Q50 40 64 36T92 30" fill="none" stroke="#fffaf0" strokeWidth="2.6" strokeDasharray="0.1 4" strokeLinecap="round" />
    <path d="M74 22L79 27L74 33L69 27Z" fill="#e8304a" stroke="#7a0a1e" strokeWidth="0.7" />
    <path d="M40 24L44 28L40 32L36 28Z" fill="#2fd17a" stroke="#0b5e31" strokeWidth="0.7" />
    <circle cx="96" cy="42" r="3" fill="#4aa8ff" stroke="#1a4f8a" strokeWidth="0.7" />
    <path d="M58 18Q58 22 60 22Q62 22 62 18Q62 14 60 13Q58 14 58 18Z" fill="#fffbe0" />
    {/* the box: planks, iron-gold bands, the lock */}
    <rect x="10" y="46" width="100" height="46" rx="3" fill="url(#season-pirate-day-wood)" stroke="#24130a" strokeWidth="1" />
    <path d="M10 62H110M10 77H110" stroke="#24130a" strokeOpacity="0.55" strokeWidth="1" />
    <g fill="#d9a53a" stroke="#8a6214" strokeWidth="0.7">
      <rect x="22" y="46" width="7" height="46" />
      <rect x="91" y="46" width="7" height="46" />
      <rect x="10" y="45" width="100" height="5" rx="1.5" />
      <rect x="53" y="50" width="14" height="17" rx="2" />
    </g>
    <path d="M60 55.5A2.2 2.2 0 1 0 60 59.9L59 63H61L60 59.9A2.2 2.2 0 1 0 60 55.5Z" fill="#24130a" />
  </svg>
);

/** The sea along the foot of the wall: two rows of waves, the front one darker, foam on their crests */
const Waves = () => (
  <svg className="absolute inset-x-0 bottom-0 w-full h-[30px] sm:h-[42px]" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="season-pirate-day-waves-back" width="160" height="42" patternUnits="userSpaceOnUse" x="50%">
        <path d="M0 12Q40 2 80 12T160 12V42H0Z" fill="#11495a" fillOpacity="0.8" />
        <path d="M0 12Q40 2 80 12T160 12" fill="none" stroke="#86e6da" strokeOpacity="0.4" strokeWidth="1.4" />
      </pattern>
      <pattern id="season-pirate-day-waves-front" width="120" height="42" patternUnits="userSpaceOnUse" x="50%" patternTransform="translate(60 0)">
        <path d="M0 24Q30 14 60 24T120 24V42H0Z" fill="#0a2f3c" />
        <path d="M0 24Q30 14 60 24T120 24" fill="none" stroke="#b4f2ea" strokeOpacity="0.5" strokeWidth="1.4" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#season-pirate-day-waves-back)" />
    <rect width="100%" height="100%" fill="url(#season-pirate-day-waves-front)" />
  </svg>
);

const PirateDayDecor = () => (
  <>
    <Flag className="left-2 top-[36px] w-[52px] sm:left-6 sm:top-[60px] sm:w-[80px] lg:left-[calc(50%-640px)] lg:top-[64px] lg:w-[130px] -rotate-[4deg]" />
    <TreasureMap className="hidden md:block left-[calc(50%-390px)] top-[240px] w-[100px] lg:left-[calc(50%-650px)] lg:top-[260px] lg:w-[150px] rotate-[6deg]" />
    <Moon className="right-3 top-[40px] w-[40px] sm:right-8 sm:top-[60px] sm:w-[64px] lg:right-auto lg:left-[calc(50%+440px)] lg:top-[64px] lg:w-[96px]" />
    <Chest className="left-2 bottom-[10px] w-[54px] sm:w-[74px] md:left-[calc(50%-340px)] md:bottom-[14px] lg:left-[calc(50%-450px)] lg:w-[116px]" />
    <Ship className="right-1 bottom-[6px] w-[92px] sm:w-[130px] md:right-auto md:left-[calc(50%+230px)] md:bottom-[10px] lg:left-[calc(50%+290px)] lg:w-[220px]" />
    <Waves />
  </>
);

export default PirateDayDecor;
