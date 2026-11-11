import { CARDS, BY_ID, RARITIES, TYPES, SET, PACK_SLOTS, PACK_SIZE } from "./cards.js";
import * as S from "./state.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Rendu d'une carte ----------
function hue(str) { let h = 0; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
function mono(name) {
  const base = name.split("_")[0].length >= 3 ? name.split("_")[0] : name;
  const clean = base.replace(/\d+$/g, "").replace(/[^A-Za-zÀ-ÿ ]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return (clean.slice(0, 2) || name.slice(0, 2)).toUpperCase();
}

export function cardHTML(card, { holo = false, hidden = false } = {}) {
  if (hidden) card = { ...card, name: "???", game: "?", role: "Inconnue", flavor: "Pas encore obtenue." };
  const r = RARITIES[card.rarity], t = TYPES[card.type], h = hue(card.name);
  return `<div class="card${holo ? " holo" : ""}" data-r="${card.rarity}"
      style="--rc:${r.color};--a1:hsl(${h} 80% 55% / .75);--a2:hsl(${(h + 140) % 360} 80% 50% / .6)">
    <div class="c-top"><span class="c-name">${esc(card.name)}</span><span class="c-pow">${card.power}</span></div>
    <div class="c-art">${card.img ? `<img src="${esc(card.img)}" alt="" loading="lazy">` : ""}<span class="c-type" title="${t.name}">${t.icon}</span><span class="c-mono">${esc(mono(card.name))}</span><span class="c-game">${esc(card.game)}</span></div>
    <div class="c-role">${esc(card.role)} · ${t.name}</div>
    <div class="c-flavor">« ${esc(card.flavor)} »</div>
    <div class="c-foot"><span>${SET.code} ${card.label}</span><span class="c-rar" title="${r.name}">${r.symbol} ${card.rarity}</span></div>
  </div>`;
}

// ---------- Navigation ----------
document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => showTab(b.dataset.tab)));
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === `tab-${name}`));
  if (name === "collection") renderCollection();
  if (name === "duel") renderDuelSetup();
  if (name === "profil") renderProfile();
}

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- Boosters ----------
$("#packSize").textContent = `${PACK_SIZE} cartes`;
$("#odds").innerHTML = PACK_SLOTS.map((sl) => `<tr><td>${sl.count}× ${sl.label}${sl.foil ? " ✨" : ""}</td><td>${
  sl.table.map(([r, p]) => `<span style="color:${RARITIES[r].color}">${RARITIES[r].symbol} ${RARITIES[r].name}</span> ${+(p * 100).toFixed(1)} %`).join("<br>")}</td></tr>`).join("");
$("#maxStock").textContent = Number.isFinite(S.MAX_STOCK) ? S.MAX_STOCK : "∞";

