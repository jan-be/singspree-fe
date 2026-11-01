// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: red and white
// pennants with maple leaves along the top, fireworks, maple leaves drifting
// by, pines on a lake shore with the sun going down, and a red canoe on the
// water. Static SVG like the wall itself (no blur, no filters); only the
// little glints twinkle, in canadaDay.css.

const RED = "#e8202e";
const WHITE = "#fbf4f2";

/** The flag's maple leaf: 3720 across and 4030 high around (4800, 2415) */
const LEAF = "M4890 4430l-45-863a95 95 0 0 1 111-98l859 151-116-320a65 65 0 0 1 20-73l941-762-212-99a65 65 0 0 1-34-79l186-572-542 115a65 65 0 0 1-73-38l-105-247-423 454a65 65 0 0 1-111-57l204-1052-327 189a65 65 0 0 1-91-27l-332-652-332 652a65 65 0 0 1-91 27l-327-189 204 1052a65 65 0 0 1-111 57l-423-454-105 247a65 65 0 0 1-73 38l-542-115 186 572a65 65 0 0 1-34 79l-212 99 941 762a65 65 0 0 1 20 73l-116 320 859-151a95 95 0 0 1 111 98l-45 863z";

/** The leaf `width` across, its middle at (x, y) */
const leafAt = (x: number, y: number, width: number, angle = 0) =>
  `translate(${x} ${y}) rotate(${angle}) scale(${(width / 3720).toFixed(5)}) translate(-4800 -2415)`;

