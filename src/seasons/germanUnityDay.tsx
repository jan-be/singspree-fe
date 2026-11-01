import "./germanUnityDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// Tag der Deutschen Einheit, 3 October (the day of reunification, 1990), for
// visitors in Germany: the day and the night after it, over at five in the
// morning of 4 October. Songs of the Wende and the Wall coming down, East
// and West, then the ones the whole country sings together.
export const germanUnityDay: Season = {
  id: "german-unity-day",
  from: "10-03",
  until: "10-04T05:00",
  countries: ["DE"],
  songs: [
    "6oGKLSXX9US", // Scorpions – Wind Of Change
    "4nAdGGj3lMI", // Nena – 99 Luftballons
    "4ueXBfQDFfL", // David Hasselhoff – Looking For Freedom
    "5F0ob7UXzdU", // Westernhagen – Freiheit (Live)
    "1YfTLrxQMUb", // Peter Maffay – Über sieben Brücken mußt Du gehn
    "5ZNVITRSrgx", // Udo Lindenberg – Sonderzug nach Pankow
    "3vVVs5zqJ9y", // Die Fantastischen Vier feat. Clueso – Zusammen
    "N7MbJk1fsys", // Die Prinzen – Deutschland
    "50NLihg7QF3", // Andreas Bourani – Auf uns
    "1lSUDjtjUMD", // Die Toten Hosen – Tage wie diese
    "441GUujvIAK", // David Bowie – Heroes
    "1ueTQ6iaxIE", // City – Am Fenster
    "2vUd37v3Fdi", // Paul van Dyk & Peter Heppner – Wir sind wir
    "28RDz2bPetx", // Nina Hagen & Automobil – Du hast den Farbfilm vergessen
    "5e90GUaXFoO", // Ute Freudenberg – Jugendliebe
    "5og987yGkTc", // Peter Schilling – Major Tom (völlig losgelöst)
    "5pmDDAuNBKz", // Helene Fischer – Atemlos durch die Nacht
    "2HP3Wx2v7HO", // Sportfreunde Stiller – Ein Kompliment
    "3YqDENZyrcx", // Peter Fox – Haus am See
    "7jKq0o5NPeY", // Herbert Grönemeyer – Männer
    "7JNp9CITkCQ", // Keimzeit – Kling Klang
    "3ihgZKeD4Q7", // Reinhard Mey – Über den Wolken
    "1bLBLKJ0lH9", // Peter Fox – Alles neu
    "3VFw9c2aOe6", // Nena – Irgendwie, irgendwo, irgendwann
  ],
  Decor: lazy(() => import("./germanUnityDayDecor")),
};
