import "./bastilleDay.css";
import { lazy } from "react";
import type { Season } from "./seasons";

// ── The season ─────────────────────────────────────────────────────────
// 14 July, France's national day (place.ts: visitors in France only), and
// the night of the bals and fireworks after it: over at five in the morning
// of 15 July. The songs French people sing together, French first.
export const bastilleDay: Season = {
  id: "bastille-day",
  from: "07-14",
  until: "07-15T05:00",
  countries: ["FR"],
  songs: [
    "4gY5SnhZoZm", // Joe Dassin – Les Champs-Élysées
    "1MnMMeuw42U", // Édith Piaf – La vie en rose
    "3YiZ6qJZImR", // Stromae – Alors on danse
    "2F6Ns3m97Kx", // ZAZ – Je veux
    "2Wt7WuqeH34", // Indila – Dernière danse
    "9UXsybCNcqg", // Michel Sardou – Les lacs du Connemara
    "3hpAwWANDAv", // Mylène Farmer – Désenchantée
    "U0ubY4pJrvz", // Alizée – Moi… Lolita
    "rb0C44dFOx3", // Johnny Hallyday – Allumer le feu
    "1qnMDesgIfD", // Claude François – Alexandrie Alexandra
    "9YacNhliDQb", // Céline Dion – Pour que tu m'aimes encore
    "4xH3NcNj4Cv", // Indochine – L'aventurier
    "WWuvAyx6SgV", // Émile & Image – Les démons de minuit
    "2L6ZwdvGt1U", // Vanessa Paradis – Joe le taxi
    "1yRDyFDSmax", // Patrick Bruel – Place des grands hommes
    "47twho5DOGR", // Charles Aznavour – La Bohème
    "43eTW7IG0nM", // Édith Piaf – Non, je ne regrette rien
    "7JH9cyBeIab", // Kendji Girac – Andalouse
    "5LMFndQlUn6", // Joe Dassin – L'été indien
    "yLB62ng5o0R", // Stromae – Papaoutai
    "5lXL8Bqoe3H", // Aya Nakamura – Djadja
    "7Apz4xFg7mj", // Notre-Dame de Paris – Belle
    "4HXb8dOztoS", // Yannick – Ces soirées-là
    "5SKbpuMDjZL", // Desireless – Voyage voyage
  ],
  Decor: lazy(() => import("./bastilleDayDecor")),
};
