import "./newYear.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// New Year's Eve: the day and the night into the new year, over at five in
// the morning of 1 January.
export const newYear: Season = {
  id: "new-year",
  from: "12-31",
  until: "01-01T05:00",
  songs: [
    "6fqv3GxJvO1", // ABBA – Happy New Year
    "7mJrvVxblG3", // Europe – The Final Countdown
    "PXv59M3C4uW", // Kool & The Gang – Celebration
    "4CLd8Y0ohUf", // Katy Perry – Firework
    "43rY2Dt8KdE", // The Black Eyed Peas – I Gotta Feeling
    "4RyE51aeF8T", // Prince and the Revolution – 1999
    "1n3sYQuTuMQ", // U2 – New Year's Day
    "2uecCzSircC", // P!nk – Raise Your Glass
    "MPX2J5MDGOh", // Pitbull & Ne-Yo – Time Of Our Lives
    "6D2GJcicYZq", // Queen – Don't Stop Me Now
    "7pkadGpbTUo", // ABBA – Dancing Queen
    "3Hpdqu6UrzH", // Rihanna – Cheers (Drink To That)
    "3L9Dl2Bfx3q", // Taylor Swift – New Year's Day
    "3NQQ160vtVy", // LMFAO – Party Rock Anthem
    "oVqNkeeCBHx", // Mark Ronson feat. Bruno Mars – Uptown Funk!
    "2tYircZypzE", // Whitney Houston – I Wanna Dance With Somebody
    "2vmrmQh9Isk", // Flo Rida – Good Feeling
    "5ATDnlYAXX7", // Beyoncé – Countdown
    "3w4UxzgQYSM", // Fun. feat. Janelle Monáe – We Are Young
    "1lSUDjtjUMD", // Die Toten Hosen – Tage wie diese
    "5pmDDAuNBKz", // Helene Fischer – Atemlos durch die Nacht
    "rqA1fPCe5EA", // Lionel Richie – All Night Long (All Night)
    "1wk3n3ZE6tM", // Die Roten Rosen – Auld Lang Syne
    "6YFELigdkSK", // Semisonic – Closing Time
  ],
  Decor: lazy(() => import("./newYearDecor")),
};
