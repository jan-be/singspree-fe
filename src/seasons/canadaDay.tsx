import "./canadaDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Canada Day and the night after it (the fireworks go on late): over at five
// in the morning of 2 July. Only for visitors in Canada.
export const canadaDay: Season = {
  id: "canada-day",
  from: "07-01",
  until: "07-02T05:00",
  countries: ["CA"],
  songs: [
    "5edHNsaZd1a", // Bryan Adams – Summer Of '69
    "7mtkypEb3zo", // Shania Twain – Man! I Feel Like A Woman!
    "Hu8BhbNy1Nh", // Céline Dion – My Heart Will Go On
    "5V7ieOXgmyx", // Carly Rae Jepsen – Call Me Maybe
    "XWIIr9w8ODB", // Avril Lavigne – Complicated
    "4q6KfiE7Nwj", // Alanis Morissette – Ironic
    "2OZRSQh9EuG", // Justin Bieber – Sorry
    "2o7GcC8HSfp", // The Weeknd – Blinding Lights
    "5ZRF1EQgOiV", // Barenaked Ladies – One Week
    "3IAxTUUccy8", // Nickelback – How You Remind Me
    "7tJKQ9lGSnH", // Leonard Cohen – Hallelujah
    "4RAHu7Cr3GI", // Tom Cochrane – Life Is A Highway
    "c5nDTvS1Ale", // Bryan Adams – (Everything I Do) I Do It For You
    "9YacNhliDQb", // Céline Dion – Pour que tu m'aimes encore
    "1VB9E3Jiiwa", // Shawn Mendes – Treat You Better
    "3EZQ8jPalC4", // Drake – Hotline Bling
    "3I5DJWD6APx", // Avril Lavigne – Sk8er Boi
    "5889TuJyH6y", // Garou & Céline Dion – Sous le vent
    "4m1D2sp0QMb", // Michael Bublé – Home
    "3hxovVQOGNo", // Nelly Furtado – Say It Right
    "2OeBdyco3Ck", // K'naan – Wavin' Flag (Coca-Cola Celebration Mix)
    "6r89l5UNAbX", // Shania Twain – You're Still The One
    "2DdyZ70SXsz", // Cœur de Pirate – Comme des enfants
    "1kk12wyiR50", // Simple Plan – Welcome To My Life
  ],
  Decor: lazy(() => import("./canadaDayDecor")),
};
