import { CARDS, BY_ID, RARITIES, COLORS, SET, PACK_SLOTS, PACK_SIZE, MISSING } from "./cards.js";
import * as S from "./state.js";
import { cardHTML, placeholderHTML, esc } from "./cardview.js";
import { initDuel } from "./duel-ui.js";
import { playOpening, isOpening } from "./opening.js";
import { unlock, isMuted, setMuted, sfx } from "./sound.js";
import { configured, initAccount, auth, api, providerLabel, enabledProviders } from "./account.js";

const $ = (s) => document.querySelector(s);

// ---------- Son ----------
const syncSound = () => { $("#soundBtn").textContent = isMuted() ? "🔇" : "🔊"; };
syncSound();
$("#soundBtn").addEventListener("click", () => { unlock(); setMuted(!isMuted()); syncSound(); if (!isMuted()) sfx.tap(); });
["pointerdown", "keydown"].forEach((ev) => window.addEventListener(ev, unlock, { once: false, passive: true }));

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

const BASE_TITLE = document.title;
function tick() {
  const gained = S.creditBoosters();
  if (gained > 0) toast(`🎁 +${gained} booster${gained > 1 ? "s" : ""} !`);
  const st = S.get().stock, max = S.MAX_STOCK, next = S.msUntilNext();
  $("#stockCount").textContent = st; $("#stockBig").textContent = st; $("#maxStock").textContent = Number.isFinite(max) ? max : "∞";
  if (next === null) {
    $("#cdLabel").textContent = "Stock plein — ouvre tes boosters pour relancer le décompte"; $("#nextTimer").textContent = `${st} / ${max}`;
    $("#cdBar").style.width = "100%"; $("#pillTimer").textContent = ""; document.title = BASE_TITLE;
  } else {
    $("#cdLabel").textContent = "Prochain booster dans"; $("#nextTimer").textContent = fmt(next);
    $("#cdBar").style.width = `${Math.max(0, Math.min(100, (1 - next / S.BOOSTER_INTERVAL_MS) * 100))}%`;
    $("#pillTimer").textContent = fmt(next); document.title = st === 0 ? `(${fmt(next)}) ${BASE_TITLE}` : BASE_TITLE;
  }
  const mins = S.BOOSTER_INTERVAL_MS / 60000;
  $("#rule").textContent = `Glisse sur le haut du paquet (ou touche-le) pour l'ouvrir. 1 booster toutes les ${mins} minutes, ${Number.isFinite(max) ? max : "illimités"} en stock au maximum.`;
  const busy = isOpening();
  $("#openOne").disabled = st <= 0 || busy;
  $("#openAll").disabled = st <= 1 || busy;
  $("#boosterPack").classList.toggle("empty", st <= 0);
}

async function openPacks(count) {
  if (isOpening()) return;
  const quick = count > 1;                       // « Tout ouvrir » : récap direct, sans animation
  const pulls = [];
  for (let i = 0; i < Math.min(count, 12); i++) { const p = await S.openBooster().catch((e) => { toast("Erreur serveur : " + e.message); return null; }); if (!p) break; pulls.push(...p); }
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

// ---------- Comptes (Supabase) ----------
let session = null;
function refreshAll() {
  tick(); renderProfile(); renderAccount();
  if ($("#tab-collection").classList.contains("active")) renderCollection();
  const prof = S.getProfile();
  $("#accountBtn").textContent = session ? `👤 ${prof?.username || "Mon compte"}` : "👤 Se connecter";
  $("#saveBox").classList.toggle("hidden", S.isRemote());
}
// Compte obligatoire : tant que personne n'est connecté, la fenêtre de connexion bloque tout le jeu (« gate »).
let required = false, locked = false;
function modal(html, wire, lock = false) {
  const m = $("#authModal"); locked = lock; m.classList.toggle("gate", lock);
  m.innerHTML = `<div class="modal-box">${lock ? '<div class="gate-brand"><span class="logo">GM</span><div><strong>Gentle Mates TCG</strong><small>Connecte-toi pour jouer</small></div></div>' : ""}${html}</div>`; m.classList.remove("hidden");
  m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal)); wire?.(m);
}
function closeModal() { $("#authModal").classList.add("hidden"); $("#authModal").classList.remove("gate"); $("#authModal").innerHTML = ""; locked = false; }
$("#authModal").addEventListener("click", (e) => { if (e.target.id === "authModal" && !locked) closeModal(); });
function gateLoading() { modal('<p class="center muted">Connexion en cours…</p>', null, true); }
function gateError(msg) { modal(`<h3>Serveur injoignable</h3><p class="muted">${esc(msg || "Impossible de contacter le serveur du jeu.")}</p><div class="btn-row"><button class="btn primary" id="gateRetry">Réessayer</button></div>`, (m) => m.querySelector("#gateRetry").addEventListener("click", () => location.reload()), true); }
const errText = (e) => ({ "Invalid login credentials": "E-mail ou mot de passe incorrect.", "User already registered": "Un compte existe déjà avec cet e-mail.",
  "Email not confirmed": "Confirme d'abord ton e-mail (regarde ta boîte de réception).", "Password should be at least 6 characters": "Mot de passe trop court (6 caractères minimum)." }[e.message] || e.message);

