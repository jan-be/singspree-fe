import "./winter.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Winter (winter.css): December, in the northern half of the world; Christmas
// and New Year's Eve show over it on their days. Songs of snow, ice and
// cold, the winter standards and Frozen first; the Christmas songs are
// Christmas's (christmas.tsx).
export const winter: Season = {
  id: "winter",
  from: "12-01",
  until: "12-31",
  hemisphere: "north",
  songs: [
    "4hKhUqBzLEi", // Disney's Frozen (Idina Menzel) – Let It Go
    "4SSYFQKRK2i", // Michael Bublé – Let It Snow!
    "3cYU9lebdGS", // Sia – Snowman
    "2rZwCrWNhAc", // Idina Menzel with Michael Bublé – Baby, It's Cold Outside
    "3K2aLFzjwGS", // Disney's Frozen – Do You Want To Build A Snowman?
    "2jpF8OaYwGA", // The Ronettes – Sleigh Ride
    "5nFSZaxS6PU", // Vanilla Ice – Ice Ice Baby
    "1HaK4o6C7ty", // Elton John & Dua Lipa – Cold Heart (PNAU Remix)
    "2GeqQPRkVSI", // Bangles – Hazy Shade Of Winter
    "4cQaXWEO2Tt", // Red Hot Chili Peppers – Snow ((Hey Oh))
    "78eyRScGQul", // Disney's Frozen II – Into The Unknown
    "79Qd0TgZUj0", // Madonna – Frozen
    "4hBHMJRvc1c", // Foreigner – Cold As Ice
    "7na3jEy3XoB", // The Mamas & The Papas – California Dreamin'
    "5HP3Y4jxLbh", // Kids Music – Jingle Bells
    "678tZOqUePw", // EXO – Miracles In December
    "6lyD3lfI5wJ", // Younha feat. RM – Winter Flower
    "5hb5Az5vePj", // Grauzone – Eisbär
    "2WK5rUwuTLY", // Fleet Foxes – White Winter Hymnal
    "3p0T4O7EdXS", // The Snowman – Walking In The Air
    "1w6dBllTJyB", // Within Temptation – Ice Queen
    "6zvF37Hb1L7", // Unheilig – Winter
    "1NNPkqygHbE", // David Essex – A Winter's Tale
    "1aBLhvjWFZI", // Jessica Simpson & Ozzy Osbourne – Winter Wonderland
  ],
  Decor: lazy(() => import("./winterDecor")),
};
