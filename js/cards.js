// Extension 1 du TCG Gentle Mates — 122 cartes (+ promos).
// Les données viennent de data/cartes.json (relevé des vraies cartes) via scripts/build-cards.py.
import { CARD_DATA } from "./cards-data.js";

export const SET = { code: "GM1", name: "Gentle Mates TCG", total: 122 };

// Raretés réelles du jeu, de la plus courante à la plus rare (le code est imprimé en bas à droite).
export const RARITIES = {
  ES: { name: "Essence",     symbol: "◇",  color: "#c9c2d6", order: 0 },
  C:  { name: "Commune",     symbol: "●",  color: "#9aa3ad", order: 1 },
  PC: { name: "Peu commune", symbol: "◆",  color: "#3fbf7f", order: 2 },
  R:  { name: "Rare",        symbol: "★",  color: "#3b8cff", order: 3 },
  E:  { name: "Épique",      symbol: "★★", color: "#a55bff", order: 4 },
  L:  { name: "Légendaire",  symbol: "★★★", color: "#f5b82e", order: 5 },
  S:  { name: "Secret",      symbol: "✦",  color: "#7ee8ff", order: 6 },   // rareté officielle ; aucune carte secrète dans notre relevé pour l'instant
  P:  { name: "Promo",       symbol: "P",  color: "#ff4fa3", order: 7 },
};

// Couleurs d'Essence (symbole en haut à droite des cartes).
export const COLORS = {
  Rose: "#ff4fa3", Orange: "#ff8a2a", Jade: "#2fbf8f", Violette: "#8b5cf6", Jaune: "#f5c518",
  Mauve: "#c084fc", Verte: "#6cc24a", Bleue: "#3b82f6", Azur: "#38bdf8", Neutre: "#9aa3ad",
};

export const CARDS = CARD_DATA;
// Rareté imprimée en bas à droite de la carte (P06 est une promo qui porte un « L »).
export const rarityOf = (c) => RARITIES[c.printedRarity || c.rarity] || RARITIES[c.rarity];
export const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const BY_RARITY = Object.fromEntries(
  Object.keys(RARITIES).map((r) => [r, CARDS.filter((c) => c.rarity === r)])
);

// Numéros du set dont on n'a pas encore l'image (affichés « à venir » dans l'album, absents des boosters).
const known = new Set(CARDS.filter((c) => c.n <= SET.total).map((c) => c.n));
export const MISSING = Array.from({ length: SET.total }, (_, i) => i + 1).filter((n) => !known.has(n));

// ---------- Booster : 10 cartes, révélées dans l'ordre réel du paquet ----------
// Essence → communes → peu communes → reverse holo → rare garantie (toujours en dernier).
// Les promos (P) ne sortent pas en booster : elles se gagnent en Duel.
export const PACK_SLOTS = [
  { label: "Essence",      count: 1, table: [["ES", 1]] },
  { label: "Commune",      count: 4, table: [["C", 1]] },
  { label: "Peu commune",  count: 3, table: [["PC", 1]] },
  { label: "Reverse holo", count: 1, foil: true, table: [["C", 0.55], ["PC", 0.30], ["R", 0.15]] },
  { label: "Rare garantie", count: 1, table: [["L", 0.04], ["E", 0.18], ["R", 0.78]] },
];
export const PACK_SIZE = PACK_SLOTS.reduce((s, x) => s + x.count, 0);
export const PROMO_CHANCE_ON_WIN = 0.15;
