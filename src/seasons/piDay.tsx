import "./piDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Pi Day, 3/14, and the night after it: over at five in the morning of
// 15 March. Pies, circles and things going round, and a little science.
export const piDay: Season = {
  id: "pi-day",
  from: "03-14",
  until: "03-15T05:00",
  songs: [
    "41po4fhoj7D", // Don McLean – American Pie
    "7r1iq8kgx7N", // Four Tops – I Can't Help Myself (Sugar Pie Honey Bunch)
    "32N1VcmCpjf", // Dean Martin – That's Amore
    "2UIWAwjI5Vb", // Limahl – The Never Ending Story
    "4tDLLcpCHKK", // Post Malone – Circles
    "3ctCiVn8yLo", // The Lion King – Circle Of Life
    "4o7uFUhhkmA", // Dead Or Alive – You Spin Me Round (Like A Record)
    "2AAxTQqcaq2", // Flo Rida feat. Ke$ha – Right Round
    "6K8MIIggnlC", // Johnny Cash – Ring Of Fire
    "4aVWJTWygY5", // Beyoncé – Single Ladies (Put A Ring On It)
    "2qkewK79Zsc", // Ratt – Round And Round
    "mcfKZSLuBxl", // Daft Punk – Around The World
    "2P1l1t3Zyzk", // Journey – Wheel In The Sky
    "3Ljm6fabgjU", // Creedence Clearwater Revival – Proud Mary
    "2e9WSFxNQ6d", // Queen – Bicycle Race
    "2vjomlDUszt", // Kylie Minogue – Spinning Around
    "3zCnQUgnqeX", // Belinda Carlisle – Circle In The Sand
    "2p41qzE7CzI", // Jaymes Young – Infinity
    "6FZhQMC5kEx", // Coldplay – Clocks
    "3E0BJNxWng6", // Katie Melua – Nine Million Bicycles
    "BeXFZYJz5GY", // Jason Mraz – Geek In The Pink
    "3zjn4eeSnGF", // The Big Bang Theory – Theme Song
    "4rmyUikjRTA", // Muse – Supermassive Black Hole
    "4zfAZTlOMAv", // "Weird Al" Yankovic – White & Nerdy
  ],
  Decor: lazy(() => import("./piDayDecor")),
};