const PROV_LABEL = { google: "Continuer avec Google", discord: "Continuer avec Discord" };
async function showAuth(tab = "signin") {
  const lock = required;
  const provs = window.__gmFakeSupabase ? ["google", "discord"] : await enabledProviders();
  const up = tab === "signup", reset = tab === "reset";
  modal(`<h3>${up ? "Créer un compte" : reset ? "Mot de passe oublié" : "Se connecter"}</h3>
    <p class="muted small">Ta collection et tes boosters seront sauvegardés et disponibles sur tous tes appareils.</p>
    ${reset || !provs.length ? "" : `<div class="btn-col">${provs.map((p) => `<button class="btn" data-oauth="${p}">${PROV_LABEL[p]}</button>`).join("")}</div><p class="muted small center">ou avec ton e-mail</p>`}
    <form id="authForm" class="auth-form">
      ${up ? '<input name="username" placeholder="Pseudo" maxlength="24" required autocomplete="nickname">' : ""}
      <input name="email" type="email" placeholder="E-mail" required autocomplete="email">
      ${reset ? "" : `<input name="password" type="password" placeholder="Mot de passe (6 caractères min.)" minlength="6" required autocomplete="${up ? "new-password" : "current-password"}">`}
      <button class="btn primary" type="submit">${up ? "Créer mon compte" : reset ? "Envoyer le lien" : "Connexion"}</button>
    </form><p id="authMsg" class="auth-msg"></p>
    <div class="auth-links">${up ? '<a href="#" data-tab="signin">J\'ai déjà un compte</a>' : reset ? '<a href="#" data-tab="signin">Retour</a>' : '<a href="#" data-tab="signup">Créer un compte</a><a href="#" data-tab="reset">Mot de passe oublié ?</a>'}
    ${lock ? "" : '<a href="#" data-close>Continuer en invité</a>'}</div>`, (m) => {
    m.querySelectorAll("[data-tab]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); showAuth(a.dataset.tab); }));
    m.querySelectorAll("[data-oauth]").forEach((b) => b.addEventListener("click", () => auth.oauth(b.dataset.oauth).catch((e) => { m.querySelector("#authMsg").textContent = errText(e); })));
    const msg = m.querySelector("#authMsg");
    m.querySelector("#authForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); msg.textContent = "…";
      try {
        if (up) { const r = await auth.signUp(f.email, f.password, f.username.trim()); msg.textContent = r.needsConfirmation ? "Compte créé ! Clique sur le lien reçu par e-mail pour le confirmer." : "Compte créé ✔"; }
        else if (reset) { await auth.reset(f.email); msg.textContent = "Si un compte existe, un lien de réinitialisation vient d'être envoyé."; }
        else { await auth.signIn(f.email, f.password); if (!lock) closeModal(); }
      } catch (err) { msg.textContent = errText(err); }
    });
  }, lock);
}
function showRecovery() {
  modal(`<h3>Nouveau mot de passe</h3><form id="authForm" class="auth-form"><input name="password" type="password" placeholder="Nouveau mot de passe" minlength="6" required autocomplete="new-password"><button class="btn primary" type="submit">Enregistrer</button></form><p id="authMsg" class="auth-msg"></p>`, (m) => {
    m.querySelector("#authForm").addEventListener("submit", async (e) => { e.preventDefault(); try { await auth.setPassword(new FormData(e.target).get("password")); closeModal(); toast("Mot de passe modifié ✔"); } catch (err) { m.querySelector("#authMsg").textContent = errText(err); } });
  });
}
function renderAccount() {
  const box = $("#accountBox"); if (!configured && !session) { box.innerHTML = ""; return; }
  if (!session) { box.innerHTML = `<h3>Compte</h3><p class="muted">Tu joues en <b>invité</b> : ta progression reste sur cet appareil. Connecte-toi pour la sauvegarder et la retrouver partout.</p><button class="btn primary" id="boxLogin">Se connecter / créer un compte</button>`;
    $("#boxLogin").addEventListener("click", () => showAuth()); return; }
  const prof = S.getProfile();
  box.innerHTML = `<h3>Compte</h3><div class="acct">${prof?.avatar ? `<img src="${esc(prof.avatar)}" alt="" referrerpolicy="no-referrer">` : ""}<div><b>${esc(prof?.username || "Joueur")}</b><br><span class="muted small">${esc(session.user.email || "")} · connecté via ${providerLabel(session.user)}</span></div></div>
    <p class="muted small">Ta collection et tes boosters sont sauvegardés sur le serveur.</p>
    <form id="nameForm" class="auth-form inline"><input name="u" value="${esc(prof?.username || "")}" maxlength="24" required><button class="btn" type="submit">Changer le pseudo</button></form>
    <div class="btn-row"><button class="btn danger" id="boxLogout">Se déconnecter</button></div>`;
  $("#nameForm").addEventListener("submit", async (e) => { e.preventDefault(); const u = new FormData(e.target).get("u").trim(); if (!u) return;
    try { await api.setUsername(u, session.user.id); S.applyServerState(await api.getState()); refreshAll(); toast("Pseudo modifié ✔"); } catch (err) { toast(err.message); } });
  $("#boxLogout").addEventListener("click", () => auth.signOut().catch((err) => toast(err.message)));
}
$("#accountBtn").addEventListener("click", () => (session ? (showTab("profil")) : showAuth()));

