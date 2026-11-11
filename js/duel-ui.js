// Interface du duel : plateau, main, phases, fenêtres de choix. Le moteur (engine/) applique les règles officielles.
import { BY_ID, COLORS, CARDS } from "./cards.js";
import { Game, C, spec, hasResilience } from "./engine/core.js";
import { aiAnswer, aiTurn } from "./engine/ai.js";
import { autoDeck, validateDeck, PRESETS, buildPreset } from "./engine/deck.js";
import { cardHTML } from "./cardview.js";

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALL_COLORS = ["Rose", "Orange", "Jade", "Violette", "Jaune", "Mauve", "Verte", "Bleue", "Azur"];
const AI_PAIRS = [["Rose", "Orange"], ["Violette", "Mauve"], ["Mauve", "Bleue"], ["Rose", "Mauve"], ["Orange", "Violette"], ["Verte", "Rose"], ["Azur", "Mauve"]];

export function initDuel({ S, toast, tick, esc }) {
  const setup = $("#duelSetup"), board = $("#duelBoard"), modal = $("#duelModal");
  let g = null, busy = false, turnDone = null, selecting = null, logs = [];

  // ---------- écran de préparation ----------
  for (const sel of ["#dcol1", "#dcol2"]) ALL_COLORS.forEach((c) => $(sel).insertAdjacentHTML("beforeend", `<option>${c}</option>`));
  $("#dcol1").value = "Rose"; $("#dcol2").value = "Mauve";
  $("#dsrc").innerHTML = PRESETS.map((p) => `<option value="preset:${p.id}">Prêté · ${esc(p.name)}</option>`).join("") + '<option value="collection">Mon deck (ma collection)</option>';
  $("#dsrc").addEventListener("change", updateNote);
  $("#duelStart").addEventListener("click", start);
  $("#duelAgain").addEventListener("click", showSetup);
  $("#duelPreview").addEventListener("click", previewDeck);

  function chosenDeck() {
    const v = $("#dsrc").value;
    if (v === "collection") {
      const colors = [...new Set([$("#dcol1").value, $("#dcol2").value])];
      return { deck: autoDeck(colors, S.get().collection), custom: true };
    }
    return { deck: buildPreset(v.slice(7)), custom: false };
  }
  function updateNote() {
    const v = $("#dsrc").value, coll = v === "collection";
    $("#dcolBox1").classList.toggle("hidden", !coll); $("#dcolBox2").classList.toggle("hidden", !coll);
    if (coll) $("#dsrcNote").textContent = `Ta collection : ${Object.keys(S.get().collection).length} cartes différentes. Il faut 40 cartes (3 exemplaires max chacune) et 10 Essences des couleurs choisies.`;
    else { const p = PRESETS.find((x) => "preset:" + x.id === v); $("#dsrcNote").textContent = `${p.blurb} Cartes prêtées pour la manche.`; }
  }
  function previewDeck() {
    const { deck } = chosenDeck();
    const count = {}; for (const id of [...deck.club, ...deck.reserve]) count[id] = (count[id] || 0) + 1;
    const ids = Object.keys(count).sort((a, b) => BY_ID[a].n - BY_ID[b].n);
    openModal(`<h3>${esc(deck.name || "Ton deck")} · ${deck.club.length} cartes + ${deck.reserve.length} Essences</h3>
      <div class="pick-row">${ids.map((id) => `<div class="pick">${cardHTML(BY_ID[id])}<small>×${count[id]}</small></div>`).join("")}</div>
      <div class="btn-col"><button class="btn" data-close>Fermer</button></div>`);
  }

  function showSetup() {
    setup.classList.remove("hidden"); board.classList.add("hidden"); g = null; updateNote();
  }

  async function start() {
    const { deck: mine, custom } = chosenDeck();
    if (mine.club.length < 40 || mine.reserve.length < 10) {
      toast(`Collection insuffisante : ${mine.club.length}/40 cartes, ${mine.reserve.length}/10 Essences. Ouvre des boosters ou choisis un deck prêté.`); return;
    }
    const others = PRESETS.filter((p) => p.id !== mine.preset);
    const theirs = buildPreset(others[Math.floor(Math.random() * others.length)].id);
    logs = []; $("#bdLog").innerHTML = "";
    g = new Game({
      decks: [mine, theirs], names: ["Toi", "Adversaire"], ai: [0, 1],
      ask: (game, pi, req) => (pi === 0 ? humanAsk(req) : aiAnswer(game, pi, req)),
      onUpdate: render, log: addLog,
    });
    window.__gmGame = g;
    addLog(custom ? "Tu joues avec les cartes de ta collection." : `Tu joues avec « ${mine.name} » (cartes prêtées pour la manche).`);
    setup.classList.add("hidden"); board.classList.remove("hidden"); $("#duelEnd").classList.add("hidden");
    render(g); await loop();
  }

  async function loop() {
    try {
      await g.setup(); render(g);
      while (g.winner === null) {
        await g.startTurn(); render(g); if (g.winner !== null) break;
        if (g.active === 0) { await humanTurn(); } else { await sleep(500); await aiTurn(g, 1, async () => { render(g); await sleep(650); }); }
        if (g.winner !== null) break;
        await g.endTurn(); render(g);
      }
    } catch (e) { console.error(e); toast("Erreur de jeu : " + e.message); return; }
    finish();
  }

  async function finish() {
    const won = g.winner === 0;
    const { rewarded, promo } = await S.recordDuel(won);
    $("#duelEnd").classList.remove("hidden");
    $("#duelEndMsg").innerHTML = won
      ? `🏆 Victoire !${rewarded ? " <b>+1 booster</b>" : " (récompenses du jour épuisées)"}${promo ? `<br>🎉 Carte promo obtenue : ${esc(promo.name)} (${promo.label})` : ""}`
      : "Défaite… retente ta chance !";
    tick(); render(g);
  }

  function humanTurn() {
    return new Promise((resolve) => { turnDone = resolve; render(g); });
  }

  // ---------- journal ----------
  function addLog(msg) {
    const el = document.createElement("div"); el.textContent = msg; $("#bdLog").appendChild(el);
    while ($("#bdLog").children.length > 60) $("#bdLog").firstChild.remove();
    $("#bdLog").scrollTop = 1e6;
  }

  // ---------- rendu du plateau ----------
  const orbs = (n, max = 4) => Array.from({ length: max }, (_, i) => `<i class="orb${i < n ? " on" : ""}"></i>`).join("");
  function essencesHTML(pi) {
    const P = g.P(pi);
    return P.essences.map((e) => `<span class="ess${e.engaged ? " eng" : ""}" style="--ec:${COLORS[C(e.card).color]}" title="${esc(C(e.card).name)}${e.engaged ? " (engagée)" : ""}"></span>`).join("")
      || '<span class="ess-none">aucune Essence</span>';
  }
  function slotHTML(pi, lane) {
    const s = g.P(pi).lanes[lane];
    if (!s) return `<div class="lane empty" data-pi="${pi}" data-lane="${lane}"><span>${lane + 1}</span></div>`;
    const kws = [...g.keywords(s)].map((k) => `<span class="kw">${k[0] + k.slice(1).toLowerCase()}</span>`).join("");
    const objs = s.objets.map((o) => `<span class="obj" title="${esc(C(o).name)}">🔗</span>`).join("");
    const canAtk = pi === 0 && g.canAttack(0, s) && g.attackOptions(0, s).length;
    return `<div class="lane${s.engaged ? " engaged" : ""}${canAtk ? " ready" : ""}" data-pi="${pi}" data-lane="${lane}" data-uid="${s.uid}">
      ${cardHTML(C(s))}
      <div class="lane-info"><b class="def">🛡 ${g.defense(s)}</b>${objs}${kws}${s.engaged ? '<span class="eng-badge">engagé</span>' : ""}</div></div>`;
  }
  const pileHTML = (cls, label, n, top) => `<div class="pile ${cls}" data-pile="${cls}"><span class="plabel">${label}</span>
    <div class="pcard${n ? "" : " empty"}">${top ? cardHTML(top) : '<div class="pback"><b>GM</b></div>'}<span class="pcount">${n}</span></div></div>`;
  // Une moitié de plateau, comme le tapis officiel : PV et Réserve à gauche, Terrain et Essences au centre, Club et Défausse à droite.
  function matHTML(pi) {
    const P = g.P(pi), topDiscard = P.discard.length ? C(P.discard[P.discard.length - 1]) : null;
    return `<div class="zone pvz"><span class="zlabel">Points de Victoire</span><div class="orbs">${orbs(P.pv.length)}</div></div>
      <div class="zone terrain"><span class="ztab">Terrain</span><div class="bd-lanes">${[0, 1, 2].map((l) => slotHTML(pi, l)).join("")}</div></div>
      <div class="zone right1">${pileHTML("club", "Club", P.club.length, null)}</div>
      <div class="zone reservez">${pileHTML("reserve", "Réserve", P.reserve.length, null)}</div>
      <div class="zone essz"><span class="ztab">Essences</span><div class="bd-ess">${essencesHTML(pi)}</div></div>
      <div class="zone right2" data-pi="${pi}">${pileHTML("discard", "Défausse", P.discard.length, topDiscard)}</div>`;
  }
  const STEPS = [["entretien", "Entretien"], ["action", "Action"], ["combat", "Combat"], ["fin", "Fin"]];
  function render() {
    if (!g) return;
    const me = g.P(0), op = g.P(1), myTurn = g.active === 0 && g.winner === null;
    $("#bdOpp").innerHTML = `<b>${esc(op.name)}</b><span class="hand-backs">${Array.from({ length: op.hand.length }, () => "<i></i>").join("")}</span><span>✋ ${op.hand.length}</span>`;
    $("#bdMe").innerHTML = `<b>Toi</b><span>✋ ${me.hand.length}/5</span><span>❤ PV ${me.pv.length}</span>`;
    $("#matOpp").innerHTML = matHTML(1); $("#matMe").innerHTML = matHTML(0);
    $("#bdHand").innerHTML = me.hand.map((c, i) => {
      const ok = myTurn && !busy && g.phase === "action" && g.canPlay(0, c);
      return `<div class="hcard${ok ? " playable" : ""}" data-i="${i}">${cardHTML(C(c))}</div>`;
    }).join("");
    const phaseName = g.winner !== null ? "Partie terminée" : { entretien: "Entretien", action: "Phase d'action", combat: "Phase de combat", fin: "Fin de tour", setup: "Mise en place" }[g.phase] || "";
    $("#bdPhase").textContent = `Tour ${g.turn} · ${myTurn ? "À toi" : "Adversaire"} · ${phaseName}`;
    $("#bdPhase").classList.toggle("mine", myTurn);
    $("#bdSteps").innerHTML = STEPS.map(([k, l]) => `<i class="${g.phase === k && g.winner === null ? "on" : ""}">${l}</i>`).join("");
    const showCombat = myTurn && g.phase === "action" && g.turn > 1;
    $("#btnCombat").classList.toggle("hidden", !showCombat);
    $("#btnEnd").classList.toggle("hidden", !(myTurn && (g.phase === "action" || g.phase === "combat")));
    $("#btnEnd").textContent = g.phase === "combat" ? "Fin de tour ▶" : "Passer le tour ▶";
    $("#btnCombat").disabled = busy; $("#btnEnd").disabled = busy;
  }

  // Défausse : toucher la pile pour voir les cartes (elles sont publiques)
  board.addEventListener("click", (e) => {
    const pile = e.target.closest('.pile[data-pile="discard"]'); if (!pile) return;
    const pi = +pile.closest("[data-pi]").dataset.pi, cs = g.P(pi).discard;
    openModal(`<h3>Défausse ${pi === 0 ? "(toi)" : "(adversaire)"} · ${cs.length} carte${cs.length > 1 ? "s" : ""}</h3>${cs.length ? `<div class="pick-row">${[...cs].reverse().map((c) => `<div class="pick">${cardHTML(C(c))}</div>`).join("")}</div>` : '<p class="muted">Vide.</p>'}<div class="btn-col"><button class="btn" data-close>Fermer</button></div>`);
  });

  // ---------- actions du joueur ----------
  $("#btnCombat").addEventListener("click", () => { if (g.phase === "action" && !busy) { g.phase = "combat"; render(); } });
  $("#btnEnd").addEventListener("click", () => { if (turnDone && !busy) { const r = turnDone; turnDone = null; r(); } });

  async function run(fn) { if (busy) return; busy = true; render(); try { await fn(); } finally { busy = false; render(); } }

  $("#bdHand").addEventListener("click", (e) => {
    const el = e.target.closest(".hcard"); if (!el) return;
    const c = g.P(0).hand[+el.dataset.i]; if (!c) return;
    const myTurn = g.active === 0 && g.phase === "action" && g.winner === null;
    const card = C(c);
    const buttons = [];
    if (myTurn && g.canPlay(0, c)) {
      if (card.category === "Joueur" && g.freeLanes(0).length) g.freeLanes(0).forEach((l) => buttons.push({ label: `Jouer en case ${l + 1}`, primary: true, fn: () => run(() => g.playFromHand(0, c, { lane: l })) }));
      else buttons.push({ label: card.category === "Joueur" ? "Jouer (bench un Joueur non engagé)" : "Jouer", primary: true, fn: () => run(() => g.playFromHand(0, c)) });
    } else if (myTurn) buttons.push({ label: playHint(c), disabled: true });
    sheet(c, buttons);
  });
  function playHint(c) {
    const k = C(c);
    if (k.category === "Coach" && g.P(0).coachPlayed) return "Une seule carte Coach par tour";
    if (k.category !== "Joueur" && k.color !== "Neutre" && !g.hasEssenceColor(0, k.color)) return `Il faut une Essence ${k.color} déployée`;
    if (k.category === "Objet" && !g.slots(0).length) return "Aucun Joueur à qui lier l'Objet";
    return "Injouable pour l'instant";
  }

  board.addEventListener("click", (e) => {
    const lane = e.target.closest(".lane[data-uid]"); if (!lane || e.target.closest("#bdHand")) return;
    const pi = +lane.dataset.pi, s = g.P(pi).lanes[+lane.dataset.lane]; if (!s) return;
    const buttons = [];
    if (pi === 0 && g.active === 0 && !busy) {
      if (g.phase === "combat" && g.canAttack(0, s)) {
        const opts = g.attackOptions(0, s);
        if (!opts.length) buttons.push({ label: "Pas assez d'Essences pour attaquer", disabled: true });
        for (const i of opts) buttons.push({ label: `⚔ ${C(s).attacks[i].name} — ${g.attackValue(s, i)}${costStr(g.attackCost(0, s, i))}`, primary: true, fn: () => run(() => g.attack(0, s, i)) });
      } else if (g.phase === "combat") buttons.push({ label: s.engaged ? "Joueur engagé : ne peut pas attaquer" : "Ne peut pas attaquer ce tour", disabled: true });
      if (g.activables(0).includes(s)) buttons.push({ label: "Activer : engager pour bench un Joueur adverse", fn: () => run(() => g.activate(0, s)) });
    }
    sheet({ id: s.id, uid: s.uid }, buttons, s);
  });
  const costStr = (cost) => (cost.length ? ` (${cost.map((c) => (c === "Neutre" ? "◇" : c[0])).join("")})` : "");

  // ---------- fiches et fenêtres ----------
  function sheet(c, buttons = [], slot = null) {
    const k = C(c);
    const info = [];
    if (slot) {
      info.push(`🛡 Défense ${g.defense(slot)}${slot.engaged ? " · engagé" : ""}`);
      for (const [i, a] of k.attacks.entries()) info.push(`⚔ ${esc(a.name)} : ${g.attackValue(slot, i)}${costStr(a.cost || [])}`);
      if (slot.objets.length) info.push("🔗 Objets : " + slot.objets.map((o) => esc(C(o).name)).join(", "));
      const kw = [...g.keywords(slot)]; if (kw.length) info.push("Mots-clés : " + kw.join(", "));
    }
    openModal(`<div class="sheet"><div class="sheet-card">${cardHTML(k)}</div>
      <div class="sheet-side"><h3>${esc(k.name)}</h3><p class="muted small">${esc(k.category)}${k.subtype ? " · " + esc(k.subtype) : ""} · ${esc(k.color || "")}</p>
      ${info.map((x) => `<p>${x}</p>`).join("")}
      <div class="btn-col">${buttons.map((b, i) => `<button class="btn${b.primary ? " primary" : ""}" data-b="${i}" ${b.disabled ? "disabled" : ""}>${esc(b.label)}</button>`).join("")}
      <button class="btn" data-close>Fermer</button></div></div></div>`, (el) => {
      el.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", () => { closeModal(); buttons[+b.dataset.b].fn?.(); }));
    });
  }
  let modalResolve = null;
  function openModal(html, wire) {
    modal.innerHTML = `<div class="modal-box">${html}</div>`; modal.classList.remove("hidden");
    modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { closeModal(); modalResolve?.(null); }));
    wire?.(modal);
  }
  function closeModal() { modal.classList.add("hidden"); modal.innerHTML = ""; }
  modal.addEventListener("click", (e) => { if (e.target === modal && !modalResolve) closeModal(); });

  // Réponses humaines aux demandes du moteur
  function humanAsk(req) {
    return new Promise((resolve) => {
      const done = (v) => { modalResolve = null; closeModal(); resolve(v); };
      modalResolve = null;
      const title = `<h3>${esc(req.title || "")}</h3>`;
      const cardsRow = (cs) => `<div class="pick-row">${cs.map((c) => `<div class="pick" >${cardHTML(C(c))}</div>`).join("")}</div>`;
      if (req.kind === "info") {
        openModal(`${title}${cardsRow(req.cards || [])}<div class="btn-col"><button class="btn primary" data-ok>OK</button></div>`, (el) => el.querySelector("[data-ok]").addEventListener("click", () => done(null)));
      } else if (req.kind === "confirm") {
        openModal(`${title}${req.cards ? cardsRow(req.cards) : ""}<div class="btn-row center"><button class="btn primary" data-y>Oui</button><button class="btn" data-n>Non</button></div>`, (el) => {
          el.querySelector("[data-y]").addEventListener("click", () => done(true)); el.querySelector("[data-n]").addEventListener("click", () => done(false)); });
      } else if (req.kind === "choice") {
        openModal(`${title}<div class="btn-col">${req.options.map((o, i) => `<button class="btn" data-o="${i}">${esc(o.label)}</button>`).join("")}${req.allowNone ? '<button class="btn" data-none>Ne rien faire</button>' : ""}</div>`, (el) => {
          el.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => done(req.options[+b.dataset.o].value)));
          el.querySelector("[data-none]")?.addEventListener("click", () => done(null)); });
      } else {
        // card | slot : choisir parmi des cartes
        const items = req.kind === "card" ? req.cards : req.slots;
        if (!items.length) return resolve(null);
        const top = req.reveal && req.reveal.length ? `<p class="muted small">Cartes révélées :</p>${cardsRow(req.reveal)}` : "";
        const hint = req.kind === "slot" && req.attackValue ? `<p class="muted small">Valeur d'attaque : ${req.attackValue}</p>` : "";
        openModal(`${title}${hint}${top}<div class="pick-row">${items.map((it, i) => `<div class="pick sel" data-p="${i}">${cardHTML(C(it))}${req.kind === "slot" ? `<small>🛡 ${g.defense(it)}${it.engaged ? " · engagé" : ""}</small>` : ""}</div>`).join("")}</div>
          ${req.allowNone ? '<div class="btn-col"><button class="btn" data-none>Aucun</button></div>' : ""}`, (el) => {
          el.querySelectorAll("[data-p]").forEach((p) => p.addEventListener("click", () => done(items[+p.dataset.p])));
          el.querySelector("[data-none]")?.addEventListener("click", () => done(null)); });
      }
    });
  }

  updateNote();
  return { showSetup };
}
