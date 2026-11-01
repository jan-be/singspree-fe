import "./independenceDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// The Fourth of July and the night after it (the fireworks go on late):
// over at five in the morning of 5 July. Only for visitors in the US.
export const independenceDay: Season = {
  id: "independence-day",
  from: "07-04",
  until: "07-05T05:00",
  countries: ["US"],
  songs: [
    "IkDXV7Usk26", // Miley Cyrus – Party In The U.S.A.
    "1sKsH1aQG9T", // Bruce Springsteen – Born In The U.S.A.
    "4CLd8Y0ohUf", // Katy Perry – Firework
    "41po4fhoj7D", // Don McLean – American Pie
    "q28pPb0rFWR", // Lynyrd Skynyrd – Sweet Home Alabama
    "7C37MtyrvOP", // John Denver – Take Me Home, Country Roads
    "3KCmOsDVYWP", // Neil Diamond – Sweet Caroline
    "3OhecWkkAbk", // Journey – Don't Stop Believin'
    "1ybCGfiIxJl", // James Brown – Living In America
    "1B3J4ecPk8v", // Tom Petty – Free Fallin'
    "6IfTpBHZIqn", // DJ Jazzy Jeff & The Fresh Prince – Summertime
    "3PLaebNNOW1", // The Beach Boys – Surfin' U.S.A.
    "3KArX5vYjJs", // Bon Jovi – Livin' On A Prayer
    "2igg5S9LsJu", // Darius Rucker – Wagon Wheel
    "6oQxwLw0pvA", // Zac Brown Band – Chicken Fried
    "1dfBgs0jsSE", // Bruce Springsteen – Dancing In The Dark
    "7nnXo3RNUKi", // John Cougar Mellencamp – Jack & Diane
    "2a7wjl4f9Q4", // Katy Perry feat. Snoop Dogg – California Gurls
    "44zvbHzhPmO", // Lil Nas X feat. Billy Ray Cyrus – Old Town Road (Remix)
    "x1g8Hmh7MRp", // Rascal Flatts – Life Is A Highway
    "3Ljm6fabgjU", // Creedence Clearwater Revival – Proud Mary
    "4EOTKDKeZqO", // Taylor Swift – Cruel Summer
    "4MOHBPCEVLT", // Lee Greenwood – God Bless The U.S.A.
    "5p9JO4WNhHX", // Simon & Garfunkel – America
  ],
  Decor: lazy(() => import("./independenceDayDecor")),
};