async function onSession(sess) {
  if (!sess) { session = null; S.leaveRemote(); refreshAll(); if (required) showAuth("signin"); return; }
  try {
    const st = await api.getState(); session = sess; S.enterRemote(api, st); closeModal(); refreshAll();
    const local = S.localSnapshot(), n = Object.keys(local.collection || {}).length;
    if (n > 0 && !st.imported && !Object.keys(st.collection).length && !st.stats.opened) offerImport(local, n);
    else toast(`Connecté : ${st.profile?.username || "joueur"}`);
  } catch (e) { console.error(e); if (required) gateError(e.message); else toast("Connexion au serveur impossible : " + e.message); }
}
function offerImport(local, n) {
  modal(`<h3>Importer ta progression d'invité ?</h3><p>Tu as <b>${n} cartes différentes</b> sur cet appareil. Elles peuvent être transférées <b>une seule fois</b> sur ton compte.</p>
    <div class="btn-row center"><button class="btn primary" data-imp>Importer</button><button class="btn" data-close>Non merci</button></div>`, (m) => {
    m.querySelector("[data-imp]").addEventListener("click", async () => { try { S.applyServerState(await api.importLocal(local)); closeModal(); refreshAll(); toast("Progression importée ✔"); } catch (e) { toast(e.message.includes("ALREADY") ? "Import impossible : ce compte a déjà commencé." : e.message); closeModal(); } });
  });
}
(async function startAccounts() {
  const client = window.__gmFakeSupabase;            // hook de test : un faux client peut être injecté avant le chargement
  if (!configured && !client) return;           // sans serveur configuré : mode invité local (développement)
  required = true; gateLoading();               // compte obligatoire pour jouer
  $("#accountBtn").classList.remove("hidden");
  const sb = await initAccount({ onSession: onSession, onRecovery: showRecovery, client });
  if (!sb) gateError("Le service de connexion n'a pas pu être chargé. Vérifie ta connexion Internet.");
  if (sb && client) { const { data } = await client.auth.getSession(); onSession(data?.session ?? null); }
})();

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
