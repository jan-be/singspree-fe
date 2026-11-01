import "./valentines.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Valentine's Day and the night after it, over at five in the morning of
// 15 February. Love songs to sing to someone, duets first.
export const valentines: Season = {
  id: "valentines",
  from: "02-14",
  until: "02-15T05:00",
  songs: [
    "5f2OrEGflDd", // Bradley Cooper & Lady Gaga – Shallow
    "1CzWLbXqbWZ", // Lady Gaga & Bruno Mars – Die With A Smile
    "3EYrrZvIcyE", // Bill Medley & Jennifer Warnes – (I've Had) The Time Of My Life
    "3BneThNZXCX", // Ed Sheeran – Perfect
    "ynsEF0RST7V", // Kenny Rogers & Dolly Parton – Islands In The Stream
    "ZnPWLhoffYZ", // Whitney Houston – I Will Always Love You
    "1OlL2NgvGHT", // Elton John & Kiki Dee – Don't Go Breaking My Heart
    "1cuagpHxc0z", // John Legend – All Of Me
    "bdwvWABBZVq", // P!nk feat. Nate Ruess – Just Give Me A Reason
    "2b3E9pnDb0H", // Elvis Presley – Can't Help Falling In Love
    "7LSB39orEwl", // Disney's Aladdin – A Whole New World
    "7BFxSXdCSTw", // Bonnie Tyler – Total Eclipse Of The Heart
    "1cShqsuNvzi", // Grease (John Travolta & Olivia Newton-John) – You're The One That I Want
    "3niAjprraHR", // Ed Sheeran – Thinking Out Loud
    "4f1eZDtStI4", // Beyoncé feat. Jay-Z – Crazy In Love
    "1QFCbYzul7Q", // Shawn Mendes & Camila Cabello – Señorita
    "Hu8BhbNy1Nh", // Céline Dion – My Heart Will Go On
    "24Yv2Y3UXal", // Diana Ross & Lionel Richie – Endless Love
    "LbpUGym5IDY", // Taylor Swift – Love Story
    "8Px4sQ0pRlk", // Marvin Gaye & Tammi Terrell – Ain't No Mountain High Enough
    "4PN9mnURfHz", // Robbie Williams & Nicole Kidman – Somethin' Stupid
    "5iKQTAomHJM", // Joe Cocker & Jennifer Warnes – Up Where We Belong
    "1MnMMeuw42U", // Édith Piaf – La vie en rose
    "1EUgYZ4HZwv", // Umberto Tozzi – Ti amo
  ],
  Decor: lazy(() => import("./valentinesDecor")),
};
