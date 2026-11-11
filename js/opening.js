// Ouverture de booster en plein écran, façon Pokémon Pocket :
// 1) on découpe le haut du paquet en glissant le doigt, 2) les cartes arrivent empilées face cachée,
// 3) on les retourne et on les écarte une à une (dans l'ordre réel du paquet), 4) récap de toutes les cartes.
import { BY_ID, RARITIES, rarityOf } from "./cards.js";
import { cardHTML, esc } from "./cardview.js";
import { sfx, unlock } from "./sound.js";

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RARE = new Set(["R", "E", "L", "S", "P"]);        // fond lumineux sur le dos avant de retourner
const BIG = new Set(["E", "L", "S", "P"]);              // explosion d'étincelles au retournement

export function isOpening() { return !$("#opening").classList.contains("hidden"); }

// pulls : [{ id, holo, isNew }], packSrc : image du paquet, opts.quick : saute l'animation (récap seulement)
export async function playOpening({ pulls, packSrc, quick = false, canAgain = false }) {
  unlock();
  const root = $("#opening");
  root.classList.remove("hidden"); document.body.classList.add("no-scroll");
  root.innerHTML = `
    <div class="op-bg"></div><div class="op-flash"></div>
    <div class="op-stage">
      <div class="op-pack" aria-label="Paquet à ouvrir">
        <img class="op-part op-bottom" src="${esc(packSrc)}" alt="" draggable="false">
        <img class="op-part op-top" src="${esc(packSrc)}" alt="" draggable="false">
        <div class="op-cut"><span></span></div>
      </div>
      <div class="op-stack hidden"></div>
    </div>
    <div class="op-hint">Glisse sur le haut du paquet pour l'ouvrir ➜</div>
    <div class="op-count hidden"></div>
    <button class="op-skip btn" type="button">Tout révéler ⏭</button>
    <div class="op-summary hidden"></div>`;
  const q = (s) => $(s, root);
  let finish; const done = new Promise((r) => (finish = r));
  let again = false;

  const hint = (t) => (q(".op-hint").textContent = t);
  const flash = (strong) => { const f = q(".op-flash"); f.classList.remove("on", "strong"); void f.offsetWidth; f.classList.add("on"); if (strong) f.classList.add("strong"); };

  // ---------- étape 3 : récapitulatif ----------
  function summary() {
    q(".op-stage").classList.add("hidden"); q(".op-hint").classList.add("hidden"); q(".op-count").classList.add("hidden"); q(".op-skip").classList.add("hidden");
    const nNew = pulls.filter((p) => p.isNew).length;
    const best = pulls.reduce((b, p) => (RARITIES[BY_ID[p.id].rarity].order > RARITIES[BY_ID[b.id].rarity].order ? p : b), pulls[0]);
    sfx.fanfare(BY_ID[best.id].rarity);
    const el = q(".op-summary"); el.classList.remove("hidden");
    el.innerHTML = `<h2>${pulls.length > 10 ? `${pulls.length / 10} boosters ouverts` : "Booster ouvert !"}</h2>
      <p class="muted">${nNew ? `<b>${nNew}</b> nouvelle${nNew > 1 ? "s" : ""} carte${nNew > 1 ? "s" : ""} · ` : ""}Plus belle carte : ${esc(BY_ID[best.id].name)} (${rarityOf(BY_ID[best.id]).name})</p>
      <div class="op-grid">${pulls.map((p, i) => {
        const c = BY_ID[p.id];
        return `<div class="op-mini" style="animation-delay:${Math.min(i, 30) * 45}ms">${p.isNew ? '<span class="badge-new">NOUVEAU</span>' : ""}${p.holo ? '<span class="badge-holo">HOLO</span>' : ""}${cardHTML(c, { holo: p.holo })}</div>`;
      }).join("")}</div>
      <div class="btn-row center">${canAgain ? '<button class="btn primary" data-again>Ouvrir un autre booster</button>' : ""}<button class="btn ${canAgain ? "" : "primary"}" data-close>Continuer</button></div>`;
    el.querySelector("[data-close]").addEventListener("click", close);
    el.querySelector("[data-again]")?.addEventListener("click", () => { again = true; close(); });
    el.querySelectorAll(".op-mini").forEach((m, i) => m.addEventListener("click", () => zoom(pulls[i])));
  }
  function zoom(p) {
    const c = BY_ID[p.id], z = document.createElement("div"); z.className = "op-zoom";
    z.innerHTML = `<div class="zcard">${cardHTML(c, { holo: p.holo })}</div>`; root.appendChild(z);
    const card = z.querySelector(".card"), zc = z.querySelector(".zcard");
    z.addEventListener("pointermove", (e) => { const r = zc.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      zc.style.transform = `rotateY(${(x - 0.5) * 22}deg) rotateX(${(0.5 - y) * 22}deg)`; card.style.setProperty("--px", `${x * 100}%`); card.style.setProperty("--py", `${y * 100}%`); });
    z.addEventListener("click", () => z.remove());
  }
  function close() {
    root.classList.add("hidden"); root.innerHTML = ""; document.body.classList.remove("no-scroll"); finish({ again });
  }

  if (quick) { summary(); return done; }

  // ---------- étape 1 : découper le paquet ----------
  const pack = q(".op-pack"), top = q(".op-top"), cut = q(".op-cut");
  let torn = false;
  const tear = async (fromDrag = 0) => {
    if (torn) return; torn = true;
    sfx.tear();
    top.style.transition = "transform .55s cubic-bezier(.3,.7,.3,1), opacity .55s"; top.style.transform = "translate(130%, -90px) rotate(28deg)"; top.style.opacity = "0";
    cut.classList.add("hidden"); hint("");
    flash(false); await sleep(260);
    q(".op-bottom").classList.add("drop"); try { navigator.vibrate?.(20); } catch (_) {}
    await sleep(380);
    q(".op-pack").classList.add("gone");
    dealStack();
  };
  // geste : glisser horizontalement sur le tiers supérieur du paquet
  let drag = null;
  pack.addEventListener("pointerdown", (e) => {
    if (torn) return; const r = pack.getBoundingClientRect();
    drag = { x: e.clientX, w: r.width, onTop: e.clientY - r.top < r.height * 0.42 };
    pack.setPointerCapture(e.pointerId);
  });
  pack.addEventListener("pointermove", (e) => {
    if (!drag || torn) return; const dx = Math.max(0, e.clientX - drag.x);
    if (drag.onTop) { top.style.transition = "none"; top.style.transform = `translate(${dx * 0.9}px, ${-dx * 0.12}px) rotate(${dx * 0.05}deg)`; }
    if (dx > drag.w * 0.55 && drag.onTop) { drag = null; tear(); }
  });
  pack.addEventListener("pointerup", () => { if (drag && !torn) { top.style.transition = "transform .25s"; top.style.transform = ""; } drag = null; });
  pack.addEventListener("click", (e) => { if (e.detail && !torn && drag === null && e.pointerType !== "touch") { /* un simple clic ouvre aussi */ tear(); } });
  pack.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") tear(); });
  pack.tabIndex = 0;
  q(".op-skip").addEventListener("click", () => summary());

  // ---------- étape 2 : les cartes empilées ----------
  let idx = 0; const total = pulls.length; let cards = [];
  function dealStack() {
    const stack = q(".op-stack"); stack.classList.remove("hidden");
    q(".op-count").classList.remove("hidden");
    cards = pulls.map((p, i) => {
      const c = BY_ID[p.id], r = RARITIES[c.rarity];
      const el = document.createElement("div"); el.className = "op-card" + (RARE.has(c.rarity) ? " rare" : "");
      el.style.setProperty("--glow", r.color); el.dataset.r = c.rarity;
      const off = (total - 1 - i);
      el.innerHTML = `<div class="op-inner"><div class="op-face op-back"><span>GM</span></div>
        <div class="op-face op-front">${p.isNew ? '<span class="badge-new">NOUVEAU</span>' : ""}${p.holo ? '<span class="badge-holo">HOLO</span>' : ""}${cardHTML(c, { holo: p.holo })}</div></div>`;
      el.style.zIndex = String(total - i);
      el.style.setProperty("--ox", `${Math.min(off, 8) * 1.2}px`); el.style.setProperty("--oy", `${Math.min(off, 8) * -1.6}px`); el.style.setProperty("--rot", `${((i * 37) % 7) - 3}deg`);
      el.style.animationDelay = `${(total - 1 - i) * 55}ms`;
      stack.appendChild(el); return el;
    });
    pulls.forEach((_, i) => sfx.deal(i));
    hint("Touche la carte pour la retourner");
    updateCount(); arm();
  }
  const updateCount = () => (q(".op-count").textContent = `${Math.min(idx + 1, total)} / ${total}`);

  // interaction sur la carte du dessus : toucher ou glisser
  function arm() {
    const el = cards[idx]; if (!el) return;
    let flipped = false, g = null, busy = false;
    el.classList.add("top");
    const flip = async () => {
      if (flipped || busy) return; busy = true; flipped = true;
      const c = BY_ID[pulls[idx].id];
      el.classList.add("flipped"); sfx.flip(c.rarity); try { navigator.vibrate?.(RARE.has(c.rarity) ? [20, 40, 30] : 10); } catch (_) {}
      await sleep(330);
      if (BIG.has(c.rarity)) { burst(el, RARITIES[c.rarity].color); flash(c.rarity !== "R"); root.classList.add("shake"); setTimeout(() => root.classList.remove("shake"), 450); }
      hint(idx === total - 1 ? "Touche pour voir le récapitulatif" : "Touche ou glisse pour passer à la suivante");
      busy = false;
    };
    const dismiss = async (dir) => {
      if (busy) return; busy = true;
      sfx.dismiss(); el.style.transition = "transform .45s ease-in, opacity .45s"; el.style.transform = `translate(${dir * 130}vw, -40px) rotate(${dir * 24}deg)`; el.style.opacity = "0";
      await sleep(380); el.remove(); idx++;
      if (idx >= total) { summary(); return; }
      updateCount(); hint("Touche la carte pour la retourner"); arm();
    };
    const onDown = (e) => { g = { x: e.clientX, y: e.clientY, moved: 0 }; el.setPointerCapture(e.pointerId); el.style.transition = "none"; };
    const onMove = (e) => {
      if (!g) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; g.moved = Math.max(g.moved, Math.hypot(dx, dy));
      if (flipped) el.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx * 0.04}deg)`;
      else { const r = el.getBoundingClientRect(); el.style.setProperty("--tx", `${dx * 0.08}deg`); }
      if (flipped && !busy) { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; const card = el.querySelector(".card"); card?.style.setProperty("--px", `${x * 100}%`); card?.style.setProperty("--py", `${y * 100}%`); }
    };
    const onUp = (e) => {
      if (!g) return; const dx = e.clientX - g.x, moved = g.moved; g = null;
      if (!flipped) { el.style.transition = ""; el.style.transform = ""; if (moved > 6 || true) flip(); return; }
      if (Math.abs(dx) > 70) dismiss(Math.sign(dx)); else if (moved < 8) dismiss(1); else { el.style.transition = "transform .25s"; el.style.transform = ""; }
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp); el.addEventListener("pointercancel", () => { g = null; el.style.transition = "transform .25s"; el.style.transform = ""; });
    el.tabIndex = 0; el.focus?.({ preventScroll: true });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipped ? dismiss(1) : flip(); } });
    // « Tout révéler » doit aussi marcher en cours de route
  }

  function burst(el, color) {
    const r = el.getBoundingClientRect(), box = root.getBoundingClientRect(), cx = r.left - box.left + r.width / 2, cy = r.top - box.top + r.height / 2;
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("i"); s.className = "op-spark"; const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4, d = 90 + Math.random() * 150;
      s.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;background:${i % 3 ? color : "#fff"};animation-delay:${Math.random() * 80}ms`;
      root.appendChild(s); setTimeout(() => s.remove(), 1100);
    }
  }
  return done;
}
