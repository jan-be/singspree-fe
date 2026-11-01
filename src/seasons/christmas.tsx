import "./christmas.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Christmas (christmas.css): Christmas Eve, Christmas Day and Boxing Day,
// over at five in the morning of 27 December (the rest of December: winter.tsx).
export const christmas: Season = {
  id: "christmas",
  from: "12-24",
  until: "12-27T05:00",
  songs: [
    "5b3P51iRyYl", // Mariah Carey – All I Want For Christmas Is You
    "2i1tM0PordJ", // Wham! – Last Christmas
    "38z49tZ7B0O", // Bobby Helms – Jingle Bell Rock
    "HfnGc8YnYt9", // Brenda Lee – Rockin' Around The Christmas Tree
    "3vM2qVTC8h8", // José Feliciano – Feliz Navidad
    "2LJZHsjluyS", // The Pogues feat. Kirsty MacColl – Fairytale Of New York
    "4ubiC1gCgHJ", // Chris Rea – Driving Home For Christmas
    "6fIBrMbH70p", // Ariana Grande – Santa Tell Me
    "752kyENGjpq", // Justin Bieber – Mistletoe
    "1zOcplFJ2dK", // Kelly Clarkson – Underneath The Tree
    "Kf4u2IeG93L", // Paul McCartney – Wonderful Christmastime
    "1SoltURKyKw", // Pentatonix – Mary, Did You Know?
    "rTJXHyKv4l6", // Slade – Merry Xmas Everybody
    "2x4HiIOXuv2", // Shakin' Stevens – Merry Christmas Everyone
    "qe7Hc3gzFzB", // Ed Sheeran & Elton John – Merry Christmas
    "10cJ4ZVGDUb", // Elton John – Step Into Christmas
    "3ic1tDrHzZ3", // John & Yoko / The Plastic Ono Band – Happy Xmas (War Is Over)
    "5GsT7zLfMyo", // Band Aid – Do They Know It's Christmas?
    "6GuQ345NxyG", // Coldplay – Christmas Lights
    "yOjztZejr6n", // Pentatonix – Little Drummer Boy
    "3CXm4yhh3fa", // Michael Bublé – Silent Night
    "6T5GfCEkdaN", // Rolf Zuckowski und seine Freunde – In der Weihnachtsbäckerei
    "7969eFUP8Db", // Bing Crosby – White Christmas
    "1cSPiCAZsmb", // Boney M. – Mary's Boy Child
  ],
  Decor: lazy(() => import("./christmasDecor")),
};
