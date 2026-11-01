import "./stPatricks.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// 17 March and the night after it (a pub night goes on past midnight): over
// at five in the morning of 18 March.
export const stPatricks: Season = {
  id: "st-patricks",
  from: "03-17",
  until: "03-18T05:00",
  songs: [
    "2jvKczA7aZh", // Ed Sheeran – Galway Girl
    "5PUjjlGapcn", // Dexys Midnight Runners – Come On Eileen
    "2AxgjbgzsB8", // Dropkick Murphys – I'm Shipping Up To Boston
    "32bJrTjmWk3", // Thin Lizzy – Whisky In The Jar
    "1RUpJsRCCkj", // The Pogues – Dirty Old Town
    "6hvT5cE3sMr", // The Dubliners – The Wild Rover
    "1Cue7FMsO7E", // The Cranberries – Linger
    "4P4WQ0d3RcU", // Van Morrison – Brown Eyed Girl
    "4hOnFDURRv2", // Thin Lizzy – The Boys Are Back In Town
    "7DmOKbyethJ", // U2 – Beautiful Day
    "79vQycZzwL9", // Hozier – Take Me To Church
    "18vRkh2RHRS", // The Cranberries – Dreams
    "6u2KjK9Btsn", // The Corrs – Breathless
    "7z52rsm2inu", // Westlife – Flying Without Wings
    "3BTNZ1vDiTF", // Snow Patrol – Chasing Cars
    "10ygLYVrbP7", // The Script feat. will.i.am – Hall Of Fame
    "fJpVknwBs9f", // Flogging Molly – Drunken Lullabies
    "2Cfwiy4iAsP", // The High Kings – The Rocky Road To Dublin
    "7jY46j0UcXy", // U2 – I Still Haven't Found What I'm Looking For
    "2UqEXqJf8VT", // Sinéad O'Connor – Nothing Compares 2 U
    "6a8o1lQssdF", // Boyzone – No Matter What
    "6Dc6OvxcuYT", // Kodaline – All I Want
    "2lYXXgVvVV2", // Niall Horan – This Town
    "1kzkFG9EMa4", // Westlife – Uptown Girl
  ],
  Decor: lazy(() => import("./stPatricksDecor")),
};
