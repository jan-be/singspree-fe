import "./halloween.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// The week up to Halloween, the night itself and one more day after it
// (a karaoke night goes on past midnight): over at five in the morning of 2 November.
export const halloween: Season = {
  id: "halloween",
  from: "10-24",
  until: "11-02T05:00",
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
  Decor: lazy(() => import("./halloweenDecor")),
};
