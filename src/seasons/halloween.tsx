import "./halloween.css";
import type { Season } from "./seasons";

// ── Decorations ────────────────────────────────────────────────────────
// Hung on the entry page's hero wall, behind the sign: a full moon, bats,
// cobwebs in the corners, two jack-o'-lanterns and a little fog. Static
// SVG like the wall itself (no blur, no animation); the sign's flicker is
// in halloween.css.

/** A bat, 100 × 32 around its middle */
const BAT = "M0 -9L3 -15L4.5 -7Q24 -18 50 -12Q41 -7 38 4Q31 -2 25 6Q18 0 12 8Q7 3 4 10Q2 14 0 16Q-2 14 -4 10Q-7 3 -12 8Q-18 0 -25 6Q-31 -2 -38 4Q-41 -7 -50 -12Q-24 -18 -4.5 -7L-3 -15Z";

const Bat = ({ className }: { className: string }) => (
  <svg viewBox="-52 -17 104 35" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={BAT} fill="#0a0612" stroke="#4a2d6e" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

/** A web in the top-left corner: threads fanning out, sagging rings between them */
const WEB = (() => {
  const angles = [0, 16, 33, 50, 67, 83, 90].map(a => (a * Math.PI) / 180);
  const radii = [26, 52, 82, 116, 150];
  const pt = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)];
  let d = angles.map(a => { const [x, y] = pt(170, a); return `M0 0L${x.toFixed(1)} ${y.toFixed(1)}`; }).join("");
  for (const r of radii) {
    for (let i = 0; i < angles.length - 1; i++) {
      const [x1, y1] = pt(r, angles[i]);
      const [x2, y2] = pt(r, angles[i + 1]);
      const [cx, cy] = pt(r * 0.86, (angles[i] + angles[i + 1]) / 2); // sags towards the corner
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
  }
  return d;
})();

const Web = ({ className }: { className: string }) => (
  <svg viewBox="0 0 170 170" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d={WEB} fill="none" stroke="#e8dcff" strokeOpacity="0.22" strokeWidth="1.1" />
  </svg>
);

/** A spider on its thread, hanging from the top */
const Spider = ({ className }: { className: string }) => (
  <svg viewBox="0 0 40 150" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <path d="M20 0V128" stroke="#e8dcff" strokeOpacity="0.3" strokeWidth="1" />
    <g stroke="#0a0612" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <path d="M17 131L8 124L4 129M17 134L6 134L3 140M17 137L8 143L6 149M23 131L32 124L36 129M23 134L34 134L37 140M23 137L32 143L34 149" />
    </g>
    <ellipse cx="20" cy="135" rx="6" ry="7.5" fill="#0a0612" stroke="#4a2d6e" strokeWidth="1" />
    <circle cx="20" cy="126.5" r="3.6" fill="#0a0612" />
  </svg>
);

const Moon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 200 200" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-moon-glow">
        <stop offset="0.45" stopColor="#ffe9b0" stopOpacity="0.32" />
        <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="season-moon-face" cx="42%" cy="38%" r="70%">
        <stop offset="0" stopColor="#fffbea" />
        <stop offset="0.7" stopColor="#f6e3b0" />
        <stop offset="1" stopColor="#d9bf86" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="100" fill="url(#season-moon-glow)" />
    <circle cx="100" cy="100" r="52" fill="url(#season-moon-face)" />
    <g fill="#c9ab72" fillOpacity="0.45">
      <circle cx="82" cy="86" r="10" />
      <circle cx="116" cy="114" r="13" />
      <circle cx="110" cy="76" r="5" />
      <circle cx="84" cy="122" r="6" />
    </g>
  </svg>
);

