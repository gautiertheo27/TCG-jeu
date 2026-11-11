// Effets de chaque carte (Joueur, Coach, Moment, Objet), écrits d'après le texte imprimé.
// Clés : identifiant de carte (GM1-NNN ou Pxx). Les Essences n'ont pas d'effet propre.
import { C } from "./core.js";

// ---------- aides ----------
const E = (g, pi) => g.opp(pi);
const enemies = (g, pi, f = () => true) => g.slots(E(g, pi)).filter((s) => f(s));
const allies = (g, pi, f = () => true) => g.slots(pi).filter((s) => f(s));
const noProvoc = (g) => (s) => !g.keywords(s).has("PROVOCATION");
const noKw = (g) => (s) => g.keywords(s).size === 0;
const pickEnemy = (g, pi, title, f, aiPick = "enemyBest") =>
  g.ask(pi, { kind: "slot", title, slots: enemies(g, pi, f), aiPick });
const pickAlly = (g, pi, title, f, aiPick = "strongest", allowNone = false) =>
  g.ask(pi, { kind: "slot", title, slots: allies(g, pi, f), aiPick, allowNone });
const endTurn = (g) => g.turn;            // « jusqu'à la fin du tour »
const endOppTurn = (g) => g.turn + 1;     // « jusqu'à la fin du tour adverse »
const buff = (g, slot, m, until) => g.addMod({ slot, until, ...m });
const side = (g, pi, m, until, filter) => g.addMod({ side: pi, until, filter, ...m });
const removeFromHand = (g, pi, c) => { g.P(pi).hand = g.P(pi).hand.filter((x) => x !== c); };
async function discardFromHand(g, pi, n, title = "Défaussez une carte", filter = () => true) {
  let done = 0;
  for (let k = 0; k < n; k++) {
    const pool = g.P(pi).hand.filter((c) => filter(C(c))); if (!pool.length) break;
    const c = await g.ask(pi, { kind: "card", title: `${title} (${k + 1}/${n})`, cards: pool, aiPick: "worst" });
    if (!c) break; removeFromHand(g, pi, c); g.discardCard(pi, c); done++;
  }
  return done;
}
async function benchEnemyObjet(g, pi) {
  const opts = enemies(g, pi, (s) => s.objets.length).flatMap((s) => s.objets.map((o) => ({ label: `${C(o).name} (sur ${C(s).name})`, value: [s, o], card: o })));
  const r = await g.ask(pi, { kind: "choice", title: "Bench un Objet adverse", options: opts, aiDefault: opts[0]?.value });
  if (r) { await g.benchObjet(E(g, pi), r[1], r[0]); g.log(`${C(r[1]).name} est bench.`); }
}
async function revealTake(g, pi, n, pred, title, rest = "discard", max = 1) {
  const P = g.P(pi), top = P.club.splice(0, n);
  const pool = top.filter((c) => pred(C(c)));
  const taken = [];
  for (let k = 0; k < max && pool.length; k++) {
    const c = await g.ask(pi, { kind: "card", title, cards: pool.filter((x) => !taken.includes(x)), allowNone: max > 1, aiPick: "best", reveal: top });
    if (!c) break; taken.push(c);
  }
  P.hand.push(...taken);
  const left = top.filter((c) => !taken.includes(c));
  if (rest === "discard") P.discard.push(...left);
  else if (rest === "top") P.club.unshift(...left);
  else P.club.push(...left);
  g.log(`${P.name} ajoute ${taken.length} carte(s) à sa main.`);
}
async function swapPV(g, pi) {
  const P = g.P(pi); if (!P.pv.length || !P.hand.length) return;
  const pv = await g.ask(pi, { kind: "card", title: "Choisissez un PV à échanger", cards: P.pv, aiPick: "best", allowNone: true });
  if (!pv) return;
  const h = await g.ask(pi, { kind: "card", title: "…avec quelle carte de votre main ?", cards: P.hand, aiPick: "worst" });
  if (!h) return;
  P.pv[P.pv.indexOf(pv)] = h; removeFromHand(g, pi, h); P.hand.push(pv);
}
async function shuffleEssences(g, pi, color, n) {
  const P = g.P(pi);
  const pool = P.essences.filter((e) => C(e.card).color === color).sort((a, b) => b.engaged - a.engaged).slice(0, n);
  if (pool.length < n) return false;
  P.essences = P.essences.filter((e) => !pool.includes(e)); g.shuffleInto(P.reserve, pool.map((e) => e.card));
  g.log(`${n} Essence(s) ${color} retournent dans la Réserve.`); return true;
}
async function playTopReserve(g, pi, engaged = false) {
  const P = g.P(pi); if (!P.reserve.length) return;
  const e = P.reserve.shift(); P.essences.push({ card: e, engaged }); g.log(`${P.name} joue ${C(e).name}.`);
}
async function untapAlly(g, pi, title = "Désengagez un de vos Joueurs") {
  const s = await pickAlly(g, pi, title, (x) => x.engaged); if (s) await g.unengage(s);
}
async function opponentChooses(g, pi, a, b, la, lb) {
  const r = await g.ask(E(g, pi), { kind: "choice", title: "Votre adversaire vous laisse choisir :", options: [{ label: la, value: "a" }, { label: lb, value: "b" }], aiDefault: "b" });
  return r === "a" ? a() : b();
}
const objCount = (s) => s.objets.length;
const kwAll = (g, pi) => g.slots(pi).length;

