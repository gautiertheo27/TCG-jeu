import { CARDS, BY_ID, RARITIES, COLORS, SET, PACK_SLOTS, PACK_SIZE, MISSING } from "./cards.js";
import * as S from "./state.js";
import { cardHTML, placeholderHTML, esc } from "./cardview.js";
import { initDuel } from "./duel-ui.js";
import { playOpening, isOpening } from "./opening.js";

const $ = (s) => document.querySelector(s);

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

// Designs des boosters (images fournies dans src/boosters/). Sans images, le booster CSS reste affiché.
const BOOSTER_ART = ["boosters/1.webp", "boosters/2.webp", "boosters/3.webp", "boosters/4.webp"];
let packIdx = 0;
try { packIdx = Math.min(BOOSTER_ART.length - 1, +localStorage.getItem("gmtcg.pack") || 0); } catch (_) {}
function setPack(i) {
  packIdx = i; try { localStorage.setItem("gmtcg.pack", i); } catch (_) {}
  $("#packArt").src = BOOSTER_ART[i];
  document.querySelectorAll("#packPicker button").forEach((b, k) => b.classList.toggle("on", k === i));
}
(function initPacks() {
  const img = $("#packArt");
  img.addEventListener("load", () => {
    img.classList.remove("hidden"); $("#boosterPack").classList.add("has-art");
    $("#packPicker").classList.remove("hidden");
  });
  img.addEventListener("error", () => { img.classList.add("hidden"); $("#boosterPack").classList.remove("has-art"); $("#packPicker").classList.add("hidden"); });
  $("#packPicker").innerHTML = BOOSTER_ART.map((src, i) => `<button type="button" aria-label="Booster ${i + 1}"><img src="${src}" alt="" draggable="false"></button>`).join("");
  document.querySelectorAll("#packPicker button").forEach((b, i) => b.addEventListener("click", () => setPack(i)));
  setPack(packIdx);
})();

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
  const busy = isOpening();
  $("#openOne").disabled = st <= 0 || busy;
  $("#openAll").disabled = st <= 1 || busy;
  $("#boosterPack").classList.toggle("empty", st <= 0);
}

async function openPacks(count) {
  if (isOpening()) return;
  const quick = count > 1;                       // « Tout ouvrir » : récap direct, sans animation
  const pulls = [];
  for (let i = 0; i < count; i++) { const p = S.openBooster(); if (!p) break; pulls.push(...p); }
  if (!pulls.length) { toast("Plus de booster : reviens dans quelques minutes !"); return; }
  tick();
  const { again } = await playOpening({ pulls, packSrc: BOOSTER_ART[packIdx], quick, canAgain: S.get().stock > 0 });
  tick(); window.scrollTo({ top: 0 });
  if (again) openPacks(1);
}

$("#boosterPack").addEventListener("click", () => openPacks(1));
$("#openOne").addEventListener("click", () => openPacks(1));
$("#openAll").addEventListener("click", () => openPacks(S.get().stock));

// ---------- Collection ----------
const fR = $("#fRarity");
for (const [k, r] of Object.entries(RARITIES)) fR.insertAdjacentHTML("beforeend", `<option value="${k}">${r.name}</option>`);
const fC = $("#fCat");
for (const cat of [...new Set(CARDS.map((c) => c.category))]) fC.insertAdjacentHTML("beforeend", `<option>${esc(cat)}</option>`);
["#fSearch", "#fRarity", "#fOwned", "#fCat"].forEach((s) => $(s).addEventListener("input", renderCollection));

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
    if (fC.value && c.category !== fC.value) return false;
    if (q && !(`${c.name} ${c.category} ${c.color} ${c.label}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const filtering = q || rar || own || fC.value;
  const items = list.map((c) => ({ n: c.n, html: (() => {
    const e = S.get().collection[c.id], n = e?.n || 0;
    return `<div class="cell${n ? "" : " missing"}" data-id="${c.id}">${cardHTML(c, { holo: (e?.holo || 0) > 0, hidden: !n })}${n ? `<span class="count">×${n}</span>` : ""}</div>`;
  })() }));
  if (!filtering) items.push(...MISSING.map((n) => ({ n, html: placeholderHTML(n) })));
  items.sort((a, b) => a.n - b.n);
  $("#collGrid").innerHTML = items.map((i) => i.html).join("") || `<p class="muted">Aucune carte ne correspond.</p>`;
}
$("#collGrid").addEventListener("click", (e) => {
  const cell = e.target.closest(".cell"); if (!cell || !cell.dataset.id) return;
  const c = BY_ID[cell.dataset.id], entry = S.get().collection[c.id];
  if (!entry) { toast(`${c.label} — pas encore obtenue`); return; }
  openZoom(c, entry);
});

// ---------- Zoom avec effet brillance ----------
function openZoom(c, entry) {
  const z = $("#zoom");
  z.innerHTML = `<div><div class="zcard">${cardHTML(c, { holo: entry.holo > 0 })}</div>
    <div class="zinfo"><b>${esc(c.name)}</b> · ${esc(c.category || "")}${c.def ? ` · Def ${c.def}` : ""} · ${RARITIES[c.rarity].name}<br>
    ×${entry.n}${entry.holo ? ` (dont ${entry.holo} holo)` : ""}${c.illustrator ? ` · Illus : ${esc(c.illustrator)}` : ""}<br><small>Touche pour fermer</small></div></div>`;
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

// ---------- Duel (règles officielles) ----------
const duelUI = initDuel({ S, toast, tick, esc });
function renderDuelSetup() { duelUI.showSetup(); }

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
  if (confirm("Effacer toute ta progression ?")) { S.reset(); tick(); renderProfile(); toast("Progression réinitialisée"); }
});

// ---------- Appli installable (PWA) ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("#installBtn").classList.remove("hidden"); });
$("#installBtn").addEventListener("click", async () => {
  if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $("#installBtn").classList.add("hidden");
});

// ---------- Démarrage ----------
tick();
setInterval(tick, 1000);
