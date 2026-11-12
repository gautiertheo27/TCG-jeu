// Vue des decks : choix visuel (tuiles) et aperçu détaillé (par catégorie, courbe de coût, zoom).
import { BY_ID, COLORS } from "./cards.js";
import { cardHTML, esc } from "./cardview.js";

const CATS = [["Joueur", "Joueurs"], ["Objet", "Objets"], ["Coach", "Coachs"], ["Moment", "Moments"], ["Support", "Supports"]];
const cheap = (c) => (c.attacks?.length ? Math.min(...c.attacks.map((a) => (a.cost || []).length)) : 0);

export function deckStats(deck) {
  const cards = deck.club.map((id) => BY_ID[id]).filter(Boolean);
  const by = {}; for (const c of cards) (by[c.category] = by[c.category] || []).push(c);
  const joueurs = by.Joueur || [], curve = [0, 0, 0, 0, 0];
  for (const j of joueurs) curve[Math.min(cheap(j), 4)]++;
  const avgDef = joueurs.length ? Math.round(joueurs.reduce((s, c) => s + (c.def || 0), 0) / joueurs.length) : 0;
  const avgAtk = joueurs.length ? Math.round(joueurs.reduce((s, c) => s + (Math.max(0, ...(c.attacks || []).map((a) => +a.damage || 0))), 0) / joueurs.length) : 0;
  return { total: cards.length, by, curve, avgDef, avgAtk, reserve: deck.reserve.length };
}
const colorDots = (cols) => (cols || []).map((c) => `<i class="dv-dot" style="background:${COLORS[c] || "#999"}" title="${esc(c)}"></i>`).join("");
const chips = (st) => CATS.filter(([k]) => st.by[k]?.length).map(([k, l]) => `<span class="dv-chip">${st.by[k].length} ${l}</span>`).join("");
function curveHTML(st) {
  const max = Math.max(1, ...st.curve);
  return `<div class="dv-curve" title="Coût de l'attaque la moins chère de chaque Joueur">${st.curve.map((n, i) => `<div><b>${n}</b><span style="height:${Math.round((n / max) * 44) + 2}px"></span><small>${i === 4 ? "4+" : i}</small></div>`).join("")}</div>`;
}

// Aperçu complet d'un deck
export function deckViewHTML(deck) {
  const st = deckStats(deck), count = {};
  for (const id of deck.club) count[id] = (count[id] || 0) + 1;
  const section = ([k, l]) => {
    const ids = Object.keys(count).filter((id) => BY_ID[id]?.category === k).sort((a, b) => cheap(BY_ID[a]) - cheap(BY_ID[b]) || BY_ID[a].n - BY_ID[b].n);
    if (!ids.length) return "";
    return `<h4 class="dv-h">${l} <small>${ids.reduce((s, id) => s + count[id], 0)}</small></h4>
      <div class="dv-grid">${ids.map((id) => `<div class="dv-card" data-zoom="${id}">${cardHTML(BY_ID[id])}<span class="dv-x">×${count[id]}</span></div>`).join("")}</div>`;
  };
  const res = {}; for (const id of deck.reserve) { const c = BY_ID[id]; if (c) res[c.color] = (res[c.color] || 0) + 1; }
  return `<div class="dv">
    <div class="dv-top"><div><b class="dv-name">${esc(deck.name || "Ton deck")}</b><div class="dv-sub">${st.total} cartes + ${st.reserve} Essences ${colorDots(deck.colors)}</div></div>${curveHTML(st)}</div>
    <div class="dv-chips">${chips(st)}${st.by.Joueur ? `<span class="dv-chip alt">🛡 Déf. moy. ${st.avgDef}</span><span class="dv-chip alt">⚔ Att. moy. ${st.avgAtk}</span>` : ""}</div>
    ${CATS.map(section).join("")}
    <h4 class="dv-h">Réserve d'Essences <small>${st.reserve}</small></h4>
    <div class="dv-chips">${Object.entries(res).map(([c, n]) => `<span class="dv-chip" style="border-color:${COLORS[c]}"><i class="dv-dot" style="background:${COLORS[c]}"></i>Essence ${esc(c)} ×${n}</span>`).join("")}</div>
  </div>`;
}

// Tuiles de choix de deck. options : [{ value, label, blurb }], getDeck(value) -> deck (ou null)
export function deckPickerHTML(id, options, getDeck, selected) {
  const sel = options.some((o) => o.value === selected) ? selected : options[0].value;
  const tiles = options.map((o) => {
    let deck = null; try { deck = getDeck(o.value); } catch (_) {}
    const st = deck && deck.club ? deckStats(deck) : null, short = deck && st && (st.total < 40 || deck.reserve.length < 10);
    const thumbs = st ? (st.by.Joueur || []).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i).slice(0, 4).map((c) => `<span class="dv-thumb">${cardHTML(c)}</span>`).join("") : "";
    return `<div class="dtile${o.value === sel ? " on" : ""}" data-v="${esc(o.value)}" role="radio" aria-checked="${o.value === sel}">
      <div class="dtile-top"><b>${esc(o.label)}</b>${deck ? colorDots(deck.colors) : ""}</div>
      <p class="dtile-blurb">${esc(o.blurb || "")}</p>
      ${st ? `<div class="dv-chips">${chips(st)}</div>` : ""}
      ${short ? `<p class="dtile-warn">⚠ Pas assez de cartes (${st.total}/40 cartes, ${deck.reserve.length}/10 Essences)</p>` : ""}
      <div class="dtile-thumbs">${thumbs}</div>
      <button type="button" class="btn small dtile-see">👁 Voir le deck</button><div class="dtile-view hidden"></div></div>`;
  }).join("");
  return `<div class="deckpick"><input type="hidden" id="${id}" value="${esc(sel)}">${tiles}</div>`;
}
let zoomEl = null;
export function wireDeckPicker(root, getDeck, onSelect) {
  root.querySelectorAll(".deckpick").forEach((pick) => {
    const input = pick.querySelector('input[type="hidden"]');
    pick.addEventListener("click", (e) => {
      const zoom = e.target.closest("[data-zoom]"); if (zoom) { showZoom(zoom.dataset.zoom); return; }
      const tile = e.target.closest(".dtile"); if (!tile) return;
      if (e.target.closest(".dtile-see")) {
        const box = tile.querySelector(".dtile-view");
        const opening = box.classList.toggle("hidden") === false; tile.classList.toggle("open", opening);
        if (opening) { try { box.innerHTML = deckViewHTML(getDeck(tile.dataset.v)); } catch (_) { box.textContent = "Deck indisponible."; } }
        e.target.closest(".dtile-see").textContent = box.classList.contains("hidden") ? "👁 Voir le deck" : "▲ Masquer";
      }
      if (input.value !== tile.dataset.v) {
        input.value = tile.dataset.v; pick.querySelectorAll(".dtile").forEach((t) => { const on = t === tile; t.classList.toggle("on", on); t.setAttribute("aria-checked", on); });
        input.dispatchEvent(new Event("change", { bubbles: true })); onSelect?.(input.value);
      }
    });
  });
}
export function showZoom(id) {
  const c = BY_ID[id]; if (!c) return;
  zoomEl?.remove(); zoomEl = document.createElement("div"); zoomEl.className = "dv-zoom";
  zoomEl.innerHTML = `<div class="dv-zoomcard">${cardHTML(c)}</div><p>${esc(c.name)}</p>`;
  zoomEl.addEventListener("click", () => { zoomEl.remove(); zoomEl = null; }); document.body.appendChild(zoomEl);
}