// ---------- table des effets ----------
export const SPECS = {
  // ===== Rose =====
  "GM1-010": { on: { recoverPV: async (g, s, pi, c) => { if (c.pi === pi) await g.engage(s); } } },
  "GM1-011": { attackFx: { 1: async (g, s, pi) => { const t = await pickEnemy(g, pi, "Glissade : engagez un Joueur adverse", (x) => !x.engaged); if (t) await g.engage(t); } } },
  "GM1-012": { onDeploy: async (g, s, pi) => { const t = await pickEnemy(g, pi, "Squeezie : engagez un Joueur adverse", (x) => !x.engaged); if (t) await g.engage(t); } },
  "GM1-013": { attackPlus: (g) => 10 * [0, 1].flatMap((p) => g.slots(p)).filter((x) => x.engaged).length },
  "GM1-014": { play: (g, pi) => side(g, pi, { atk: 30 }, endTurn(g)) },
  "GM1-015": { atk: () => 10, def: () => 10,
    on: { engaged: async (g, s, pi, c, o) => { if (c.slot === s && await g.ask(pi, { kind: "confirm", title: "Ravitaillement : bench l'Objet pour piocher 1 carte ?", aiDefault: true })) { await g.benchObjet(pi, o, s); await g.draw(pi, 1); } } } },
  "GM1-016": { play: async (g, pi) => { const t = await pickAlly(g, pi, "Mur Salvateur : quel Joueur ?"); if (t) buff(g, t, { def: 10, kw: ["GARDE"] }, endOppTurn(g)); } },
  "GM1-017": { buffAtk: 10 },
  "GM1-018": { canPlay: (g, pi) => enemies(g, pi, noProvoc(g)).length > 0,
    play: async (g, pi) => { const t = await pickEnemy(g, pi, "Renvoyez un Joueur adverse dans la main", noProvoc(g)); if (t) await g.removeJoueur(t, "hand"); } },
  "GM1-019": { play: (g, pi) => opponentChooses(g, pi, () => g.draw(pi, 2), () => discardFromHand(g, E(g, pi), 2), "Piochez 2 cartes", "Votre adversaire défausse 2 cartes") },
  "GM1-020": { canPlay: (g, pi) => enemies(g, pi).length > 0,
    play: async (g, pi) => { const t = await pickEnemy(g, pi, "Dégustation : quel Joueur adverse ?"); if (!t) return; buff(g, t, { def: -30 }, endTurn(g));
      const mine = g.P(pi).lanes[g.laneOf(E(g, pi), t)]; if (mine) buff(g, mine, { atk: 30 }, endTurn(g)); } },
  "GM1-021": { play: async (g, pi) => {
    const all = [0, 1].flatMap((p) => g.slots(p)).filter((s) => s.objets.length);
    const t = await g.ask(pi, { kind: "slot", title: "Renvoyez les Objets liés à quel Joueur ?", slots: all, aiPick: "enemyBest" });
    if (t) { const o = g.ownerOf(t); g.P(o).hand.push(...t.objets); t.objets = []; } } },
  "GM1-022": { attackFx: { 0: async (g, s, pi) => { const t = await pickEnemy(g, pi, "Omniscience : engagez un Joueur adverse", (x) => !x.engaged); if (t) await g.engage(t); } } },
  "GM1-024": { buffAtk: 20 },
  "GM1-026": { play: async (g, pi) => { const t = await pickEnemy(g, pi, "Engagez un Joueur adverse sans mot-clé", (x) => !x.engaged && noKw(g)(x)); if (t) await g.engage(t); } },
  "GM1-027": { play: (g, pi) => { if (g.P(pi).pv.length < g.P(E(g, pi)).pv.length) side(g, pi, { atk: 20 }, endTurn(g)); else g.log("Remontada : sans effet (vous n'avez pas moins de PV)."); } },
  "GM1-028": { play: (g, pi) => side(g, pi, { attackBonus: 20 }, endTurn(g), (s) => g.keywords(s).has("BUFF")) },

  // ===== Orange =====
  "GM1-029": { attackPlus: (g, s) => 20 * objCount(s),
    onLink: async (g, s, pi) => { const pool = g.P(pi).discard.filter((c) => C(c).category === "Objet"); if (!pool.length) return;
      const c = await g.ask(pi, { kind: "card", title: "Pollo : placer un Objet de la défausse sur le Club ?", cards: pool, allowNone: true, aiPick: "best" });
      if (c) { g.P(pi).discard = g.P(pi).discard.filter((x) => x !== c); g.P(pi).club.unshift(c); } } },
  "GM1-030": { play: (g, pi) => { g.flags[`lyon${pi}`] = true; g.slots(pi).forEach((s) => (s.lyonUsed = false)); } },
  "GM1-031": { play: (g, pi) => revealTake(g, pi, 6, (c) => c.category === "Objet", "Objets révélés : ajoutez-les", "discard", 6) },
  "GM1-032": { saveOnVanquish: true },
  "GM1-033": { play: async (g, pi) => { const t = await pickEnemy(g, pi, "Visa Refusé : quel Joueur sans Objet ?", (x) => !x.objets.length); if (t) buff(g, t, { cantAttack: true }, endOppTurn(g)); } },
  "GM1-034": { attackPlus: (g, s) => 10 * objCount(s) },
  "GM1-036": { grantKw: () => ["RIPOSTE"],
    resilience: async (g, pi) => { const t = await pickAlly(g, pi, "Un de vos Joueurs gagne Riposte"); if (t) buff(g, t, { kw: ["RIPOSTE"] }, endTurn(g)); } },
  "GM1-037": { play: (g, pi) => revealTake(g, pi, 4, (c) => c.category === "Objet", "Ajoutez un Objet à votre main", "top"),
    resilience: async (g, pi) => { const P = g.P(pi); const o = P.discard.filter((c) => C(c).category === "Objet").slice(0, 2); P.discard = P.discard.filter((c) => !o.includes(c)); g.shuffleInto(P.club, o); } },

  // ===== Jade =====
  "GM1-038": { canPlay: (g, pi) => g.P(pi).hand.length > 0,
    play: async (g, pi) => { if (await discardFromHand(g, pi, 1)) await playTopReserve(g, pi, true); }, resilience: "play" },

  // ===== Violette =====
  "GM1-039": { on: { oppPlayJoueur: async (g, s, pi, c) => {
    if (c.pi !== pi) return; const others = allies(g, pi, (x) => x !== s); if (!others.length) return;
    const o = await g.ask(pi, { kind: "slot", title: "Zéro Soucis : échanger sa position avec un autre Joueur ?", slots: others, allowNone: true, aiPick: "none" });
    if (o) { const L = g.P(pi).lanes, a = L.indexOf(s), b = L.indexOf(o); [L[a], L[b]] = [L[b], L[a]]; } } } },
  "GM1-040": { attackPlus: (g, s, pi) => 10 * g.P(pi).pv.length },
  "GM1-041": { play: (g, pi) => { let done = false; g.listen("recoverPV", async (gg, c) => { if (!done && c.pi === E(g, pi)) { done = true; await untapAlly(gg, pi); } }, endTurn(g)); },
    resilience: (g, pi) => untapAlly(g, pi) },
  "GM1-042": { play: (g, pi) => swapPV(g, pi),
    resilience: async (g, pi) => { const P = g.P(pi); if (!P.pv.length || !P.hand.length) return; g.discardCard(pi, P.pv.shift());
      const c = await g.ask(pi, { kind: "card", title: "Placez une carte de votre main sur vos PV", cards: P.hand, aiPick: "worst" }); if (c) { removeFromHand(g, pi, c); P.pv.unshift(c); } } },
  "GM1-043": { canPlay: (g, pi) => g.slots(pi).length >= 2, resilience: "play",
    play: async (g, pi) => { const a = await pickAlly(g, pi, "Échangez la position de 2 Joueurs : premier"); if (!a) return;
      const b = await pickAlly(g, pi, "…second", (x) => x !== a); if (!b) return; const L = g.P(pi).lanes, i = L.indexOf(a), j = L.indexOf(b); [L[i], L[j]] = [L[j], L[i]]; } },
  "GM1-044": { attackFx: { 0: (g, s, pi) => untapAlly(g, pi, "Pinch : désengagez un autre de vos Joueurs") },
    onDeploy: async (g, s, pi) => { if (g.P(pi).pv.length > 2) await g.draw(pi, 1); } },
  "GM1-045": { onDeploy: (g, s, pi) => swapPV(g, pi),
    attackFx: { 0: async (g, s, pi) => { const P = g.P(pi), top = P.club.splice(0, 4); const bottom = [];
      for (const c of top) if (await g.ask(pi, { kind: "confirm", title: `Rêverie : placer ${C(c).name} en dessous du Club ?`, cards: [c], aiDefault: C(c).category === "Essence" })) bottom.push(c);
      P.club.unshift(...top.filter((c) => !bottom.includes(c))); P.club.push(...bottom); } } },
  "GM1-046": { on: { vanquish: async (g, s, pi, c) => { if (c.killer === s) { const e = g.P(pi).essences.find((x) => x.engaged); if (e) await g.unengageEssence(pi, e); } } },
    resilience: (g, pi) => untapAlly(g, pi) },
  "GM1-047": { play: (g, pi) => g.listen("unengageJoueur", async (gg, c) => { if (c.pi === pi && gg.active === pi) { const e = gg.P(pi).essences.find((x) => x.engaged && C(x.card).color === "Violette"); if (e) await gg.unengageEssence(pi, e); } }, endTurn(g)) },
  "GM1-048": { play: (g, pi) => { let done = false; g.listen("unengageEssence", async (gg, c) => { if (!done && c.pi === pi) { done = true; const s = gg.slots(pi).find((x) => x.engaged && C(x).color === "Violette"); if (s) await gg.unengage(s); } }, endTurn(g)); } },

  // ===== Jaune =====
  "GM1-049": { attackPlus: (g, s, pi) => 20 * g.P(pi).essences.filter((e) => C(e.card).color === "Jaune").length },

  // ===== Mauve =====
  "GM1-050": { onDeploy: async (g, s, pi) => { const t = await pickEnemy(g, pi, "La Fée Rosalie : bench un Joueur adverse engagé sans Provocation", (x) => x.engaged && noProvoc(g)(x)); if (t) await g.removeJoueur(t); } },
  "GM1-052": { attackFx: { 1: (g, s, pi) => shuffleEssences(g, pi, "Mauve", 1) } },
  "GM1-053": { atk: () => 10, def: () => 10,
    on: { vanquish: async (g, s, pi, c, o) => { if (c.killer === s && await g.ask(pi, { kind: "confirm", title: "Ravitaillement : détruire l'Objet pour piocher 2 cartes ?", aiDefault: true })) { await g.benchObjet(pi, o, s); await g.draw(pi, 2); } } },
    resilience: (g, pi) => benchEnemyObjet(g, pi) },
  "GM1-054": { play: async (g, pi) => { await shuffleEssences(g, pi, "Mauve", 1); side(g, pi, { attackBonus: 20 }, endTurn(g)); },
    resilience: (g, pi) => playTopReserve(g, pi) },
  "GM1-055": { play: (g, pi) => g.listen("firstAttackDone", async (gg, c) => { if (c.pi === pi && !c.killed && gg.ownerOf(c.slot) >= 0) buff(gg, c.slot, { kw: ["PROVOCATION"] }, gg.turn + 1); }, endTurn(g)),
    resilience: async (g, pi) => { const t = await pickEnemy(g, pi, "Bench un Joueur adverse engagé sans Provocation", (x) => x.engaged && noProvoc(g)(x)); if (t) await g.removeJoueur(t); } },
  "GM1-056": { atk: () => -10,
    on: { vanquish: async (g, s, pi, c, o) => { if (c.killer !== s || !enemies(g, pi, (x) => x.engaged).length) return;
      if (await g.ask(pi, { kind: "confirm", title: "Maillot Maudit : bench l'Objet pour bench un Joueur adverse engagé ?", aiDefault: true })) {
        await g.benchObjet(pi, o, s); const t = await pickEnemy(g, pi, "Bench un Joueur adverse engagé", (x) => x.engaged); if (t) await g.removeJoueur(t); } } },
    resilience: async (g, pi) => { for (const s of g.slots(pi)) await g.removeJoueur(s); g.flags.endCombat_t = true; } },
  "GM1-060": { attackPlus: (g, s, pi, ai) => (g.P(E(g, pi)).pvRecoveredThisTurn > 0 ? 100 : 0) },
  "GM1-061": { canPlay: (g, pi) => g.P(pi).essences.filter((e) => C(e.card).color === "Mauve").length >= 3 && enemies(g, pi).length > 0,
    play: async (g, pi) => { if (await shuffleEssences(g, pi, "Mauve", 3)) { const t = await pickEnemy(g, pi, "Bench un Joueur adverse"); if (t) await g.removeJoueur(t); } } },

  // ===== Verte =====
  "GM1-062": { doubleIf: (g, s, pi) => g.P(pi).pv.length < 2 },
  "GM1-063": { on: { attackLine: async (g, s, pi, c) => { if (c.attacker === s) g.addMod({ noDefendFrom: s, until: g.turn }); } } },

  // ===== Bleue =====
  "GM1-064": { on: { recoverPV: async (g, s, pi, c) => { if (c.pi === pi) await benchEnemyObjet(g, pi); } } },
  "GM1-065": { canHitLine: true, resilience: (g, pi) => discardFromHand(g, E(g, pi), 1, "Défaussez une carte Joueur", (c) => c.category === "Joueur") },
  "GM1-066": { canPlay: (g, pi) => g.P(pi).hand.length > 0 && g.freeEssences(pi).length >= 2 && g.P(E(g, pi)).essences.some((e) => e.engaged),
    play: async (g, pi) => { if (!(await discardFromHand(g, pi, 1))) return; g.pay(pi, ["Neutre", "Neutre"]);
      const O = g.P(E(g, pi)); const opts = O.essences.filter((e) => e.engaged).map((e) => ({ label: C(e.card).name, value: e, card: e.card }));
      const e = await g.ask(pi, { kind: "choice", title: "Choisissez une Essence adverse engagée", options: opts, aiDefault: opts[0]?.value });
      if (e) { O.essences = O.essences.filter((x) => x !== e); g.shuffleInto(O.reserve, [e.card]); } },
    resilience: (g, pi) => { const e = g.P(E(g, pi)).essences.find((x) => !x.engaged); if (e) e.engaged = true; } },
  "GM1-067": { onDeploy: async (g, s, pi) => { const P = g.P(pi), c = P.club.find((x) => /99% Faith/i.test(C(x).name)); if (c) { P.club = P.club.filter((x) => x !== c); P.hand.push(c); g.log("1% Chance : 99% Faith rejoint la main."); } } },
  "GM1-068": { dynKw: (g, s, pi) => (g.slots(pi).some((x) => /1% Chance/i.test(C(x).name)) ? ["PROVOCATION", "SHIELD"] : []) },

  // ===== Azur =====
  "GM1-069": { attackPlus: (g, s, pi) => 20 * g.P(pi).hand.length, nukePV: (g, s, pi) => g.slots(pi).length === 1 },
  "GM1-070": { play: (g, pi) => { let done = false; g.listen("firstAttackDone", async (gg, c) => {
      if (done || c.pi !== pi || gg.ownerOf(c.slot) < 0) return; done = true; await returnAndReplace(gg, pi, c.slot); }, endTurn(g)); },
    resilience: async (g, pi) => { const played = [];
      for (let k = 0; k < 2; k++) { const lane = g.freeLanes(pi)[0]; const pool = g.P(pi).hand.filter((c) => C(c).category === "Joueur"); if (lane === undefined || !pool.length) break;
        const c = await g.ask(pi, { kind: "card", title: "Worlds Japon : jouez un Joueur", cards: pool, aiPick: "best" }); if (!c) break; removeFromHand(g, pi, c); played.push(await g.deploy(pi, c, lane)); }
      g.flags.worldsJaponBench = played; } },
  "GM1-071": { afterAttack: { 0: (g, s, pi) => returnAndReplace(g, pi, s) } },

  // ===== Neutre — Joueurs =====
  "GM1-073": { on: { linkObjet: async (g, s, pi, c) => { if (c.pi !== pi) buff(g, s, { def: 20 }, endTurn(g)); } } },
  "GM1-075": { onDeploy: async (g, s, pi) => { const others = allies(g, pi, (x) => x !== s); if (!others.length) return;
      const P = g.P(pi); const objs = P.discard.filter((c) => C(c).category === "Objet").slice(0, 2); if (!objs.length) return;
      const t = await pickAlly(g, pi, "Pétrodollars : lier 2 Objets de la défausse à quel Joueur ?", (x) => x !== s);
      if (t) for (const o of objs) { P.discard = P.discard.filter((x) => x !== o); await g.linkObjet(pi, o, t); } },
    attackFx: { 0: async (g, s, pi) => { const others = allies(g, pi, (x) => x !== s); const P = g.P(pi), top = P.club.splice(0, 5);
      const objs = top.filter((c) => C(c).category === "Objet"); let picked = null;
      if (objs.length && others.length) { picked = await g.ask(pi, { kind: "card", title: "Vol : lier un Objet ?", cards: objs, allowNone: true, aiPick: "best", reveal: top });
        if (picked) { const t = await pickAlly(g, pi, "…à quel Joueur ?", (x) => x !== s); if (t) await g.linkObjet(pi, picked, t); else picked = null; } }
      P.club.unshift(...top.filter((c) => c !== picked)); } } },
  "GM1-076": { buffDef: 10, attackFx: { 0: (g, s, pi) => revealTake(g, pi, 5, (c) => c.category === "Joueur", "Déploiement : ajoutez un Joueur à votre main") } },
  "GM1-077": { on: { recoverPV: async (g, s, pi, c) => { if (c.attacker === s) await g.draw(pi, 1); } } },
  "GM1-079": { activate: async (g, s, pi) => { const t = await pickEnemy(g, pi, "Instalock : bench un Joueur adverse"); if (t) { await g.engage(s); await g.removeJoueur(t); } } },
  "GM1-080": { permutation: true },
  "GM1-101": { dynKw: (g, s) => (!s.engaged ? ["PROVOCATION"] : []) },
  "GM1-102": { onDeploy: async (g, s, pi) => { if (g.freeEssences(pi).length >= 2 && await g.ask(pi, { kind: "confirm", title: "Monster : engager 2 Essences pour piocher 2 cartes ?", aiDefault: g.P(pi).hand.length < 4 })) { g.pay(pi, ["Neutre", "Neutre"]); await g.draw(pi, 2); } } },
  "GM1-112": { on: { attackLine: async (g, s, pi, c) => { if (c.pi === pi && c.lane === g.laneOf(pi, s)) await g.draw(pi, 1); } } },
  "GM1-113": { onDeploy: async (g, s, pi) => { if (allies(g, pi, (x) => C(x).color === "Rose").length >= 3) { const t = await pickEnemy(g, pi, "Kampaï : renvoyez un Joueur adverse dans sa main"); if (t) await g.removeJoueur(t, "hand"); } } },
  "GM1-116": { attackFx: { 0: async (g, s, pi) => { const t = await pickEnemy(g, pi, "Foudre de Rage : bench un Joueur adverse"); if (t) await g.removeJoueur(t); await shuffleEssences(g, pi, "Mauve", 1); },
    1: (g, s, pi) => shuffleEssences(g, pi, "Mauve", 2) } },
  "GM1-117": { onDeploy: async (g, s, pi) => { const bd = allies(g, pi, (x) => /Baby Driver/i.test(C(x).name))[0]; if (bd) await g.removeJoueur(bd); await g.draw(pi, 3); } },
  P05: { legionFree: true },
  // Cartes fan-made
  P07: { onDeploy: async (g, s, pi) => { await g.draw(pi, 1); } },                                  // Nyzer le BG
  P11: { onDeploy: async (g, s, pi) => { if (g.P(pi).hand.length) await discardFromHand(g, pi, 1, "Allo MW4 : défaussez une carte"); await g.draw(pi, 1); } },   // Allo MW4
  P13: { attackFx: { 0: async (g, s, pi) => { const t = await pickEnemy(g, pi, "Morsure venimeuse : engagez un Joueur adverse", (x) => !x.engaged); if (t) await g.engage(t); } } },   // Lavipère
  P14: { buffAtk: 10 },
  P15: { play: (g, pi) => revealTake(g, pi, 5, () => true, "GTA VI : ajoutez une carte à votre main", "bottom"), resilience: (g, pi) => g.draw(pi, 1) },   // GTA VI                                                                                  // Lone
  P08: { atk: () => 30, def: () => -20,                                                             // Le compte bancaire (-500 €)
    resilience: async (g, pi) => { await g.draw(pi, 2); await discardFromHand(g, pi, 1); } },
  P06: { riposteFree: true },

  // ===== Neutre — Coach =====
  "GM1-082": { play: async (g) => { for (const p of [0, 1]) { const n = 4 - g.P(p).hand.length; if (n > 0) await g.draw(p, n); } }, resilience: (g, pi) => g.draw(pi, 2) },
  "GM1-083": { play: (g, pi) => g.draw(pi, 3), resilience: (g, pi) => revealTake(g, pi, 5, (c) => c.category === "Joueur", "Ajoutez un Joueur à votre main", "bottom") },
  "GM1-103": { canPlay: (g, pi) => g.P(pi).discard.some((c) => C(c).category === "Joueur"),
    play: async (g, pi) => { const pool = g.P(pi).discard.filter((c) => C(c).category === "Joueur" && SPECS[c.id]?.onDeploy);
      const c = await g.ask(pi, { kind: "card", title: "Déclenchez l'effet d'entrée d'un Joueur de la défausse", cards: pool, aiPick: "best" });
      if (c) await SPECS[c.id].onDeploy(g, { ...c, card: c, objets: [] }, pi); },
    resilience: async (g, pi) => { const P = g.P(pi), n = P.hand.length; P.discard.push(...P.hand); P.hand = []; await g.draw(pi, n); } },
  "GM1-104": { play: (g, pi) => untapAlly(g, pi), resilience: "play" },

  // ===== Neutre — Moment =====
  "GM1-072": { play: (g, pi) => g.ask(pi, { kind: "info", title: "Main de votre adversaire", cards: g.P(E(g, pi)).hand }), resilience: "play" },
  "GM1-091": { play: (g, pi) => opponentChooses(g, pi, async () => { await g.draw(pi, 3); await g.draw(E(g, pi), 2); },
      async () => { await discardFromHand(g, E(g, pi), 2); await discardFromHand(g, pi, 1); }, "Piochez 3 cartes (l'adversaire en pioche 2)", "L'adversaire défausse 2 cartes (vous en défaussez 1)"), resilience: "play" },
  "GM1-092": { play: (g, pi) => benchEnemyObjet(g, pi),
    resilience: async (g, pi) => { const t = await pickEnemy(g, pi, "Un Joueur adverse sans Objet ne peut plus attaquer", (x) => !x.objets.length); if (t) buff(g, t, { cantAttack: true }, endTurn(g)); } },
  "GM1-093": { play: (g, pi) => g.ask(E(g, pi), { kind: "info", title: "Votre adversaire révèle ses PV", cards: g.P(pi).pv }), resilience: "play" },
  "GM1-094": { play: (g, pi) => { g.flags[`onemore${pi}`] = 1; }, resilience: (g) => g.log("One More : l'adversaire doit déclencher une attaque de plus si possible.") },
  "GM1-095": { play: async (g, pi) => { const L = g.P(pi).lanes, O = g.P(E(g, pi)).lanes; if (L.some((s, i) => s && !O[i])) await g.draw(pi, 2); else g.log("Tunnel : aucun Joueur seul sur sa ligne."); }, resilience: "play" },
  "GM1-096": { play: (g, pi) => { let done = false; g.listen("recoverPV", async (gg, c) => { if (!done && c.pi === E(g, pi)) { done = true; side(gg, E(g, pi), { def: -20 }, gg.turn); } }, endTurn(g)); },
    resilience: async (g, pi) => { const t = await pickEnemy(g, pi, "Un Joueur adverse a -20 Attaque"); if (t) buff(g, t, { atk: -20 }, endTurn(g)); } },
  "GM1-097": { play: (g, pi) => { g.flags[`doigdance${pi}`] = true; },
    resilience: async (g, pi) => { for (let k = 0; k < 2; k++) { const t = await pickAlly(g, pi, `+20 Défense (${k + 1}/2)`); if (t) buff(g, t, { def: 20 }, endTurn(g)); } } },
  "GM1-098": { play: (g, pi) => { const P = g.P(pi), j = P.discard.filter((c) => C(c).category === "Joueur").slice(0, 6); P.discard = P.discard.filter((c) => !j.includes(c)); g.shuffleInto(P.club, j); }, resilience: "play" },
  "GM1-099": { play: (g, pi) => revealTake(g, pi, 6, (c) => c.category === "Moment", "Ajoutez un Moment à votre main"), resilience: "play" },
  "GM1-107": { canPlay: (g, pi) => g.freeEssences(pi).length >= 2, play: async (g, pi) => { if (g.pay(pi, ["Neutre", "Neutre"])) await g.draw(pi, 3); },
    resilience: async (g, pi) => { for (const e of g.P(pi).essences.filter((x) => x.engaged).slice(0, 2)) await g.unengageEssence(pi, e); } },
  "GM1-108": { play: async (g, pi) => { for (const s of g.slots(pi)) await g.removeJoueur(s, "hand"); },
    resilience: async (g, pi) => { const pool = g.P(pi).discard.filter((c) => C(c).category === "Joueur"); const c = await g.ask(pi, { kind: "card", title: "Ajoutez un Joueur de la défausse à votre main", cards: pool, aiPick: "best" }); if (c) { g.P(pi).discard = g.P(pi).discard.filter((x) => x !== c); g.P(pi).hand.push(c); } } },
  "GM1-109": { canPlay: (g, pi) => g.slots(pi).length > 0,
    play: async (g, pi) => { const t = await pickAlly(g, pi, "Hatewatch : bench un de vos Joueurs", () => true, "weakest"); if (t) { await g.removeJoueur(t); await discardFromHand(g, E(g, pi), 1); } }, resilience: "play" },
  "GM1-110": { play: (g, pi) => g.ask(pi, { kind: "info", title: "5 cartes du dessus du Club adverse", cards: g.P(E(g, pi)).club.slice(0, 5) }), resilience: "play" },
  "GM1-111": { play: (g, pi) => { g.flags[`gaminghouse${pi}`] = true; }, resilience: (g, pi) => side(g, pi, { def: 10 }, endTurn(g)) },
  "GM1-114": { play: (g, pi) => g.draw(pi, enemies(g, pi, (x) => x.engaged).length) },
  "GM1-115": { play: async (g, pi) => { const t = await pickAlly(g, pi, "Champions du Monde : quel Joueur ?"); if (t) buff(g, t, { kw: ["RIPOSTE", "SHIELD"] }, endOppTurn(g)); } },
  P01: { play: (g, pi) => majorDeParis(g, pi) },
  P02: { play: (g, pi) => majorDeParis(g, pi) },

  // ===== Neutre — Objets =====
  "GM1-084": { chevaliere: true, resilience: (g, pi) => { g.flags[`chevaliere_malus${E(g, pi)}`] = true; } },
  "GM1-085": { atk: () => 30, resilience: async (g, pi) => { const pool = g.P(pi).discard.filter((c) => C(c).category === "Moment"); const c = await g.ask(pi, { kind: "card", title: "Ajoutez un Moment de la défausse à votre main", cards: pool, aiPick: "best" }); if (c) { g.P(pi).discard = g.P(pi).discard.filter((x) => x !== c); g.P(pi).hand.push(c); } } },
  "GM1-086": { on: { engaged: async (g, s, pi, c, o) => { if (c.slot === s && await g.ask(pi, { kind: "confirm", title: "En slip sur la Faille : bench l'Objet pour désengager ce Joueur (il ne pourra plus attaquer) ?", aiDefault: g.active !== pi })) { await g.benchObjet(pi, o, s); s.engaged = false; s.cantAttackUntil = g.turn; } } },
    resilience: (g, pi) => { g.flags[`enslip${pi}`] = true; } },
  "GM1-087": { def: () => 30, resilience: "play" },
  "GM1-088": { atk: () => 15,
    onAttack: async (g, s, pi) => { const n = await g.ask(pi, { kind: "choice", title: "M4 : défausser des cartes pour +10 Attaque chacune ?", options: [0, 1, 2, 3].filter((k) => k <= g.P(pi).hand.length).map((k) => ({ label: `${k} carte(s)`, value: k })), aiDefault: 0 });
      if (n) { const d = await discardFromHand(g, pi, n); s.tmpAtk = (s.tmpAtk || 0) + 10 * d; } },
    resilience: async (g, pi) => { const P = g.P(pi); if (!P.hand.length) return; const c = await g.ask(pi, { kind: "card", title: "Défaussez une carte", cards: P.hand, aiPick: "worst" });
      removeFromHand(g, pi, c); g.discardCard(pi, c); await g.draw(pi, 1);
      if (C(c).category === "Joueur") { const t = await pickEnemy(g, pi, "Un Joueur adverse a -30 Attaque"); if (t) buff(g, t, { atk: -30 }, endTurn(g)); } } },
  "GM1-089": { def: (g, s) => 10 * objCount(s), resilience: "play" },
  "GM1-090": { on: { attackLine: async (g, s, pi, c) => { if (c.pi === pi && c.lane === g.laneOf(pi, s)) await luxueuse(g, pi); } }, resilience: "play" },
  "GM1-105": { atk: () => 20,
    onDefenderDeclared: async (g, s, pi) => { const top = g.P(pi).club[0]; if (!top) return; g.log(`M16 révèle ${C(top).name}.`); if (C(top).category === "Joueur") s.tmpAtk = (s.tmpAtk || 0) + 20; },
    resilience: async (g, pi) => { const P = g.P(pi), top = P.club[0]; if (top && C(top).category === "Joueur" && g.freeLanes(pi).length) { P.club.shift(); await g.deploy(pi, top, g.freeLanes(pi)[0]); } } },
  "GM1-106": { onDefenderDeclared: async (g, s, pi, o) => {
      if (await g.ask(pi, { kind: "confirm", title: "Trahison++ : bench l'Objet pour désengager le Joueur et annuler l'attaque ?", aiDefault: false })) {
        await g.benchObjet(pi, o, s); s.engaged = false; s.cantAttackUntil = g.turn; g.log("L'attaque est annulée."); return "cancel"; } },
    resilience: async (g, pi) => { const t = await pickEnemy(g, pi, "Un Joueur adverse ne peut plus attaquer ce tour"); if (t) buff(g, t, { cantAttack: true }, endTurn(g)); } },
  "GM1-122": { def: (g, s) => 10 * objCount(s), on: { attackLine: async (g, s, pi, c) => { if (c.pi === pi && c.lane === g.laneOf(pi, s)) await luxueuse(g, pi); } } },
};

