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
