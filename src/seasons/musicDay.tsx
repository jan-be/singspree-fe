import "./musicDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// World Music Day (the Fête de la Musique), 21 June, when music is played in
// the streets, and the night after it: over at five in the morning of 22 June.
// Songs about music and singing itself.
export const musicDay: Season = {
  id: "music-day",
  from: "06-21",
  until: "06-22T05:00",
  songs: [
    "6flLooTygvu", // Madonna – Music
    "D4REBo3Cyvo", // Rihanna – Don't Stop The Music
    "5Qs4AsMO4En", // ABBA – Thank You For The Music
    "3tTcALFOFjq", // Joan Jett & The Blackhearts – I Love Rock-n-Roll
    "5QRf5MliYPJ", // Jean-Jacques Goldman – Quand la musique est bonne
    "7xTcycm60Xk", // Ed Sheeran – Sing
    "61q4g6rLbkE", // Queen – Radio Ga Ga
    "6Uz02NAj993", // ABBA – Super Trouper
    "7j8Hx7VYN3C", // Billy Joel – Piano Man
    "5edHNsaZd1a", // Bryan Adams – Summer Of '69
    "3KCmOsDVYWP", // Neil Diamond – Sweet Caroline
    "2dad0njqftU", // Fugees – Killing Me Softly (With His Song)
    "2s7WZMcFIyx", // Dire Straits – Sultans Of Swing
    "3Bo1O4eBjCm", // Toto Cutugno – L'Italiano
    "3Nn2fdzdIhy", // Buggles – Video Killed The Radio Star
    "6tA1KBUCP1X", // Robbie Williams – Rock DJ
    "4ELFmBBt8kx", // Florent Pagny – Chanter
    "7DEnrr6z3pK", // Starship – We Built This City
    "2jHGMXbezFa", // Wincent Weiss – Musik sein
    "41po4fhoj7D", // Don McLean – American Pie
    "411pJm0QFCv", // KISS – Rock And Roll All Nite
    "21Vf6VxZaNa", // Calogero – Je joue de la musique
    "11rOYNWr8Wi", // Daniel Balavoine – Le chanteur
    "5yMycLIWMm4", // Carpenters – Yesterday Once More
  ],
  Decor: lazy(() => import("./musicDayDecor")),
};
