// Sauvegarde + système de boosters (2 par heure, cumulables).
import { CARDS, BY_RARITY, RARITIES, PACK_SLOTS } from "./cards.js";

export const BOOSTER_INTERVAL_MS = 30 * 60 * 1000; // 1 booster / 30 min = 2 / heure
export const MAX_STOCK = 48;                        // 24 h d'absence. Mettre Infinity pour aucun plafond.
export const START_STOCK = 2;
export const DUEL_REWARDS_PER_DAY = 3;

const KEY = "gmtcg.save.v2"; // v2 : nouvelle numérotation (raretés modernes)

function fresh() {
  return {
    version: 2,
    stock: START_STOCK,
    lastCredit: Date.now(),
    collection: {},
    stats: { opened: 0, duelsWon: 0, duelsPlayed: 0 },
    duelRewards: { day: today(), count: 0 },
  };
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let state = load();
save();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (_) { /* stockage indisponible : partie temporaire */ }
  return fresh();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}

export function get() { return state; }

// Crédite les boosters gagnés depuis le dernier passage. Renvoie le nombre gagné.
export function creditBoosters(now = Date.now()) {
  if (now < state.lastCredit) { state.lastCredit = now; save(); return 0; } // horloge reculée
  if (state.stock >= MAX_STOCK) { state.lastCredit = now; save(); return 0; }
  const earned = Math.floor((now - state.lastCredit) / BOOSTER_INTERVAL_MS);
  if (earned <= 0) return 0;
  const added = Math.min(earned, MAX_STOCK - state.stock);
  state.stock += added;
  state.lastCredit = state.stock >= MAX_STOCK ? now : state.lastCredit + earned * BOOSTER_INTERVAL_MS;
  save();
  return added;
}

export function msUntilNext(now = Date.now()) {
  if (state.stock >= MAX_STOCK) return null;
  return Math.max(0, state.lastCredit + BOOSTER_INTERVAL_MS - now);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function rollRarity(table) {
  let r = Math.random(), acc = 0;
  for (const [rar, p] of table) { acc += p; if (r < acc) return rar; }
  return table[table.length - 1][0];
}

// Génère un booster dans l'ordre réel d'ouverture (voir PACK_SLOTS dans cards.js).
export function rollBooster() {
  const out = [];
  for (const slot of PACK_SLOTS) {
    for (let i = 0; i < slot.count; i++) {
      const rar = rollRarity(slot.table);
      const card = pick(BY_RARITY[rar]);
      const holo = !!slot.foil || (!!slot.foilUnlessSecret && !RARITIES[rar].secret);
      out.push({ id: card.id, holo, slot: slot.label });
    }
  }
  return out;
}

// Consomme un booster et ajoute les cartes à la collection.
export function openBooster() {
  creditBoosters();
  if (state.stock <= 0) return null;
  state.stock -= 1;
  const pulls = rollBooster().map((p) => {
    const entry = state.collection[p.id] || { n: 0, holo: 0 };
    const isNew = entry.n === 0;
    entry.n += 1;
    if (p.holo) entry.holo += 1;
    state.collection[p.id] = entry;
    return { ...p, isNew };
  });
  state.stats.opened += 1;
  save();
  return pulls;
}

export function owned(id) { return state.collection[id]?.n || 0; }

export function completion() {
  const have = CARDS.filter((c) => owned(c.id) > 0).length;
  return { have, total: CARDS.length };
}

export function recordDuel(won) {
  state.stats.duelsPlayed += 1;
  let rewarded = false;
  if (won) {
    state.stats.duelsWon += 1;
    if (state.duelRewards.day !== today()) state.duelRewards = { day: today(), count: 0 };
    if (state.duelRewards.count < DUEL_REWARDS_PER_DAY) {
      state.duelRewards.count += 1;
      state.stock += 1;
      rewarded = true;
    }
  }
  save();
  return rewarded;
}

export function exportSave() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(code) {
  const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (data.version !== 2 || typeof data.collection !== "object") throw new Error("Sauvegarde invalide");
  state = { ...fresh(), ...data };
  save();
}

export function reset() {
  state = fresh();
  save();
}