async function luxueuse(g, pi) {
  const P = g.P(pi);
  if (P.discard.length) { const c = await g.ask(pi, { kind: "card", title: "La Luxueuse : mélangez une carte de la défausse dans le Club", cards: P.discard, aiPick: "best" }); if (c) { P.discard = P.discard.filter((x) => x !== c); g.shuffleInto(P.club, [c]); } }
  await g.draw(pi, 1);
}
async function returnAndReplace(g, pi, slot) {
  const lane = g.laneOf(pi, slot); if (lane < 0) return;
  await g.removeJoueur(slot, "hand");
  const pool = g.P(pi).hand.filter((c) => C(c).category === "Joueur" && c !== slot.card);
  if (!pool.length) return;
  const c = await g.ask(pi, { kind: "card", title: "Jouez un autre Joueur à sa place ?", cards: pool, allowNone: true, aiPick: "best" });
  if (c) { removeFromHand(g, pi, c); await g.deploy(pi, c, lane); }
}
async function majorDeParis(g, pi) {
  const P = g.P(pi), pool = P.club.filter((c) => C(c).color === "Mauve" && ["Joueur", "Essence"].includes(C(c).category));
  const c = await g.ask(pi, { kind: "card", title: "Major de Paris : cherchez un Joueur ou une Essence Mauve", cards: pool, aiPick: "best" });
  if (c) { P.club = P.club.filter((x) => x !== c); P.hand.push(c); g.log(`${P.name} montre ${C(c).name}.`); }
  g.shuffleInto(P.club, []);
}

// Cartes en double (même texte) : Ravitaillement Rose/Mauve, Champions du Major, Leakof, etc. sont listées ci-dessus par numéro.
// Joueurs sans effet propre (attaques simples) : 023, 025, 035 (Riposte), 051/100/118 (Légion), 057, 058/119 (Provocation), 059 (Shield),
// 074/120 (Garde), 078, 081/121 (Riposte) — gérés par les mots-clés du moteur.