function fmt(ms) {
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function tick() {
  const gained = S.creditBoosters();
  if (gained > 0) toast(`🎁 +${gained} booster${gained > 1 ? "s" : ""} !`);
  const st = S.get().stock;
  $("#stockCount").textContent = st; $("#stockBig").textContent = st;
  const next = S.msUntilNext();
  $("#nextTimer").textContent = next === null ? "Stock plein — ouvre tes boosters !" : `Prochain booster dans ${fmt(next)}`;
  const busy = !$("#reveal").classList.contains("hidden");
  $("#openOne").disabled = st <= 0 || busy;
  $("#openAll").disabled = st <= 1 || busy;
  $("#boosterPack").classList.toggle("empty", st <= 0);
}

function openPacks(count) {
  if (!$("#reveal").classList.contains("hidden")) return;
  const pulls = [];
  for (let i = 0; i < count; i++) { const p = S.openBooster(); if (!p) break; pulls.push(...p); }
  if (!pulls.length) { toast("Plus de booster : reviens dans quelques minutes !"); return; }
  // Ordre réel d'ouverture conservé : communes → peu communes → reverse → rare.
  const pack = $("#boosterPack");
  pack.classList.remove("opening"); void pack.offsetWidth; pack.classList.add("opening");
  setTimeout(() => showReveal(pulls), 450);
  tick();
}

function showReveal(pulls) {
  const box = $("#revealCards");
  box.innerHTML = pulls.map((p, i) => {
    const c = BY_ID[p.id];
    return `<div class="flip" data-r="${c.rarity}" style="animation-delay:${Math.min(i, 20) * 70}ms;--glow:${RARITIES[c.rarity].color}">
      <div class="face back"><div class="card-back">GM</div></div>
      <div class="face front">${p.isNew ? '<span class="badge-new">NOUVEAU</span>' : ""}${p.holo ? '<span class="badge-holo">HOLO</span>' : ""}${cardHTML(c, { holo: p.holo })}</div>
    </div>`;
  }).join("");
  box.querySelectorAll(".flip").forEach((f) => f.addEventListener("click", () => f.classList.add("flipped")));
  $("#reveal").classList.remove("hidden");
  $("#reveal").scrollIntoView({ behavior: "smooth", block: "start" });
  tick();
}

$("#boosterPack").addEventListener("click", () => openPacks(1));
$("#openOne").addEventListener("click", () => openPacks(1));
$("#openAll").addEventListener("click", () => openPacks(S.get().stock));
$("#revealAll").addEventListener("click", () => {
  document.querySelectorAll("#revealCards .flip").forEach((f, i) => setTimeout(() => f.classList.add("flipped"), i * 90));
});
$("#revealDone").addEventListener("click", () => {
  $("#reveal").classList.add("hidden"); $("#revealCards").innerHTML = ""; tick();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- Collection ----------
const fR = $("#fRarity");
for (const [k, r] of Object.entries(RARITIES)) fR.insertAdjacentHTML("beforeend", `<option value="${k}">${r.name}</option>`);
["#fSearch", "#fRarity", "#fOwned"].forEach((s) => $(s).addEventListener("input", renderCollection));

function renderCollection() {
  const { have, total } = S.completion();
  $("#collCount").textContent = `${have} / ${total} (${Math.round((have / total) * 100)} %)`;
  $("#collBar").style.width = `${(have / total) * 100}%`;
  const q = $("#fSearch").value.trim().toLowerCase(), rar = fR.value, own = $("#fOwned").value;
  const list = CARDS.filter((c) => {
    const n = S.owned(c.id);
    if (rar && c.rarity !== rar) return false;
    if (own === "have" && !n) return false;
    if (own === "missing" && n) return false;
    if (own === "dupes" && n < 2) return false;
    if (q && !(`${c.name} ${c.game} ${c.role} ${c.id}`.toLowerCase().includes(q))) return false;
    return true;
  });
  $("#collGrid").innerHTML = list.map((c) => {
    const e = S.get().collection[c.id], n = e?.n || 0;
    return `<div class="cell${n ? "" : " missing"}" data-id="${c.id}">${cardHTML(c, { holo: (e?.holo || 0) > 0, hidden: !n })}${n ? `<span class="count">×${n}</span>` : ""}</div>`;
  }).join("") || `<p class="muted">Aucune carte ne correspond.</p>`;
}
$("#collGrid").addEventListener("click", (e) => {
  const cell = e.target.closest(".cell"); if (!cell) return;
  const c = BY_ID[cell.dataset.id], entry = S.get().collection[c.id];
  if (!entry) { toast(`${c.id} — pas encore obtenue`); return; }
  openZoom(c, entry);
});

// ---------- Zoom avec effet brillance ----------
function openZoom(c, entry) {
  const z = $("#zoom");
  z.innerHTML = `<div><div class="zcard">${cardHTML(c, { holo: entry.holo > 0 })}</div>
    <div class="zinfo">${esc(c.name)} — ×${entry.n}${entry.holo ? ` (dont ${entry.holo} holo)` : ""}<br><small>Touche pour fermer</small></div></div>`;
  z.classList.remove("hidden");
}
$("#zoom").addEventListener("click", () => $("#zoom").classList.add("hidden"));
$("#zoom").addEventListener("pointermove", (e) => {
  const zc = $("#zoom .zcard"); if (!zc) return;
  const r = zc.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  zc.style.transform = `rotateY(${(x - 0.5) * 24}deg) rotateX(${(0.5 - y) * 24}deg)`;
  const card = zc.querySelector(".card");
  card.style.setProperty("--px", `${x * 100}%`); card.style.setProperty("--py", `${y * 100}%`);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#zoom").classList.add("hidden"); });

// ---------- Duel ----------
let picked = [];
function ownedCards() { return CARDS.filter((c) => S.owned(c.id) > 0); }

function renderDuelSetup() {
  $("#duelSetup").classList.remove("hidden"); $("#duelBoard").classList.add("hidden");
  const mine = ownedCards();
  picked = picked.filter((id) => S.owned(id) > 0);
  if (mine.length < 5) {
    $("#duelPick").innerHTML = `<p class="muted">Il te faut au moins 5 cartes différentes (tu en as ${mine.length}). Ouvre des boosters !</p>`;
  } else {
    $("#duelPick").innerHTML = mine.sort((a, b) => b.power - a.power).map((c) =>
      `<div class="cell${picked.includes(c.id) ? " selected" : ""}" data-id="${c.id}">${cardHTML(c)}</div>`).join("");
  }
  updateDuelBtn();
}
function updateDuelBtn() { $("#duelStart").disabled = picked.length !== 5; $("#duelStart").textContent = `Lancer le duel (${picked.length}/5)`; }
$("#duelPick").addEventListener("click", (e) => {
  const cell = e.target.closest(".cell"); if (!cell) return;
  const id = cell.dataset.id;
  if (picked.includes(id)) picked = picked.filter((x) => x !== id);
  else if (picked.length < 5) picked.push(id);
  else { toast("5 cartes maximum"); return; }
  cell.classList.toggle("selected", picked.includes(id)); updateDuelBtn();
});
$("#duelAuto").addEventListener("click", () => {
  picked = ownedCards().sort((a, b) => b.power - a.power).slice(0, 5).map((c) => c.id); renderDuelSetup();
});

let duel;
$("#duelStart").addEventListener("click", startDuel);
$("#duelAgain").addEventListener("click", renderDuelSetup);

function startDuel() {
  const hand = picked.map((id) => BY_ID[id]);
  const avg = hand.reduce((s, c) => s + c.power, 0) / 5;
  // L'IA prend 5 cartes de puissance proche de la moyenne du joueur
  const pool = [...CARDS].sort(() => Math.random() - 0.5).sort((a, b) => Math.abs(a.power - avg) - Math.abs(b.power - avg));
  const ai = pool.slice(0, 9).sort(() => Math.random() - 0.5).slice(0, 5);
  duel = { hand, ai, me: 0, opp: 0, round: 0, lock: false };
  $("#duelSetup").classList.add("hidden"); $("#duelBoard").classList.remove("hidden"); $("#duelAgain").classList.add("hidden");
  $("#slotAi").innerHTML = ""; $("#slotMe").innerHTML = ""; $("#duelMsg").textContent = "Joue une carte";
  renderHand(); updateScore();
}
function renderHand() {
  $("#hand").innerHTML = duel.hand.map((c, i) => `<div class="cell" data-i="${i}">${cardHTML(c)}</div>`).join("");
}
function updateScore() {
  $("#sMe").textContent = duel.me; $("#sAi").textContent = duel.opp;
  $("#roundLbl").textContent = `Manche ${Math.min(duel.round + 1, 5)}/5`;
}
function strength(a, b) { return a.power + (TYPES[a.type].beats === b.type ? 3 : 0); }

$("#hand").addEventListener("click", (e) => {
  const cell = e.target.closest(".cell"); if (!cell || duel.lock) return;
  duel.lock = true;
  const mine = duel.hand.splice(+cell.dataset.i, 1)[0];
  const theirs = duel.ai.shift();
  $("#slotMe").innerHTML = cardHTML(mine); $("#slotAi").innerHTML = ""; renderHand();
  $("#duelMsg").textContent = "…";
  setTimeout(() => {
    $("#slotAi").innerHTML = cardHTML(theirs);
    const a = strength(mine, theirs), b = strength(theirs, mine);
    let msg = a > b ? "Manche gagnée !" : a < b ? "Manche perdue" : "Égalité";
    if (a > b) duel.me++; else if (b > a) duel.opp++;
    const bonus = a > mine.power ? "Ton type a l'avantage +3" : b > theirs.power ? "Type adverse avantagé +3" : "";
    $("#duelMsg").innerHTML = `${a} vs ${b}<br>${msg}${bonus ? `<span class="bonus">${bonus}</span>` : ""}`;
    duel.round++; updateScore(); duel.lock = false;
    if (duel.round === 5) endDuel();
  }, 600);
});
function endDuel() {
  duel.lock = true;
  const won = duel.me > duel.opp;
  const rewarded = S.recordDuel(won);
  setTimeout(() => {
    $("#duelMsg").innerHTML = won ? `🏆 Victoire ${duel.me}-${duel.opp} !${rewarded ? '<span class="bonus">+1 booster</span>' : '<span class="bonus">Récompenses du jour épuisées</span>'}`
      : duel.me === duel.opp ? `Match nul ${duel.me}-${duel.opp}` : `Défaite ${duel.me}-${duel.opp}`;
    $("#duelAgain").classList.remove("hidden"); tick();
  }, 900);
}

// ---------- Profil ----------
function renderProfile() {
  const st = S.get(), { have, total } = S.completion();
  const cards = Object.values(st.collection).reduce((s, e) => s + e.n, 0);
  const holos = Object.values(st.collection).reduce((s, e) => s + e.holo, 0);
  const items = [
    [st.stats.opened, "Boosters ouverts"], [cards, "Cartes obtenues"], [`${have}/${total}`, `Collection ${SET.name}`],
    [cards - have, "Doublons"], [holos, "Cartes holo"], [`${st.stats.duelsWon}/${st.stats.duelsPlayed}`, "Duels gagnés"],
  ];
  $("#stats").innerHTML = items.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
}
$("#btnExport").addEventListener("click", () => { $("#saveCode").value = S.exportSave(); $("#saveCode").select(); toast("Code généré : copie-le !"); });
$("#btnImport").addEventListener("click", () => {
  try { S.importSave($("#saveCode").value); toast("Sauvegarde importée ✔"); tick(); renderProfile(); }
  catch { toast("Code de sauvegarde invalide"); }
});
$("#btnReset").addEventListener("click", () => {
  if (confirm("Effacer toute ta progression ?")) { S.reset(); picked = []; tick(); renderProfile(); toast("Progression réinitialisée"); }
});

// ---------- Démarrage ----------
tick();
setInterval(tick, 1000);
