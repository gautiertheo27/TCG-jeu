// Interface du duel : plateau, main, phases, fenêtres de choix. Le moteur (engine/) applique les règles officielles.
import { BY_ID, COLORS, CARDS } from "./cards.js";
import { Game, C, spec, hasResilience } from "./engine/core.js";
import { aiAnswer, aiTurn } from "./engine/ai.js";
import { autoDeck, validateDeck, PRESETS, buildPreset } from "./engine/deck.js";
import { cardHTML } from "./cardview.js";
import { Sync } from "./pvp.js";
import { makeFx } from "./duel-fx.js";
import { deckViewHTML, deckPickerHTML, wireDeckPicker } from "./deckview.js";
import { TUTO_PAGES, tutoHint } from "./tuto.js";
import { TIPS, KEYWORD_INFO, PHASE_INFO, CATEGORY_INFO, tipsFor, comboFor } from "./glossary.js";

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALL_COLORS = ["Rose", "Orange", "Jade", "Violette", "Jaune", "Mauve", "Verte", "Bleue", "Azur"];
const AI_PAIRS = [["Rose", "Orange"], ["Violette", "Mauve"], ["Mauve", "Bleue"], ["Rose", "Mauve"], ["Orange", "Violette"], ["Verte", "Rose"], ["Azur", "Mauve"]];

