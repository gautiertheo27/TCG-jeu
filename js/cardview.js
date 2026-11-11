import { RARITIES, SET } from "./cards.js";
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function cardHTML(card, { holo = false, hidden = false } = {}) {
  const r = RARITIES[card.rarity];
  if (hidden) {
    return `<div class="card card-hidden" data-r="${card.rarity}" style="--rc:${r.color}">
      <div class="ph"><span class="ph-num">${esc(card.label)}</span><span class="ph-rar">${r.symbol} ${r.name}</span></div></div>`;
  }
  return `<div class="card${holo ? " holo" : ""}" data-r="${card.rarity}" style="--rc:${r.color}">
    <img src="${esc(card.img)}" alt="${esc(card.name)}" loading="lazy" draggable="false"></div>`;
}
export function placeholderHTML(n) {
  const label = `${String(n).padStart(3, "0")}/${SET.total}`;
  return `<div class="cell missing soon"><div class="card card-hidden"><div class="ph"><span class="ph-num">${label}</span><span class="ph-rar">À venir</span></div></div></div>`;
}

