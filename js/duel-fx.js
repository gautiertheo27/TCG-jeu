// Animations de combat du duel : élan de l'attaquant, impact, K.O., PV touché. Attendues par le moteur (game.fx), jamais bloquantes.
import { sfx } from "./sound.js";
import { cardHTML, esc } from "./cardview.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) || /[?&]nofx/.test(location.search) || document.hidden;
const board = () => document.querySelector("#duelBoard");
const laneEl = (s) => board()?.querySelector(`.lane[data-uid="${s.uid}"]`);
const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };

function pop(x, y, html, cls = "") {
  const d = document.createElement("div"); d.className = "fx-pop " + cls; d.innerHTML = html; d.style.left = x + "px"; d.style.top = y + "px";
  document.body.appendChild(d); setTimeout(() => d.remove(), 1500); return d;
}
function burst(x, y, color, n = 12, dist = 70) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = dist * (0.6 + Math.random() * 0.6), d = document.createElement("i");
    d.className = "fx-spark"; d.style.cssText = `left:${x}px;top:${y}px;background:${color};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }
}
const ring = (x, y, color) => { const d = document.createElement("div"); d.className = "fx-ring"; d.style.cssText = `left:${x}px;top:${y}px;border-color:${color}`; document.body.appendChild(d); setTimeout(() => d.remove(), 650); };
const shake = (el, px = 8, ms = 380) => el?.animate?.([{ transform: "none" }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px / 2}px,0)` }, { transform: "none" }], { duration: ms, easing: "ease-in-out" });

// ---------- écrans d'ambiance : intro, pièce, bannière de tour (cliquer pour passer) ----------
function overlay(cls, html, ms) {
  return new Promise((res) => {
    const d = document.createElement("div"); d.className = "fxo " + cls; d.innerHTML = html; document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add("in"));
    let done = false; const end = () => { if (done) return; done = true; d.classList.remove("in"); d.classList.add("out"); setTimeout(() => { d.remove(); res(); }, 260); };
    d.addEventListener("click", end); setTimeout(end, ms);
  });
}
export const turnBanner = (mine, n) => (reduced() ? Promise.resolve() : overlay("fxo-banner", `<div class="fxo-band"><b>${mine ? "À toi !" : "Tour de l'adversaire"}</b><span>Tour actuel : ${n}</span></div>`, 850));
export const introScreen = (opp, me) => (reduced() ? Promise.resolve() : overlay("fxo-intro", `<div class="b1"></div><div class="b2"></div><div class="vs"><div class="av">IA</div><small>Adversaire</small><b>${esc(opp)}</b><h2>contre</h2><small>${esc(me)}</small><div class="av me">${esc(me.slice(0, 2).toUpperCase())}</div></div>`, 2000));
export const coinScreen = (mine) => (reduced() ? Promise.resolve() : overlay("fxo-coin", `<div class="pill">${mine ? "Tu as la main !" : "L'adversaire a la main."}</div><div class="piece"></div>`, 1600));

export function makeFx(getSeat) {
  return async (type, d) => {
    if (reduced() || !board() || board().classList.contains("hidden")) return;
    if (type === "play") {                                   // carte jouée : zoom + rappel de l'effet
      const k = d.card, long = k.category === "Coach" || k.category === "Moment";
      const z = document.createElement("div"); z.className = "fx-zoom"; z.innerHTML = `<div class="fx-zcard">${cardHTML(k)}</div><div class="fx-zbub"><b>${esc(k.name)}</b>${k.effect && long ? `<br>${esc(String(k.effect).slice(0, 140))}` : ""}</div>`;
      document.body.appendChild(z); sfx.tap?.(); requestAnimationFrame(() => z.classList.add("in"));
      await sleep(long ? 1000 : 620); z.classList.remove("in"); await sleep(160); z.remove(); return;
    }
    if (type === "attack") {
      const el = laneEl(d.slot); if (!el) return;
      const me = center(el), up = d.pi === getSeat();
      const opp = board().querySelector(up ? "#matOpp .terrain" : "#matMe .terrain"); const o = opp ? center(opp) : { y: me.y + (up ? -300 : 300) };
      const dy = (o.y - me.y) * 0.62;
      el.style.zIndex = 30; el.style.position = "relative";
      pop(me.x, me.y - me.h * 0.62 * (up ? 1 : -1), `⚔ ${d.atk}`, "atk");
      sfx.swing();
      const a = el.animate([{ transform: "none" }, { transform: `translateY(${-dy * 0.12}px) scale(1.04)`, offset: 0.22 }, { transform: `translateY(${dy}px) scale(1.18)`, offset: 0.55 }, { transform: `translateY(${dy}px) scale(1.18)`, offset: 0.7 }, { transform: "none" }], { duration: 720, easing: "cubic-bezier(.3,.1,.3,1)" });
      await sleep(400); d._anim = a; return;           // l'impact (hit) arrive pendant le retour
    }
    if (type === "hit") {
      const el = laneEl(d.target); if (!el) return; const c = center(el);
      sfx.hit(d.ok); burst(c.x, c.y, d.ok ? "#ff5a8c" : "#8fb4ff", d.ok ? 16 : 8); ring(c.x, c.y, d.ok ? "#ff3d83" : "#8fb4ff");
      el.classList.add("fx-hit"); shake(el, d.ok ? 11 : 6, 420);
      pop(c.x, c.y - c.h * 0.2, `<b>${d.v}</b> ⚔ ${d.d} 🛡`, d.ok ? "good" : "bad");
      pop(c.x, c.y + c.h * 0.18, d.ok ? (d.riposte ? "RIPOSTE : VAINCU !" : "VAINCU !") : "TIENT BON !", d.ok ? "big" : "small");
      await sleep(d.ok ? 780 : 640); el.classList.remove("fx-hit"); return;
    }
    if (type === "shield") {
      const el = laneEl(d.target); if (!el) return; const c = center(el); sfx.hit(false); ring(c.x, c.y, "#6fd0ff"); pop(c.x, c.y, "🛡 Shield !", "small"); await sleep(600); return;
    }
    if (type === "ko") {
      const el = laneEl(d.victim); if (!el) return; const c = center(el); sfx.ko();
      const card = el.querySelector(".card") || el; card.animate([{ opacity: 1, transform: "none", filter: "none" }, { opacity: 0, transform: "scale(.55) rotate(14deg) translateY(30px)", filter: "blur(4px) brightness(2)" }], { duration: 520, easing: "ease-in", fill: "forwards" });
      burst(c.x, c.y, "#ffd36e", 14, 90); await sleep(540); return;
    }
    if (type === "ceo") {
      const mine = d.pi === getSeat(), mat = board().querySelector(mine ? "#matMe" : "#matOpp");
      const orb = mat?.querySelectorAll(".pvz .orb")[d.left] || mat?.querySelector(".pvz"); if (!orb) return; const c = center(orb);
      sfx.ceo(); shake(board().querySelector(".playmat"), 10, 480);
      orb.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(2.2)", opacity: 1, offset: 0.35 }, { transform: "scale(.2)", opacity: 0 }], { duration: 650, fill: "forwards" });
      burst(c.x, c.y, "#ff3d83", 18, 90); ring(c.x, c.y, "#ff3d83"); pop(c.x + 40, c.y, mine ? "−1 PV !" : "PV adverse touché !", "big");
      await sleep(760); return;
    }
  };
}