const Pumpkin = ({ className }: { className: string }) => (
  <svg viewBox="0 0 100 92" className={`absolute ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="season-pumpkin" cx="45%" cy="40%" r="65%">
        <stop offset="0" stopColor="#ffa040" />
        <stop offset="0.65" stopColor="#f0700f" />
        <stop offset="1" stopColor="#a8400a" />
      </radialGradient>
      <radialGradient id="season-pumpkin-glow">
        <stop offset="0.3" stopColor="#ff9a2e" stopOpacity="0.4" />
        <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="56" rx="50" ry="36" fill="url(#season-pumpkin-glow)" />
    <path d="M48 24C47 16 49 10 55 6L58 9C54 12 53 17 54 24Z" fill="#3f5a1c" />
    <g fill="url(#season-pumpkin)" stroke="#8a3306" strokeWidth="1.2">
      <ellipse cx="32" cy="56" rx="24" ry="29" />
      <ellipse cx="68" cy="56" rx="24" ry="29" />
      <ellipse cx="50" cy="56" rx="22" ry="31" />
    </g>
    <g fill="#ffd96a">
      <path d="M33 47L42 47L37.5 38Z" />
      <path d="M58 47L67 47L62.5 38Z" />
      <path d="M28 61Q50 76 72 61L67 63L63 59L58 65L50 60L42 65L37 59L33 63Z" />
    </g>
  </svg>
);

const HalloweenDecor = () => (
  <>
    <Web className="left-0 top-0 w-[92px] sm:w-[150px]" />
    <Web className="hidden lg:block right-0 top-0 w-[150px] -scale-x-100" />
    <Spider className="hidden lg:block right-[118px] top-0 w-[22px]" />
    <Moon className="right-1 top-0 w-[92px] sm:w-[120px] lg:right-auto lg:left-[calc(50%+250px)] lg:-top-2 lg:w-[180px]" />
    <Bat className="right-[84px] top-[44px] w-[30px] sm:right-[112px] sm:w-[38px] lg:right-auto lg:left-[calc(50%+228px)] lg:top-[126px] lg:w-[50px] rotate-[-12deg]" />
    <Bat className="hidden lg:block left-[calc(50%+400px)] top-[34px] w-[30px] rotate-[10deg]" />
    <Bat className="left-[34%] top-[14px] w-[24px] sm:left-[calc(50%-300px)] sm:top-[56px] sm:w-[40px] lg:left-[calc(50%-380px)] rotate-[8deg]" />
    <Bat className="hidden md:block left-[calc(50%-450px)] top-[150px] w-[28px] rotate-[-6deg]" />
    <Pumpkin className="left-2 bottom-2 w-[52px] sm:w-[70px] md:left-[calc(50%-320px)] md:bottom-3 lg:left-[calc(50%-400px)] lg:w-[84px]" />
    <Pumpkin className="right-2 bottom-2 w-[44px] sm:w-[60px] md:right-auto md:left-[calc(50%+250px)] md:bottom-3 lg:left-[calc(50%+320px)] lg:w-[72px]" />
    {/* fog creeping along the foot of the wall */}
    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#c9b8f0]/[0.1] to-transparent" />
  </>
);

// ── The season ─────────────────────────────────────────────────────────
// The week up to Halloween and the night itself, which at a karaoke party
// goes on past midnight: over at five in the morning of 1 November.
export const halloween: Season = {
  id: "halloween",
  from: "10-24",
  until: "11-01T05:00",
  songs: [
    "19UZRP4ilOO", // Michael Jackson – Thriller
    "4XmQZkeujyX", // Ray Parker Jr. – Ghostbusters
    "3ZXzVCTWRyD", // Bobby "Boris" Pickett – Monster Mash
    "2UYuYqf4Bco", // The Nightmare Before Christmas – This Is Halloween
    "632z7cfdrsS", // Rockwell – Somebody's Watching Me
    "7dFPoPLz65B", // Rihanna – Disturbia
    "SI5lsRkysVO", // Lady Gaga – Bloody Mary
    "Mkb5EKvzDHQ", // Andrew Gold – Spooky Scary Skeletons
    "2rFSIRj7Rv0", // The Rocky Horror Picture Show – Time Warp
    "5zxqlfkXdjg", // Bette Midler – I Put A Spell On You
    "1S0hH13KAZq", // Backstreet Boys – Everybody (Backstreet's Back)
    "12wIELuxPo4", // The Cranberries – Zombie
    "45sklXdU4FG", // Billie Eilish – Bury A Friend
    "7mi1KJ0Wjl1", // Little Mix – Black Magic
    "1ioGy1EGCWO", // Warren Zevon – Werewolves Of London
    "7MHkfoMcZSm", // Olivia Rodrigo – Vampire
    "6hYqQTI3eMF", // Lady Gaga – Abracadabra
    "8lbty1MgwyZ", // AC/DC – Highway To Hell
    "4PXxRt6RyMk", // Skillet – Monster
    "7frisqTKLLw", // Creedence Clearwater Revival – Bad Moon Rising
    "3xPRZRNkJ86", // Rob Zombie – Dragula
    "5Gwo3LxV0wg", // Yeah Yeah Yeahs – Heads Will Roll
    "7iAdTqGEMim", // Sophie Ellis-Bextor – Murder On The Dancefloor
    "235kPXxfmR8", // Blue Öyster Cult – (Don't Fear) The Reaper
  ],
  Decor: HalloweenDecor,
};
