// Construction de decks : Club de 40 cartes (max 3 exemplaires d'une même carte) + Réserve de 10 Essences.
import { CARDS, BY_ID } from "../cards.js";

const sameCard = (c) => `${c.name}|${c.color}`;
export function validateDeck({ club, reserve }) {
  const errs = [];
  if (club.length !== 40) errs.push(`Le Club doit contenir 40 cartes (${club.length}).`);
  if (reserve.length !== 10) errs.push(`La Réserve doit contenir 10 Essences (${reserve.length}).`);
  const n = {}; for (const id of club) { const k = sameCard(BY_ID[id]); n[k] = (n[k] || 0) + 1; if (n[k] === 4) errs.push(`Maximum 3 exemplaires de « ${BY_ID[id].name} ».`); }
  if (club.some((id) => BY_ID[id].category === "Essence")) errs.push("Les Essences vont dans la Réserve, pas dans le Club.");
  if (reserve.some((id) => BY_ID[id].category !== "Essence")) errs.push("La Réserve ne contient que des Essences.");
  const joueurs = club.filter((id) => BY_ID[id].category === "Joueur").length;
  if (joueurs < 15) errs.push(`Conseil : jouez au moins 15 Joueurs (${joueurs}).`);
  return errs;
}

// Deck automatique pour une ou deux couleurs, à partir d'un "stock" { id: quantité } (null = tout le set, 3 exemplaires).
export function autoDeck(colors, stock = null) {
  const have = (id) => (stock ? stock[id]?.n || 0 : 3);
  const eligible = CARDS.filter((c) => c.category !== "Essence" && c.category !== undefined && (c.color === "Neutre" || colors.includes(c.color)) && have(c.id) > 0 && !c.id.startsWith("P"));
  const score = (c) => (c.category === "Joueur" ? 3 : c.category === "Objet" ? 1.2 : 1) + (c.color === "Neutre" ? 0.2 : 0.6) + (c.rarity === "R" ? 0.2 : 0) + Math.random() * 0.3;
  const count = {}; const club = [];
  const sorted = [...eligible].sort((a, b) => score(b) - score(a));
  const joueurs = sorted.filter((c) => c.category === "Joueur"), autres = sorted.filter((c) => c.category !== "Joueur");
  const add = (c) => { const k = sameCard(c); const have2 = Math.min(3, have(c.id)); if ((count[k] || 0) >= have2 || club.length >= 40) return false; count[k] = (count[k] || 0) + 1; club.push(c.id); return true; };
  // 16 Joueurs d'abord, puis le reste, puis on complète
  for (const pass of [0, 1, 2]) { for (const c of joueurs) { if (club.filter((id) => BY_ID[id].category === "Joueur").length >= 16 + pass * 2) break; add(c); } }
  for (const pass of [0, 1, 2]) for (const c of autres) { if (club.length >= 28 + pass * 6) break; add(c); }
  for (let k = 0; k < 3 && club.length < 40; k++) for (const c of sorted) if (club.length < 40) add(c);
  // Réserve : 10 Essences des couleurs choisies, en alternant les couleurs (limitées par la collection si fournie)
  const byColor = colors.map((col) => CARDS.filter((c) => c.category === "Essence" && c.color === col).flatMap((c) => Array(stock ? Math.min(have(c.id), 10) : 10).fill(c.id)));
  const reserve = [];
  for (let k = 0; reserve.length < 10 && byColor.some((l) => l.length); k++) { const l = byColor[k % byColor.length]; if (l.length) reserve.push(l.shift()); }
  return { club, reserve, colors };
}
export const COLOR_PAIRS = [["Rose", "Orange"], ["Violette", "Mauve"], ["Mauve", "Bleue"], ["Rose", "Mauve"], ["Orange", "Violette"], ["Verte", "Rose"], ["Azur", "Mauve"], ["Jaune", "Mauve"]];

// ---------- Decks prêtés (préconstruits) ----------
// Des decks « corrects » : uniquement Communes / Peu communes / Rares (pas d'Épique, de Légendaire ni de Promo),
// 2 exemplaires maximum par carte, 16 à 18 Joueurs. Les cartes sont prêtées pour la manche : elles ne rejoignent pas ta collection.
export const PRESETS = [
  { id: "tempo", name: "Tempo Rose-Orange", colors: ["Rose", "Orange"], seed: 11, blurb: "Des Joueurs pas chers qui frappent vite, avec quelques Objets à lier." },
  { id: "controle", name: "Contrôle Violette-Mauve", colors: ["Violette", "Mauve"], seed: 23, blurb: "Désengager, échanger et bencher : on contrôle le rythme de la partie." },
  { id: "bagarre", name: "Bagarre Mauve-Bleue", colors: ["Mauve", "Bleue"], seed: 37, blurb: "Des Joueurs solides et des Moments qui retournent les Essences adverses." },
  { id: "mix", name: "Mix Rose-Mauve", colors: ["Rose", "Mauve"], seed: 41, blurb: "Un peu de tout : Buff, Légion et pioche pour tenir sur la durée." },
  { id: "objets", name: "Objets Orange-Violette", colors: ["Orange", "Violette"], seed: 53, blurb: "Des Joueurs renforcés par des Objets liés et des Ripostes." },
  { id: "azur", name: "Combos Azur-Mauve", colors: ["Azur", "Mauve"], seed: 67, blurb: "Des Joueurs interchangeables et beaucoup de cartes neutres faciles à jouer." },
];
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function buildPreset(id) {
  const P = PRESETS.find((p) => p.id === id) || PRESETS[0];
  const rnd = rng(P.seed);
  const pool = CARDS.filter((c) => ["C", "PC", "R"].includes(c.rarity) && c.category !== "Essence" && !c.id.startsWith("P") && (c.color === "Neutre" || P.colors.includes(c.color)));
  const dedup = {}; for (const c of pool) dedup[sameCard(c)] = dedup[sameCard(c)] || c;
  const unique = Object.values(dedup).sort(() => rnd() - 0.5);
  // On privilégie les Joueurs d'attaque peu chère, comme le conseillent les règles.
  const cheap = (c) => (c.attacks?.length ? Math.min(...c.attacks.map((a) => (a.cost || []).length)) : 9);
  const joueurs = unique.filter((c) => c.category === "Joueur").sort((a, b) => cheap(a) - cheap(b) + (rnd() - 0.5) * 2);
  const autres = unique.filter((c) => c.category !== "Joueur");
  const club = []; const n = {};
  const add = (c, max) => { const k = sameCard(c); if (club.length >= 40 || (n[k] || 0) >= max) return; n[k] = (n[k] || 0) + 1; club.push(c.id); };
  for (const c of joueurs.slice(0, 9)) { add(c, 2); add(c, 2); }                      // 18 Joueurs
  for (const c of autres.filter((x) => x.category === "Objet").slice(0, 4)) add(c, 2); // quelques Objets
  for (const c of autres.filter((x) => x.category !== "Objet")) { if (club.length >= 38) break; add(c, 2); }
  for (const c of [...joueurs.slice(9), ...autres]) add(c, 1);                          // complète sans dépasser 2 exemplaires
  for (const c of unique) add(c, 2);
  const byColor = P.colors.map((col) => CARDS.filter((c) => c.category === "Essence" && c.color === col)[0].id);
  const reserve = Array.from({ length: 10 }, (_, i) => byColor[i % byColor.length]);
  return { club, reserve, colors: P.colors, name: P.name, preset: P.id };
}