export function initDuel({ S, toast, tick, esc }) {
  const setup = $("#duelSetup"), board = $("#duelBoard"), modal = $("#duelModal");
  let g = null, busy = false, turnDone = null, selecting = null, logs = [];
  let tuto = false;
  let SEAT = 0, OPP = 1, sync = null, onlineEnd = null, oppLeftTimer = null;     // siège du joueur : 0 contre l'IA, 0 ou 1 en ligne

  // ---------- écran de préparation ----------
  for (const sel of ["#dcol1", "#dcol2"]) ALL_COLORS.forEach((c) => $(sel).insertAdjacentHTML("beforeend", `<option>${c}</option>`));
  $("#dcol1").value = "Rose"; $("#dcol2").value = "Mauve";
  // choix du deck : tuiles visuelles (le champ caché #dsrc garde la valeur, comme l'ancien menu)
  function renderDeckPicker() {
    const cur = $("#dsrc")?.value || "preset:" + PRESETS[0].id;
    $("#dsrcBox").innerHTML = deckPickerHTML("dsrc", deckOptions(), deckFor, cur);
    wireDeckPicker($("#dsrcBox"), deckFor, () => updateNote());
    $("#dsrc").addEventListener("change", updateNote); updateNote();
  }
  $("#duelStart").addEventListener("click", () => { tuto = false; start(); });
  $("#duelTuto").addEventListener("click", openTuto);
  $("#tutoQuit").addEventListener("click", () => { tuto = false; $("#tutoBar").classList.add("hidden"); dropAsk(); showSetup(); });
  $("#duelAgain").addEventListener("click", showSetup);
  $("#duelPreview").addEventListener("click", previewDeck);
  $("#dcol1").addEventListener("change", renderDeckPicker); $("#dcol2").addEventListener("change", renderDeckPicker);

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
    openModal(`${deckViewHTML(deck)}<div class="btn-col"><button class="btn" data-close>Fermer</button></div>`);
    wireDeckPicker(modal, () => deck);
  }

  // ---------- hub Combat > Solo (niveaux) ----------
  const hub = $("#duelHub"), LEVELS = ["easy", "normal", "hard"];
  let level = "normal";
  const winsKey = (l) => "gm_wins_" + l;
  const getWins = (l) => { try { return +localStorage.getItem(winsKey(l)) || 0; } catch { return 0; } };
  const addWin = (l) => { try { localStorage.setItem(winsKey(l), getWins(l) + 1); } catch { /* sans stockage */ } };
  function paintWins() { document.querySelectorAll("#diffList [data-level]").forEach((b) => { const w = getWins(b.dataset.level); const el = b.querySelector("[data-wins]"); if (el) el.textContent = w; }); }
  function showHub() {                                   // page d'accueil de l'onglet Combat (sans toucher à une partie en cours)
    if (g && g.winner === null && !board.classList.contains("hidden")) return;
    dropAsk(); g = null; board.classList.add("hidden"); setup.classList.add("hidden"); hub.classList.remove("hidden");
  }
  function showSetup(toDecks) {                          // écran Solo : niveaux + deck
    dropAsk(); renderDeckPicker(); paintWins();
    hub.classList.add("hidden"); setup.classList.remove("hidden"); board.classList.add("hidden"); g = null; updateNote();
    if (toDecks === true) $("#deckTitle").scrollIntoView({ behavior: "smooth" }); else window.scrollTo({ top: 0 });
  }
  $("#htSolo").addEventListener("click", () => showSetup());
  $("#htDecks").addEventListener("click", () => showSetup(true));
  $("#htTuto").addEventListener("click", () => openTuto());
  $("#soloBack").addEventListener("click", showHub);
  document.querySelectorAll("#diffList [data-level]").forEach((b) => b.addEventListener("click", () => { level = b.dataset.level; tuto = false; start(); }));

  async function start() {
    dropAsk();
    const { deck: mine, custom } = tuto ? { deck: buildPreset(PRESETS[0].id), custom: false } : chosenDeck();
    if (mine.club.length < 40 || mine.reserve.length < 10) {
      toast(`Collection insuffisante : ${mine.club.length}/40 cartes, ${mine.reserve.length}/10 Essences. Ouvre des boosters ou choisis un deck prêté.`); return;
    }
    const others = tuto ? PRESETS.filter((p) => p.id !== PRESETS[0].id) : PRESETS.filter((p) => p.id !== mine.preset);
    const theirs = buildPreset(others[Math.floor(Math.random() * others.length)].id);
    logs = []; $("#bdLog").innerHTML = ""; SEAT = 0; OPP = 1; sync = null; $("#btnForfeit").classList.add("hidden");
    g = new Game({
      decks: [mine, theirs], names: ["Toi", "Adversaire"], ai: [0, 1],
      ask: (game, pi, req) => (pi === 0 ? humanAsk(req) : aiAnswer(game, pi, req)),
      onUpdate: render, log: addLog, fx: makeFx(() => SEAT),
    });
    g.aiLevel = tuto ? "easy" : level;
    window.__gmGame = g;
    addLog(custom ? "Tu joues avec les cartes de ta collection." : `Tu joues avec « ${mine.name} » (cartes prêtées pour la manche).`);
    setup.classList.add("hidden"); hub.classList.add("hidden"); board.classList.remove("hidden"); $("#duelEnd").classList.add("hidden");
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

  function dropAsk() { if (askModal) { askModal = null; modal.classList.add("hidden"); modal.innerHTML = ""; } }   // fin de partie : on abandonne la demande en attente
  async function finish() {
    dropAsk();
    const won = g.winner === SEAT; const wasOnline = !!sync;
    clearTimeout(oppLeftTimer); if (sync) { sync.close(); sync = null; }
    $("#btnForfeit").classList.add("hidden");
    if (won && !wasOnline && !tuto) addWin(level);
    const { rewarded, amount, promo } = tuto ? { rewarded: false, amount: 0, promo: null } : await S.recordDuel(won, wasOnline ? "versus" : level);
    if (wasOnline) onlineEnd?.();
    $("#duelEnd").classList.remove("hidden");
    $("#duelEndMsg").innerHTML = won
      ? `🏆 Victoire${wasOnline ? " contre " + esc(g.P(OPP).name) : ""} !${tuto ? " Tuto réussi : tu connais les bases, lance un vrai duel !" : rewarded ? ` <b>+${amount} booster${amount > 1 ? "s" : ""}</b>` : " (limite de 5 récompenses par 24 h atteinte pour ce type de duel)"}${promo ? `<br>🎉 Carte promo obtenue : ${esc(promo.name)} (${promo.label})` : ""}`
      : tuto ? "Tuto terminé (pas de récompense). Relance-le ou joue un vrai duel !" : "Défaite… retente ta chance !";
    tick(); tuto = false; render(g); $("#tutoBar").classList.add("hidden");
  }

  // ---------- duel en ligne ----------
  async function startOnline({ seat, seed, decks, names, net, onEnd }) {
    dropAsk();
    SEAT = seat; OPP = 1 - seat; onlineEnd = onEnd; logs = []; $("#bdLog").innerHTML = ""; busy = false; turnDone = null;
    g = new Game({ decks, names, ai: [0, 0], seed, ask: () => null, onUpdate: render, log: addLog, fx: makeFx(() => SEAT) });
    sync = new Sync({ seat, net, humanAsk, onForfeit: () => { if (g && g.winner === null) { g.lose(OPP, "abandon de l'adversaire"); render(); sync?.close(); } } });
    sync.attach(g); window.__gmGame = g; window.__gmSync = sync; window.__gmSeat = seat;
    addLog(`Duel contre ${names[OPP]}. Tu joues ${seat === 0 ? "en premier siège" : "en second siège"}.`);
    setup.classList.add("hidden"); hub.classList.add("hidden"); board.classList.remove("hidden"); $("#duelEnd").classList.add("hidden"); $("#btnForfeit").classList.remove("hidden");
    render(); await pvpLoop(); return sync;
  }
  async function pvpLoop() {
    try {
      await g.setup(); render();
      while (g.winner === null && sync && !sync.closed) {
        await g.startTurn(); render(); if (g.winner !== null) break;
        if (g.active === SEAT) { await humanTurn(); if (g.winner !== null || !sync || sync.closed) break; }
        else { await sync.remoteTurn(); render(); }
        if (g.winner !== null || !sync || sync.closed) break;
        await g.endTurn(); render();
      }
    } catch (e) { console.error(e); toast("Erreur de jeu : " + e.message); }
    if (g.winner === null) g.lose(OPP, "l'adversaire a quitté la partie");
    finish();
  }
  // L'adversaire a quitté : s'il ne revient pas en 60 s, la victoire est pour celui qui reste.
  function opponentLeft() {
    if (!sync || !g || g.winner !== null || oppLeftTimer) return;
    toast("Ton adversaire s'est déconnecté. Victoire dans 60 s s'il ne revient pas.");
    oppLeftTimer = setTimeout(() => { oppLeftTimer = null; if (g && g.winner === null && sync) { g.lose(OPP, "l'adversaire est parti"); render(); sync.close(); if (turnDone) { const r = turnDone; turnDone = null; r(); } } }, 60000);
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
    const canAtk = pi === SEAT && g.canAttack(SEAT, s) && g.attackOptions(SEAT, s).length;
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
    reopenAsk();
    const me = g.P(SEAT), op = g.P(OPP), myTurn = g.active === SEAT && g.winner === null;
    $("#bdOpp").innerHTML = `<b>${esc(op.name)}</b><span class="hand-backs">${Array.from({ length: op.hand.length }, () => "<i></i>").join("")}</span><span>✋ ${op.hand.length}</span>`;
    $("#bdMe").innerHTML = `<b>Toi</b><span>✋ ${me.hand.length}/5</span><span>❤ PV ${me.pv.length}</span>`;
    $("#matOpp").innerHTML = matHTML(OPP); $("#matMe").innerHTML = matHTML(SEAT);
    $("#bdHand").innerHTML = me.hand.map((c, i) => {
      const ok = myTurn && !busy && g.phase === "action" && g.canPlay(SEAT, c);
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
    renderTuto(myTurn); applyTips();
  }

  // ---------- bulles d'aide ----------
  let helpOn = true; try { helpOn = localStorage.getItem("gmtcg.help") !== "0"; } catch (_) {}
  const bubble = document.createElement("div"); bubble.className = "tipbubble hidden"; document.body.appendChild(bubble);
  let tipTimer = null, lastPtr = "mouse";
  const setTip = (el, text, interactive = false) => { if (!el) return; el.dataset.tip = text; if (interactive) el.dataset.tipInt = "1"; else delete el.dataset.tipInt; };
  const firstSentence = (t) => (t || "").split(". ")[0].replace(/\.$/, "") + ".";
  function applyTips() {
    if (!g) return;
    const q = (sel, fn) => board.querySelectorAll(sel).forEach(fn);
    q(".zone.pvz", (e) => setTip(e, TIPS.pv)); q(".pile.club", (e) => setTip(e, TIPS.club)); q(".pile.reserve", (e) => setTip(e, TIPS.reserve)); q(".pile.discard", (e) => setTip(e, TIPS.discard, true));
    q(".bd-ess", (e) => setTip(e, TIPS.essences)); q(".ess", (e) => setTip(e, `${e.title || "Essence"} — ${TIPS.essences}`));
    q(".lane .def", (e) => setTip(e, TIPS.def)); q(".lane .eng-badge", (e) => setTip(e, TIPS.engaged)); q(".lane .obj", (e) => setTip(e, `${e.title} — ${TIPS.obj}`));
    q(".lane .kw", (e) => { const k = e.textContent.trim().toUpperCase(); setTip(e, `${e.textContent.trim()} : ${KEYWORD_INFO[k] || ""}`); });
    q(".lane.empty", (e) => setTip(e, TIPS.lane, true));
    q(".lane[data-uid]", (e) => { const s = g.P(+e.dataset.pi).lanes[+e.dataset.lane]; if (!s) return; setTip(e, `${C(s).name} — ${firstSentence(CATEGORY_INFO.Joueur)} Touche la carte pour voir ses attaques et ses conseils.`, true); });
    document.querySelectorAll("#bdSteps i").forEach((e, i) => setTip(e, PHASE_INFO[STEPS[i][0]]));
    setTip($("#btnCombat"), TIPS.btnCombat); setTip($("#btnEnd"), TIPS.btnEnd); setTip($("#btnForfeit"), TIPS.btnForfeit); setTip($("#bdHand"), TIPS.hand, true);
    q(".hand-backs", (e) => setTip(e, TIPS.oppHand));
    q(".hcard", (e) => { const c = g.P(SEAT).hand[+e.dataset.i]; if (c) setTip(e, `${C(c).name} (${C(c).category}) — ${firstSentence(CATEGORY_INFO[C(c).category])} Touche pour lire la carte et la jouer.`, true); });
  }
  function showTip(el) {
    if (!helpOn || !el?.dataset.tip) return;
    bubble.textContent = el.dataset.tip; bubble.classList.remove("hidden");
    const r = el.getBoundingClientRect(), b = bubble.getBoundingClientRect(), vw = innerWidth;
    let x = r.left + r.width / 2 - b.width / 2; x = Math.max(8, Math.min(vw - b.width - 8, x));
    let y = r.top - b.height - 10; if (y < 8) y = r.bottom + 10;
    bubble.style.left = x + "px"; bubble.style.top = y + "px";
  }
  const hideTip = () => { clearTimeout(tipTimer); bubble.classList.add("hidden"); };
  document.addEventListener("pointerdown", (e) => { lastPtr = e.pointerType || "mouse"; }, true);
  board.addEventListener("pointerover", (e) => { if (e.pointerType !== "mouse") return; const el = e.target.closest("[data-tip]"); if (el) showTip(el); else hideTip(); });
  board.addEventListener("pointerleave", hideTip); window.addEventListener("scroll", hideTip, { passive: true });
  board.addEventListener("click", (e) => {                 // au toucher : les éléments purement informatifs affichent leur bulle
    if (!helpOn || lastPtr === "mouse") return;
    const el = e.target.closest("[data-tip]:not([data-tip-int])");
    if (el && board.contains(el)) { e.stopPropagation(); e.preventDefault(); showTip(el); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 5500); } else hideTip();
  }, true);
  const helpLabel = () => { $("#btnHelp").textContent = helpOn ? "💡 Bulles d'aide : oui" : "💡 Bulles d'aide : non"; $("#btnHelp").classList.toggle("on", helpOn); };
  $("#btnHelp").addEventListener("click", () => { helpOn = !helpOn; try { localStorage.setItem("gmtcg.help", helpOn ? "1" : "0"); } catch (_) {} hideTip(); helpLabel(); toast(helpOn ? "Bulles d'aide activées : survole ou touche un élément." : "Bulles d'aide coupées."); });
  helpLabel();

  // ---------- mode tuto ----------
  function openTuto() {
    let i = 0;
    const page = () => {
      const p = TUTO_PAGES[i], last = i === TUTO_PAGES.length - 1;
      openModal(`<h3>🎓 ${esc(p.title)} <small class="muted">(${i + 1}/${TUTO_PAGES.length})</small></h3><div class="tuto-page">${p.html}</div>
        <div class="btn-row center">${i ? '<button class="btn" data-prev>◀ Précédent</button>' : ""}<button class="btn primary" data-next>${last ? "Commencer la partie guidée ▶" : "Suivant ▶"}</button><button class="btn" data-close>Fermer</button></div>`, (el) => {
        el.querySelector("[data-prev]")?.addEventListener("click", () => { i--; page(); });
        el.querySelector("[data-next]").addEventListener("click", () => { if (last) { closeModal(); tuto = true; if (!helpOn) { helpOn = true; helpLabel(); } start(); } else { i++; page(); } });
      });
    };
    page();
  }
  function renderTuto(myTurn) {
    const bar = $("#tutoBar"); document.querySelectorAll(".tuto-glow").forEach((e) => e.classList.remove("tuto-glow"));
    bar.classList.toggle("hidden", !tuto || !g); if (!tuto || !g) return;
    const h = tutoHint(g, SEAT, { busy, myTurn, canPlay: (c) => g.canPlay(SEAT, c), canAttackAny: () => g.slots(SEAT).some((s) => g.canAttack(SEAT, s) && g.attackOptions(SEAT, s).length) });
    $("#tutoText").innerHTML = h.text;
    for (const sel of h.glow || []) document.querySelectorAll(sel).forEach((e) => e.classList.add("tuto-glow"));
  }

  // Défausse : toucher la pile pour voir les cartes (elles sont publiques)
  board.addEventListener("click", (e) => {
    const pile = e.target.closest('.pile[data-pile="discard"]'); if (!pile) return;
    const pi = +pile.closest("[data-pi]").dataset.pi, cs = g.P(pi).discard;
    openModal(`<h3>Défausse ${pi === SEAT ? "(toi)" : "(adversaire)"} · ${cs.length} carte${cs.length > 1 ? "s" : ""}</h3>${cs.length ? `<div class="pick-row">${[...cs].reverse().map((c) => `<div class="pick">${cardHTML(C(c))}</div>`).join("")}</div>` : '<p class="muted">Vide.</p>'}<div class="btn-col"><button class="btn" data-close>Fermer</button></div>`);
  });

  // ---------- actions du joueur ----------
  $("#btnCombat").addEventListener("click", () => { if (g.phase === "action" && !busy) { g.beginCombat(); render(); } });
  $("#btnEnd").addEventListener("click", () => { if (turnDone && !busy) { sync?.sendEnd(); const r = turnDone; turnDone = null; r(); } });
  $("#btnForfeit").addEventListener("click", () => { if (sync && g && g.winner === null && confirm("Abandonner la partie ? Tu perds le duel.")) { sync.forfeit(); g.lose(SEAT, "abandon"); render(); if (turnDone) { const r = turnDone; turnDone = null; r(); } } });

  async function run(fn) {
    if (busy) return; busy = true; render();
    try { await fn(); } finally { busy = false; render(); if (g && g.winner !== null && turnDone) { const r = turnDone; turnDone = null; r(); } }   // la partie peut se terminer pendant mon action
  }

  $("#bdHand").addEventListener("click", (e) => {
    const el = e.target.closest(".hcard"); if (!el) return;
    const c = g.P(SEAT).hand[+el.dataset.i]; if (!c) return;
    const myTurn = g.active === SEAT && g.phase === "action" && g.winner === null;
    const card = C(c);
    const buttons = [];
    if (myTurn && g.canPlay(SEAT, c)) {
      if (card.category === "Joueur" && g.freeLanes(SEAT).length) g.freeLanes(SEAT).forEach((l) => buttons.push({ label: `Jouer en case ${l + 1}`, primary: true, fn: () => run(() => g.playFromHand(SEAT, c, { lane: l })) }));
      else buttons.push({ label: card.category === "Joueur" ? "Jouer (bench un Joueur non engagé)" : "Jouer", primary: true, fn: () => run(() => g.playFromHand(SEAT, c)) });
    } else if (myTurn) buttons.push({ label: playHint(c), disabled: true });
    sheet(c, buttons);
  });
  function playHint(c) {
    const k = C(c);
    if (k.category === "Coach" && g.P(SEAT).coachPlayed) return "Une seule carte Coach par tour";
    if (k.category !== "Joueur" && k.color !== "Neutre" && !g.hasEssenceColor(SEAT, k.color)) return `Il faut une Essence ${k.color} déployée`;
    if (k.category === "Objet" && !g.slots(SEAT).length) return "Aucun Joueur à qui lier l'Objet";
    return "Injouable pour l'instant";
  }

  board.addEventListener("click", (e) => {
    const lane = e.target.closest(".lane[data-uid]"); if (!lane || e.target.closest("#bdHand")) return;
    const pi = +lane.dataset.pi, s = g.P(pi).lanes[+lane.dataset.lane]; if (!s) return;
    const buttons = [];
    if (pi === SEAT && g.active === SEAT && !busy) {
      if (g.phase === "combat" && g.canAttack(SEAT, s)) {
        const opts = g.attackOptions(SEAT, s);
        if (!opts.length) buttons.push({ label: "Pas assez d'Essences pour attaquer", disabled: true });
        for (const i of opts) buttons.push({ label: `⚔ ${C(s).attacks[i].name} — ${g.attackValue(s, i)}${costStr(g.attackCost(SEAT, s, i))}`, primary: true, fn: () => run(() => g.attack(SEAT, s, i)) });
      } else if (g.phase === "combat") buttons.push({ label: s.engaged ? "Joueur engagé : ne peut pas attaquer" : "Ne peut pas attaquer ce tour", disabled: true });
      if (g.activables(SEAT).includes(s)) buttons.push({ label: "Activer : engager pour bench un Joueur adverse", fn: () => run(() => g.activate(SEAT, s)) });
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
      <details class="sheet-help" ${helpOn || tuto ? "open" : ""}><summary>💡 Comprendre cette carte</summary>${tipsFor(k).map((t) => `<p>${esc(t)}</p>`).join("")}${comboFor(k) ? `<p class="combo-line">🤝 <b>Combos</b> : ${esc(comboFor(k))}</p>` : ""}</details>
      <div class="btn-col">${buttons.map((b, i) => `<button class="btn${b.primary ? " primary" : ""}" data-b="${i}" ${b.disabled ? "disabled" : ""}>${esc(b.label)}</button>`).join("")}
      <button class="btn" data-close>Fermer</button></div></div></div>`, (el) => {
      el.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", () => { closeModal(); buttons[+b.dataset.b].fn?.(); }));
    });
  }
  let modalResolve = null;
  let askModal = null;                       // demande du moteur en cours { html, wire } : sa fenêtre ne doit JAMAIS disparaître sans réponse (sinon la partie reste bloquée)
  function openModal(html, wire, isAsk = false) {
    if (askModal && !isAsk) return;           // une fiche/aperçu ne remplace pas une demande en attente
    if (isAsk) askModal = { html, wire };
    modal.innerHTML = `<div class="modal-box">${html}</div>`; modal.classList.remove("hidden");
    modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { closeModal(); modalResolve?.(null); }));
    wire?.(modal);
  }
  function closeModal() { if (askModal) return; modal.classList.add("hidden"); modal.innerHTML = ""; }
  function reopenAsk() { if (askModal && modal.classList.contains("hidden")) { modal.classList.remove("hidden"); modal.innerHTML = `<div class="modal-box">${askModal.html}</div>`; askModal.wire?.(modal); } }
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Réponses humaines aux demandes du moteur
  function humanAsk(req) {
    return new Promise((resolve) => {
      const done = (v) => { modalResolve = null; askModal = null; closeModal(); resolve(v); };
      modalResolve = null;
      const title = `<h3>${esc(req.title || "")}</h3>`;
      const cardsRow = (cs) => `<div class="pick-row">${cs.map((c) => `<div class="pick" >${cardHTML(C(c))}</div>`).join("")}</div>`;
      if (req.kind === "info") {
        openModal(`${title}${cardsRow(req.cards || [])}<div class="btn-col"><button class="btn primary" data-ok>OK</button></div>`, (el) => el.querySelector("[data-ok]").addEventListener("click", () => done(null)), true);
      } else if (req.kind === "confirm") {
        openModal(`${title}${req.cards ? cardsRow(req.cards) : ""}<div class="btn-row center"><button class="btn primary" data-y>Oui</button><button class="btn" data-n>Non</button></div>`, (el) => {
          el.querySelector("[data-y]").addEventListener("click", () => done(true)); el.querySelector("[data-n]").addEventListener("click", () => done(false)); }, true);
      } else if (req.kind === "choice") {
        openModal(`${title}<div class="btn-col">${req.options.map((o, i) => `<button class="btn" data-o="${i}">${esc(o.label)}</button>`).join("")}${req.allowNone ? '<button class="btn" data-none>Ne rien faire</button>' : ""}</div>`, (el) => {
          el.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => done(req.options[+b.dataset.o].value)));
          el.querySelector("[data-none]")?.addEventListener("click", () => done(null)); }, true);
      } else {
        // card | slot : choisir parmi des cartes
        const items = req.kind === "card" ? req.cards : req.slots;
        if (!items.length) return resolve(null);
        const top = req.reveal && req.reveal.length ? `<p class="muted small">Cartes révélées :</p>${cardsRow(req.reveal)}` : "";
        const hint = req.kind === "slot" && req.attackValue ? `<p class="muted small">Valeur d'attaque : ${req.attackValue}</p>` : "";
        openModal(`${title}${hint}${top}<div class="pick-row">${items.map((it, i) => `<div class="pick sel" data-p="${i}">${cardHTML(C(it))}${req.kind === "slot" ? `<small>🛡 ${g.defense(it)}${it.engaged ? " · engagé" : ""}</small>` : ""}</div>`).join("")}</div>
          ${req.allowNone ? '<div class="btn-col"><button class="btn" data-none>Aucun</button></div>' : ""}`, (el) => {
          el.querySelectorAll("[data-p]").forEach((p) => p.addEventListener("click", () => done(items[+p.dataset.p])));
          el.querySelector("[data-none]")?.addEventListener("click", () => done(null)); }, true);
      }
    });
  }

  renderDeckPicker();
  // Decks pour les duels en ligne (mêmes règles que contre l'IA)
  function deckOptions() { return [...PRESETS.map((p) => ({ value: "preset:" + p.id, label: p.name, blurb: p.blurb + " (cartes prêtées)" })), { value: "collection", label: "Mon deck (ma collection)", blurb: "Construit automatiquement avec tes cartes, dans les 2 couleurs choisies ci-dessous." }]; }
  function deckFor(v) { return v === "collection" ? chosenDeckFrom("collection").deck : buildPreset(v.slice(7)); }
  function chosenDeckFrom(v) { const colors = [...new Set([$("#dcol1").value, $("#dcol2").value])]; return { deck: autoDeck(colors, S.get().collection) }; }
  function deckProblems(deck) {
    const errs = validateDeck(deck).filter((e) => !e.startsWith("Conseil"));
    if (deck.club.some((id) => !BY_ID[id]) || deck.reserve.some((id) => !BY_ID[id])) errs.push("Carte inconnue dans le deck.");
    return errs;
  }
  return { showSetup, showHub, openTuto, startOnline, opponentLeft, deckOptions, deckFor, deckProblems, deckPickerHTML: (id) => deckPickerHTML(id, deckOptions(), deckFor, "preset:" + PRESETS[0].id), wireDeckPicker: (root) => wireDeckPicker(root, deckFor), isPlaying: () => !!g && g.winner === null && !board.classList.contains("hidden") };
}