/** A maple leaf drifting down the wall, turned by `angle` */
const MapleLeaf = ({ className, angle = 0, light }: { className: string; angle?: number; light?: boolean }) => (
  <svg viewBox="-60 -60 120 120" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`season-canada-day-leaf${light ? "-light" : ""}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={light ? "#ff7a7a" : "#ff4b55"} />
        <stop offset="1" stopColor={light ? "#d8323c" : "#b3101e"} />
      </linearGradient>
    </defs>
    <path d={LEAF} transform={leafAt(0, 0, 104, angle)} fill={`url(#season-canada-day-leaf${light ? "-light" : ""})`} stroke="#6e0a14" strokeWidth="60" />
  </svg>
);

/** One swag of the bunting, 240 wide: the string sags 20 in the middle, a pennant every 30, a leaf on the white ones */
const SWAG_FLAGS = Array.from({ length: 8 }, (_, i) => {
  const x = 15 + i * 30;
  const t = x / 240;
  const y = 3 + 40 * t * (1 - t);
  return { x, y, d: `M${x - 10} ${y.toFixed(1)}H${x + 10}L${x} ${(y + 24).toFixed(1)}Z`, white: i % 2 === 1 };
});

const Bunting = ({ id, scale, className }: { id: string; scale: number; className: string }) => (
  <svg className={`absolute left-0 top-0 w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={id} width="240" height="56" patternUnits="userSpaceOnUse" x="50%" patternTransform={`scale(${scale})`}>
        <path d="M0 3Q120 43 240 3" fill="none" stroke="#e8d9d6" strokeOpacity="0.55" strokeWidth="1.4" />
        {SWAG_FLAGS.map(f => (
          <g key={f.x}>
            <path d={f.d} fill={f.white ? WHITE : RED} fillOpacity="0.92" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
            {f.white && <path d={LEAF} transform={leafAt(f.x, f.y + 8, 9)} fill={RED} />}
          </g>
        ))}
        <circle cx="0" cy="3" r="2.6" fill={WHITE} />
        <circle cx="240" cy="3" r="2.6" fill={WHITE} />
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
const BURST_BIG = burst(20, 4);
const BURST_SMALL = burst(12, 15);

const TONES = {
  red: { ray: "#ff3b48", tip: "#ffc6ca" },
  white: { ray: "#ffe6e8", tip: "#ffffff" },
};

const Burst = ({ tone, small, className }: { tone: keyof typeof TONES; small?: boolean; className: string }) => {
  const { ray, tip } = TONES[tone];
  const shape = small ? BURST_SMALL : BURST_BIG;
  return (
    <svg viewBox="-100 -100 200 200" className={`absolute ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`season-canada-day-glow-${tone}`}>
          <stop offset="0" stopColor={ray} stopOpacity="0.28" />
          <stop offset="1" stopColor={ray} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="74" fill={`url(#season-canada-day-glow-${tone})`} />
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

/** A four-pointed glint; canadaDay.css makes it twinkle, each at its own `delay` */
const Glint = ({ className, delay = 0, color = WHITE }: { className: string; delay?: number; color?: string }) => (
  <svg viewBox="-12 -12 24 24" className={`absolute season-canada-day-twinkle ${className}`} style={{ animationDelay: `${delay}s` }} aria-hidden="true" focusable="false">
    <path d="M0 -12Q1.3 -1.3 12 0Q1.3 1.3 0 12Q-1.3 1.3 -12 0Q-1.3 -1.3 0 -12Z" fill={color} />
  </svg>
);

/** A pine `h` high standing at (x, base): five tiers narrowing to the top */
const pine = (x: number, base: number, h: number) => Array.from({ length: 5 }, (_, k) => {
  const top = base - h + (k * h) / 6.2;
  const bottom = base - h * 0.08 - ((4 - k) * h) / 7.5;
  const half = (h * (0.13 + k * 0.065));
  return `M${x} ${top.toFixed(1)}L${(x + half).toFixed(1)} ${bottom.toFixed(1)}H${(x - half).toFixed(1)}Z`;
}).join("");

/** Pines on a rocky shore, the sun going down behind them, its light on the lake */
const Shore = ({ className }: { className: string }) => (
  <svg viewBox="0 0 150 96" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-canada-day-sun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd27a" />
        <stop offset="1" stopColor="#ff5a4a" />
      </linearGradient>
      <linearGradient id="season-canada-day-pine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2f6b52" />
        <stop offset="1" stopColor="#0f2f24" />
      </linearGradient>
    </defs>
    <path d="M78 72A30 30 0 0 1 138 72Z" fill="url(#season-canada-day-sun)" fillOpacity="0.85" />
    <g stroke="#ffb07a" strokeOpacity="0.55" strokeLinecap="round" strokeWidth="2">
      <path d="M90 78H126" />
      <path d="M96 84H120" />
      <path d="M102 90H114" />
    </g>
    <path d="M2 78H148" stroke="#ffd6d0" strokeOpacity="0.35" strokeWidth="1.2" />
    <path d="M0 80Q10 66 26 68Q36 62 48 68Q60 66 72 74L76 80Z" fill="#3a2a2c" />
    <path d="M18 70Q30 64 44 69" fill="none" stroke="#6a5458" strokeWidth="1.4" strokeLinecap="round" />
    <g fill="url(#season-canada-day-pine)" stroke="#0a1f18" strokeWidth="0.8">
      <path d={pine(22, 72, 46)} />
      <path d={pine(56, 72, 40)} />
      <path d={pine(38, 70, 64)} />
    </g>
    <path d="M38 66V72M22 69V73M56 69V73" stroke="#3b2516" strokeWidth="3" />
  </svg>
);

/** A red canoe on the water, its paddle resting in it */
const Canoe = ({ className }: { className: string }) => (
  <svg viewBox="0 0 120 60" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="season-canada-day-hull" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff4b55" />
        <stop offset="1" stopColor="#a10f1c" />
      </linearGradient>
    </defs>
    <path d="M70 34L90 2" stroke="#c9945a" strokeWidth="3" strokeLinecap="round" />
    <path d="M86 4L94 -1" stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" />
    <path d="M10 26Q60 32 110 26L108 30Q60 36 12 30Z" fill="#5a0c14" />
    <path d="M4 18Q10 26 14 28Q60 34 106 28Q110 26 116 18Q114 30 104 38Q60 46 16 38Q6 30 4 18Z" fill="url(#season-canada-day-hull)" stroke="#6e0a14" strokeWidth="1" />
    <path d="M16 31Q60 37 104 31" fill="none" stroke="#ffe3e5" strokeOpacity="0.55" strokeWidth="1.4" />
    <g fill="none" stroke="#ffd6d0" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 46Q16 42 26 46T46 46" />
      <path d="M58 50Q68 46 78 50T98 50" />
      <path d="M86 44Q96 40 106 44T118 44" />
    </g>
  </svg>
);

const CanadaDayDecor = () => (
  <>
    <Bunting id="season-canada-day-bunting" scale={1} className="hidden sm:block h-[56px]" />
    <Bunting id="season-canada-day-bunting-small" scale={0.6} className="sm:hidden h-[34px]" />
    <Burst tone="red" className="left-1 top-[30px] w-[72px] sm:left-4 sm:top-[56px] sm:w-[104px] lg:left-[calc(50%-600px)] lg:top-[70px] lg:w-[170px]" />
    <Burst tone="white" small className="hidden md:block left-[calc(50%-390px)] top-[54px] w-[80px] lg:w-[96px]" />
    <Burst tone="white" className="right-1 top-[40px] w-[62px] sm:right-4 sm:top-[60px] sm:w-[96px] lg:right-auto lg:left-[calc(50%+410px)] lg:top-[66px] lg:w-[150px]" />
    <Burst tone="red" small className="hidden lg:block left-[calc(50%+590px)] top-[220px] w-[80px]" />
    <MapleLeaf className="hidden sm:block left-[calc(50%-330px)] top-[100px] w-[30px] lg:w-[36px]" angle={-18} />
    <MapleLeaf className="hidden md:block left-[calc(50%-520px)] top-[240px] w-[40px]" angle={24} light />
    <MapleLeaf className="hidden lg:block left-[calc(50%-650px)] top-[320px] w-[26px]" angle={-40} />
    <MapleLeaf className="hidden sm:block left-[calc(50%+320px)] top-[210px] w-[26px] lg:w-[32px]" angle={30} light />
    <MapleLeaf className="hidden lg:block left-[calc(50%+500px)] top-[290px] w-[44px]" angle={-10} />
    <MapleLeaf className="hidden xl:block left-[calc(50%+300px)] top-[60px] w-[22px]" angle={50} light />
    <Glint className="left-[22%] top-[92px] w-[11px] sm:left-[calc(50%-260px)] sm:top-[60px] sm:w-[14px]" delay={0} />
    <Glint className="right-[24%] top-[78px] w-[10px] sm:right-auto sm:left-[calc(50%+270px)] sm:top-[120px] sm:w-[14px]" delay={1.4} color="#ffc6ca" />
    <Glint className="hidden md:block left-[calc(50%-460px)] top-[180px] w-[16px]" delay={2.2} />
    <Glint className="hidden lg:block left-[calc(50%+560px)] top-[150px] w-[14px]" delay={0.8} color="#ffc6ca" />
    <Shore className="left-1 bottom-0 w-[64px] sm:w-[96px] md:left-[calc(50%-350px)] lg:left-[calc(50%-470px)] lg:w-[160px]" />
    <Canoe className="right-2 bottom-2 w-[58px] sm:w-[76px] md:right-auto md:left-[calc(50%+250px)] md:bottom-3 lg:left-[calc(50%+300px)] lg:w-[112px]" />
  </>
);

export default CanadaDayDecor;
