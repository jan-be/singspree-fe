import "./easter.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Easter Sunday and Easter Monday, moving with Easter, over at five in the
// morning after: spring, sunshine and bunnies, the Easter songs first.
export const easter: Season = {
  id: "easter",
  from: "easter",
  until: "easter+2T05:00",
  songs: [
    "6lyS8Vqn0yo", // The Beatles – Here Comes The Sun
    "7DEHtsMwOZ4", // Sister Act 2 – Oh Happy Day
    "47pQyzSQTnP", // Art Garfunkel – Bright Eyes
    "3ou1tCSEC1o", // Katrina And The Waves – Walking On Sunshine
    "3vkxdYyzVVI", // Jesus Christ Superstar – Jesus Christ Superstar
    "3ZF8tnsAfaX", // Electric Light Orchestra – Mr. Blue Sky
    "5FsdIhnE4Ht", // Cat Stevens – Morning Has Broken
    "1gLOm3CmRYC", // Rolf Zuckowski und seine Freunde – Stups, der kleine Osterhase
    "4r0fSLwo8UD", // Michael Bublé – Feeling Good
    "7tJKQ9lGSnH", // Leonard Cohen – Hallelujah
    "4CvlzChgkk5", // Bill Withers – Lovely Day
    "5wFt7PBx8DA", // Pharrell Williams – Happy
    "cE5eD6B6rro", // Louis Armstrong – What A Wonderful World
    "7sxzXPUQC8L", // Sister Act – I Will Follow Him
    "A3K6q6B0XDx", // Bob Marley & The Wailers – Three Little Birds
    "mB37gh1CG71", // Florence + the Machine – Rabbit Heart (Raise It Up)
    "1NJDqvl1mPq", // Israel Kamakawiwo'ole – Somewhere Over The Rainbow
    "42E0npf8q82", // Jimmy Cliff – I Can See Clearly Now
    "TLsApk4UjKy", // Miley Cyrus – Flowers
    "7AV25LXuD7U", // Rolf Zuckowski und seine Freunde – Alle Vögel sind schon da
    "6GKkYj7hFTs", // Boney M. – Sunny
    "1nf1F7F8cPc", // The Beatles – Good Day Sunshine
    "nkDV5jM5C1l", // Justin Timberlake – Can't Stop The Feeling!
    "7xtvt2dm4Qi", // R.E.M. – Shiny Happy People
  ],
  Decor: lazy(() => import("./easterDecor")),
};
