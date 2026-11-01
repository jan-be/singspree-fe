import "./pirateDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// International Talk Like a Pirate Day, 19 September, and the night after it:
// over at five in the morning of 20 September. Shanties, pirates and the sea.
export const pirateDay: Season = {
  id: "pirate-day",
  from: "09-19",
  until: "09-20T05:00",
  songs: [
    "1iKNWYqIa5A", // Nathan Evans – Wellerman
    "3WZyfsnnSCE", // Pirates of the Caribbean: At World's End – Hoist The Colours
    "01KxAHiM6Ua", // Blaggards – Drunken Sailor
    "6QkHczH0T03", // Santiano feat. Nathan Evans – Santiano
    "sT8f43wCqoL", // Alestorm – Drink
    "7HhdRlw9dKf", // Kasalla – Pirate
    "7gj1yWDXCX3", // One Piece – Binks no sake
    "4TBclzQfVia", // Disney's The Little Mermaid – Under The Sea
    "1HRUFbYnNsZ", // Disney's Moana (Dwayne Johnson) – You're Welcome
    "5Cc8VYIkRKa", // Sea Shanty – Leave Her Johnny
    "4ZFVrnsRhrZ", // Alestorm – Keelhauled
    "TA4v4XcMY2T", // Santiano – Gott muss ein Seemann sein
    "5TzPfBoRRRu", // The Beatles – Yellow Submarine
    "5Tbyytrry5Y", // The Beach Boys – Sloop John B
    "3Ym0bmf4eZg", // Bruno Mars – Treasure
    "7hIXbsqrtES", // Captain Jack – Captain Jack
    "75Q3qAfa8Wa", // Rammstein – Seemann
    "5fNOr3XwhUF", // Mugiwara kaizoku-dan – We are! (One Piece)
    "5LfXwH4vgQs", // Disney's Moana (Auli'i Cravalho) – How Far I'll Go
    "1655jncKBC9", // Bob Sinclar feat. Pitbull, Dragonfly & Fatman Scoop – Rock The Boat
    "17tmTxkj2lR", // Awolnation – Sail
    "28ZiSUVwLI7", // Rod Stewart – Sailing
    "6k2n21Ox0AI", // Enya – Orinoco Flow (Sail Away)
    "17CpTSztJal", // Muppet Treasure Island – Cabin Fever
  ],
  Decor: lazy(() => import("./pirateDayDecor")),
};
