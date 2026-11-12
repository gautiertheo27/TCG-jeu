// Sauvegarde + système de boosters (1 toutes les 10 minutes, 10 max en stock).
// Deux modes : « local » (invité, navigateur) et « remote » (compte connecté : stock et collection gérés par le serveur).
import { CARDS, BY_ID, BY_RARITY, RARITIES, PACK_SLOTS, PROMO_CHANCE_ON_WIN, SET } from "./cards.js";

export let BOOSTER_INTERVAL_MS = 10 * 60 * 1000;   // 1 booster toutes les 10 minutes
export let MAX_STOCK = 10;                          // cumulable jusqu'à 10 boosters en stock (au-delà, le décompte s'arrête)
export const START_STOCK = 2;
export const DUEL_REWARDS_PER_DAY = 10;   // par fenêtre glissante de 24 h

const KEY = "gmtcg.save.v3"; // v3 : vraies cartes du TCG Gentle Mates

function fresh() {
  return {
    version: 3,
    stock: START_STOCK,
    lastCredit: Date.now(),
    collection: {},
    stats: { opened: 0, duelsWon: 0, duelsPlayed: 0 },
    duelRewards: { start: 0, count: 0 },
  };
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let localState = load();
let state = localState;
let mode = "local", remoteApi = null, clockOffset = 0, profile = null;
save();
const nowMs = () => Date.now() + clockOffset;     // en mode compte : heure du serveur

export const isRemote = () => mode === "remote";
export const getProfile = () => profile;

function fromServer(r) {
  clockOffset = Date.parse(r.now) - Date.now();
  if (r.interval_s) BOOSTER_INTERVAL_MS = r.interval_s * 1000;
  if (r.max_stock) MAX_STOCK = r.max_stock;
  profile = r.profile || null;
  state = { version: 3, stock: r.stock, lastCredit: Date.parse(r.last_credit), collection: r.collection || {},
    stats: r.stats, duelRewards: { start: r.duelRewards?.start ? +new Date(r.duelRewards.start) : 0, count: r.duelRewards?.count || 0 }, imported: !!r.imported };
}
export function enterRemote(api, serverState) { mode = "remote"; remoteApi = api; fromServer(serverState); }
export function applyServerState(serverState) { fromServer(serverState); }
// Déconnexion. Avec un compte obligatoire (locked), plus aucune collection n'est visible tant qu'on ne s'est pas reconnecté :
// l'état affiché est vide, et la progression d'invité enregistrée sur l'appareil n'est pas montrée.
export function leaveRemote(locked = false) {
  remoteApi = null; profile = null; clockOffset = 0; BOOSTER_INTERVAL_MS = 10 * 60 * 1000; MAX_STOCK = 10;
  if (locked) { mode = "locked"; state = { version: 3, stock: 0, lastCredit: Date.now(), collection: {}, stats: { opened: 0, duelsWon: 0, duelsPlayed: 0 }, duelRewards: { start: 0, count: 0 } }; }
  else { mode = "local"; state = localState; }
}
export const isLocked = () => mode === "locked";
export function localSnapshot() { return localState; }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (_) { /* stockage indisponible : partie temporaire */ }
  return fresh();
}

export function save() {
  if (mode !== "local") return;                 // le compte est sauvegardé par le serveur
  try { localStorage.setItem(KEY, JSON.stringify(localState)); } catch (_) {}
}

export function get() { return state; }

// Crédite les boosters gagnés depuis le dernier passage. Renvoie le nombre gagné.
export function creditBoosters(now = nowMs()) {
  if (mode === "locked") return 0;
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

export function msUntilNext(now = nowMs()) {
  if (mode === "locked") return null;
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
    const part = [];
    for (let i = 0; i < slot.count; i++) {
      const card = pick(BY_RARITY[rollRarity(slot.table)]);
      part.push({ id: card.id, holo: slot.foil === true || (typeof slot.foil === "number" && Math.random() < slot.foil), slot: slot.label });
    }
    // Ordre réel du paquet : les moins rares d'abord, la plus belle carte en dernier.
    if (slot.sort) part.sort((x, y) => RARITIES[BY_ID[x.id].rarity].order - RARITIES[BY_ID[y.id].rarity].order);
    out.push(...part);
  }
  return out;
}

// Consomme un booster et ajoute les cartes à la collection. Renvoie les 10 cartes, ou null s'il n'y en a plus.
export async function openBooster() {
  creditBoosters();
  if (state.stock <= 0) return null;
  if (mode === "remote") {
    try {
      const r = await remoteApi.openBooster();
      fromServer(r.state); return r.pulls;
    } catch (e) {
      if (/NO_BOOSTER/.test(e.message)) { fromServer(await remoteApi.getState()); return null; }
      throw e;
    }
  }
  state.stock -= 1;
  const pulls = rollBooster().map((p) => ({ ...p, isNew: addCard(p.id, p.holo) }));
  state.stats.opened += 1;
  save();
  return pulls;
}

export function owned(id) { return state.collection[id]?.n || 0; }

export function completion() {
  const have = CARDS.filter((c) => c.n <= SET.total && owned(c.id) > 0).length;
  return { have, total: SET.total };
}

function addCard(id, holo = false) {
  const entry = state.collection[id] || { n: 0, holo: 0 };
  const isNew = entry.n === 0;
  entry.n += 1; if (holo) entry.holo += 1;
  state.collection[id] = entry;
  return isNew;
}

export async function recordDuel(won) {
  if (mode === "locked") return { rewarded: false, promo: null };
  if (mode === "remote") {
    try {
      const r = await remoteApi.recordDuel(won); fromServer(r.state);
      return { rewarded: !!r.rewarded, promo: r.promo ? BY_ID[r.promo] : null };
    } catch (e) { console.error(e); return { rewarded: false, promo: null }; }
  }
  state.stats.duelsPlayed += 1;
  let rewarded = false, promo = null;
  if (won) {
    state.stats.duelsWon += 1;
    if (!state.duelRewards.start || Date.now() - state.duelRewards.start >= 86400000) state.duelRewards = { start: Date.now(), count: 0 };
    if (state.duelRewards.count < DUEL_REWARDS_PER_DAY) {
      state.duelRewards.count += 1;
      state.stock += 1;
      rewarded = true;
    }
    if (Math.random() < PROMO_CHANCE_ON_WIN) {
      promo = pick(BY_RARITY.P);
      addCard(promo.id);
    }
  }
  save();
  return { rewarded, promo };
}

export function exportSave() {
  if (mode === "remote") return btoa(unescape(encodeURIComponent(JSON.stringify(localState))));
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(code) {
  const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (data.version !== 3 || typeof data.collection !== "object") throw new Error("Sauvegarde invalide");
  localState = { ...fresh(), ...data }; if (mode === "local") state = localState;
  save();
}

export function reset() {
  localState = fresh(); if (mode === "local") state = localState;
  save();
}
