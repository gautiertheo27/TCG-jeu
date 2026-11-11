// Moteur de règles officiel du TCG Gentle Mates (voir docs/regles/regles-du-jeu.txt).
// Le moteur est asynchrone : chaque choix passe par `g.ask(pi, req)`, résolu par l'interface (humain) ou l'IA.
import { BY_ID } from "../cards.js";
import { SPECS } from "./effects.js";

export const LANES = 3;
export const HAND_MAX = 5;
export const PV_COUNT = 4;

let UID = 1;
export const inst = (id) => ({ uid: UID++, id });          // (utilisé seulement par les tests ; chaque partie a son propre compteur)
// Générateur pseudo-aléatoire à graine : deux navigateurs qui reçoivent la même graine jouent exactement la même partie.
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const C = (x) => BY_ID[x.id];
export const spec = (x) => SPECS[x.id] || {};

// Mots-clés lus sur la carte (le texte commence par le mot-clé).
const KW = ["PROVOCATION", "GARDE", "BUFF", "RIPOSTE", "LÉGION", "SHIELD"];
export function baseKeywords(card) {
  const e = (card.effect || "").toUpperCase();
  return KW.filter((k) => e.startsWith(k) || e.includes(`| ${k}`));
}
export const hasResilience = (card) => card.category !== "Joueur" && card.category !== "Essence" && /Résilience/i.test(card.effect || "");

export class Game {
  constructor({ decks, names, ai, ask, onUpdate, log, seed = null }) {
    this.rand = seed === null ? Math.random : mulberry32(seed);      // aléatoire propre à la partie (reproductible avec une graine)
    this.uidn = 1; const mk = (id) => ({ uid: this.uidn++, id });   // identifiants propres à la partie
    this.players = [0, 1].map((i) => ({
      i, name: names[i], isAI: !!ai[i],
      club: this.shuffle(decks[i].club.map(mk)), reserve: this.shuffle(decks[i].reserve.map(mk)),
      hand: [], pv: [], discard: [], essences: [], lanes: [null, null, null],
      coachPlayed: false, benchSwapUsed: false, pvRecoveredThisTurn: 0, attacksThisTurn: 0,
    }));
    this.turn = 0; this.active = 0; this.phase = "setup"; this.winner = null;
    this.mods = []; this.listeners = []; this.flags = {};
    this._ask = ask; this._update = onUpdate || (() => {}); this._log = log || (() => {});
  }

  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // ---------- utilitaires ----------
  P(pi) { return this.players[pi]; }
  opp(pi) { return 1 - pi; }
  log(msg) { this._log(msg); }
  update() { this._update(this); }
  async ask(pi, req) {
    if (this.winner !== null) return req.allowNone ? null : req.options?.[0]?.value;
    if (req.options && !req.options.length) return null;
    return this._ask(this, pi, req);
  }
  slots(pi) { return this.P(pi).lanes.filter(Boolean); }
  laneOf(pi, slot) { return this.P(pi).lanes.indexOf(slot); }
  ownerOf(slot) { return this.P(0).lanes.includes(slot) ? 0 : this.P(1).lanes.includes(slot) ? 1 : -1; }
  freeLanes(pi) { return [0, 1, 2].filter((l) => !this.P(pi).lanes[l]); }

  // ---------- modificateurs temporaires ----------
  // until = numéro du tour à la fin duquel l'effet expire (this.turn = fin du tour, this.turn + 1 = fin du tour adverse)
  addMod(m) { this.mods.push(m); }
  listen(event, fn, until) { const l = { event, fn, until }; this.listeners.push(l); return l; }
  expire() {
    this.mods = this.mods.filter((m) => m.until > this.turn && (!m.slot || this.ownerOf(m.slot) >= 0));
    this.listeners = this.listeners.filter((l) => l.until > this.turn);
  }

  keywords(slot) {
    const pi = this.ownerOf(slot); const set = new Set(baseKeywords(C(slot)));
    for (const o of slot.objets) for (const k of spec(o).grantKw?.(this, slot, pi) || []) set.add(k);
    for (const k of spec(slot).dynKw?.(this, slot, pi) || []) set.add(k);
    for (const m of this.mods) if (m.kw && this._modHits(m, slot, pi)) m.kw.forEach((k) => set.add(k));
    return set;
  }
  _modHits(m, slot, pi) { return m.slot ? m.slot === slot : m.side === pi && (!m.filter || m.filter(slot, this)); }

  atkBonus(slot) {
    const pi = this.ownerOf(slot); let b = 0;
    for (const o of slot.objets) b += spec(o).atk?.(this, slot, pi) ?? 0;
    for (const other of this.slots(pi)) if (other !== slot) b += spec(other).buffAtk || 0;
    for (const m of this.mods) if (m.atk && this._modHits(m, slot, pi)) b += m.atk;
    return b;
  }
  defense(slot) {
    const pi = this.ownerOf(slot); let d = C(slot).def || 0;
    for (const o of slot.objets) d += spec(o).def?.(this, slot, pi) ?? 0;
    for (const other of this.slots(pi)) if (other !== slot) d += spec(other).buffDef || 0;
    for (const m of this.mods) if (m.def && this._modHits(m, slot, pi)) d += m.def;
    return Math.max(0, d);
  }
  attackValue(slot, ai) {
    const card = C(slot), pi = this.ownerOf(slot), a = card.attacks[ai];
    let v = parseInt(a.damage, 10) || 0;
    v += spec(slot).attackPlus?.(this, slot, pi, ai) ?? 0;
    v += this.atkBonus(slot);
    for (const m of this.mods) if (m.attackBonus && this._modHits(m, slot, pi)) v += m.attackBonus;
    if (spec(slot).doubleIf?.(this, slot, pi)) v *= 2;
    return Math.max(0, v);
  }

  // ---------- coûts en Essence ----------
  attackCost(pi, slot, ai, { riposte = false } = {}) {
    let cost = [...(C(slot).attacks[ai].cost || [])];
    const P = this.P(pi);
    if (riposte && cost.length) { const k = cost.lastIndexOf("Neutre"); cost.splice(k >= 0 ? k : cost.length - 1, 1); }
    if (this.flags[`doigdance${pi}`] && P.attacksThisTurn === 0) { const k = cost.indexOf("Neutre"); if (k >= 0) cost.splice(k, 1); }
    if (this.flags[`gaminghouse${pi}`] && P.attacksThisTurn === 1) { let n = 2; cost = cost.filter((c) => (c !== "Neutre" && n > 0 ? (n--, false) : true)); }
    if (this.flags[`chevaliere_malus${pi}`]) cost.push("Neutre");
    return cost;
  }
  // Renvoie la liste des Essences à engager pour payer `cost`, ou null si impossible.
  payment(pi, cost) {
    const free = this.P(pi).essences.filter((e) => !e.engaged);
    const used = new Set(); const pick = [];
    for (const col of cost.filter((c) => c !== "Neutre")) {
      const e = free.find((x) => !used.has(x) && C(x.card).color === col);
      if (!e) return null; used.add(e); pick.push(e);
    }
    const counts = {}; for (const e of free) if (!used.has(e)) counts[C(e.card).color] = (counts[C(e.card).color] || 0) + 1;
    for (let n = cost.filter((c) => c === "Neutre").length; n > 0; n--) {
      // paie le Neutre avec la couleur la plus abondante restante
      const e = free.filter((x) => !used.has(x)).sort((a, b) => counts[C(b.card).color] - counts[C(a.card).color])[0];
      if (!e) return null; used.add(e); counts[C(e.card).color]--; pick.push(e);
    }
    return pick;
  }
  pay(pi, cost) { const p = this.payment(pi, cost); if (!p) return false; p.forEach((e) => (e.engaged = true)); return true; }
  hasEssenceColor(pi, color) { return this.P(pi).essences.some((e) => C(e.card).color === color); }
  freeEssences(pi) { return this.P(pi).essences.filter((e) => !e.engaged); }

  // ---------- pioche / piles ----------
  async draw(pi, n = 1) {
    const P = this.P(pi);
    if (this.flags[`onemore${pi}`]) n += this.flags[`onemore${pi}`] * n;
    for (let k = 0; k < n; k++) {
      if (!P.club.length) { this.lose(pi, `${P.name} ne peut plus piocher dans son Club`); return; }
      P.hand.push(P.club.shift());
    }
  }
  shuffleInto(pile, cards) { pile.push(...cards); this.shuffle(pile); }
  discardCard(pi, c) { this.P(pi).discard.push(c); }

  // ---------- engager / désengager ----------
  async engage(slot) {
    if (!slot || slot.engaged) return; slot.engaged = true;
    await this.emit("engaged", { pi: this.ownerOf(slot), slot });
  }
  async unengage(slot) {
    if (!slot || !slot.engaged) return; slot.engaged = false;
    await this.emit("unengageJoueur", { pi: this.ownerOf(slot), slot });
  }
  async unengageEssence(pi, e) {
    if (!e || !e.engaged) return; e.engaged = false;
    await this.emit("unengageEssence", { pi, e });
  }

  // ---------- déploiement ----------
  async deploy(pi, card, lane, { fromEffect = false } = {}) {
    const P = this.P(pi);
    const slot = { uid: card.uid, id: card.id, card, engaged: false, objets: [], shieldUsed: false, cantAttackUntil: 0 };
    P.lanes[lane] = slot;
    this.log(`${P.name} déploie ${C(card).name} (case ${lane + 1}).`);
    this.update();
    if (spec(slot).onDeploy) await spec(slot).onDeploy(this, slot, pi);
    await this.emit("oppPlayJoueur", { pi: this.opp(pi), slot, by: pi });
    return slot;
  }
  // Retire un Joueur du Terrain (bench = défausse, hand = main, club = Club). Ses Objets sont bench.
  async removeJoueur(slot, where = "bench") {
    const pi = this.ownerOf(slot); if (pi < 0) return;
    const P = this.P(pi); const lane = P.lanes.indexOf(slot);
    P.lanes[lane] = null;
    for (const o of slot.objets) await this.benchObjet(pi, o, null);
    slot.objets = [];
    if (where === "hand") P.hand.push(slot.card);
    else if (where === "club") this.shuffleInto(P.club, [slot.card]);
    else P.discard.push(slot.card);
    this.mods = this.mods.filter((m) => m.slot !== slot);
  }
  async benchObjet(pi, o, slot) {
    if (slot) slot.objets = slot.objets.filter((x) => x !== o);
    if (this.flags[`enslip${pi}`]) this.P(pi).hand.push(o); else this.P(pi).discard.push(o);
  }
  async linkObjet(pi, o, slot) {
    slot.objets.push(o);
    this.log(`${this.P(pi).name} lie ${C(o).name} à ${C(slot).name}.`);
    if (spec(slot).onLink) await spec(slot).onLink(this, slot, pi, o);
    await this.emit("linkObjet", { pi, slot, objet: o });
  }

  // Joueur vaincu : Invitation, Riposte, Légion, puis bench.
  async vanquish(victim, killer) {
    const vpi = this.ownerOf(victim); if (vpi < 0) return;
    const inv = victim.objets.find((o) => spec(o).saveOnVanquish);
    if (inv && await this.ask(vpi, { kind: "confirm", title: `Bench ${C(inv).name} à la place de ${C(victim).name} ?`, aiDefault: true })) {
      await this.benchObjet(vpi, inv, victim); this.log(`${C(inv).name} est bench à la place de ${C(victim).name}.`); return;
    }
    this.log(`${C(victim).name} est vaincu.`);
    const kw = this.keywords(victim);
    if (kw.has("RIPOSTE") && killer && this.ownerOf(killer) >= 0) await this.riposte(vpi, victim, killer);
    let where = "bench";
    if (kw.has("LÉGION")) {
      if (spec(victim).legionFree) where = "hand";
      else if (this.P(vpi).hand.length) {
        const c = await this.ask(vpi, { kind: "card", title: `Légion : défausser une carte pour récupérer ${C(victim).name} ?`, cards: this.P(vpi).hand, allowNone: true, aiPick: "worst" });
        if (c) { this.P(vpi).hand = this.P(vpi).hand.filter((x) => x !== c); this.discardCard(vpi, c); where = "hand"; }
      }
    }
    await this.removeJoueur(victim, where);
    if (killer && this.ownerOf(killer) >= 0) await this.emit("vanquish", { pi: this.ownerOf(killer), killer, victim, victimPi: vpi });
  }
  async riposte(vpi, victim, attacker) {
    const card = C(victim);
    let choices = card.attacks.map((a, i) => i);
    if (spec(victim).riposteFree) {
      const best = choices.sort((a, b) => this.attackValue(victim, b) - this.attackValue(victim, a))[0];
      return this._riposteHit(victim, best, attacker);
    }
    choices = choices.filter((i) => this.payment(vpi, this.attackCost(vpi, victim, i, { riposte: true })));
    if (!choices.length) return;
    const ai = await this.ask(vpi, { kind: "choice", title: `Riposte de ${card.name} ?`, allowNone: true, aiDefault: choices[0],
      options: choices.map((i) => ({ label: `${card.attacks[i].name} (${this.attackValue(victim, i)})`, value: i })) });
    if (ai === null || ai === undefined) return;
    this.pay(vpi, this.attackCost(vpi, victim, ai, { riposte: true }));
    await this._riposteHit(victim, ai, attacker);
  }
  async _riposteHit(victim, ai, attacker) {
    const v = this.attackValue(victim, ai), d = this.defense(attacker);
    this.log(`Riposte : ${C(victim).name} frappe ${C(attacker).name} (${v} contre Def ${d}).`);
    if (v >= d) await this.vanquish(attacker, null);
  }

  // ---------- événements (capacités réactives) ----------
  async emit(event, ctx) {
    for (const pi of [0, 1]) for (const slot of [...this.slots(pi)]) {
      if (this.ownerOf(slot) < 0) continue;
      const h = spec(slot).on?.[event]; if (h) await h(this, slot, pi, ctx);
      for (const o of [...slot.objets]) { const ho = spec(o).on?.[event]; if (ho) await ho(this, slot, pi, ctx, o); }
    }
    for (const l of [...this.listeners]) if (l.event === event && this.listeners.includes(l)) await l.fn(this, ctx, l);
  }

  // ---------- partie ----------
  async setup() {
    for (const P of this.players) {
      P.hand = P.club.splice(0, 5);
      const redo = await this.ask(P.i, { kind: "confirm", title: "Main de départ : la remélanger et repiocher 5 cartes ?", cards: P.hand, aiDefault: !P.hand.some((c) => C(c).category === "Joueur") });
      if (redo) { this.shuffleInto(P.club, P.hand); P.hand = P.club.splice(0, 5); }
      P.pv = P.club.splice(0, PV_COUNT);
    }
    this.active = this.rand() < 0.5 ? 0 : 1;
    this.log(`${this.P(this.active).name} commence la partie.`);
  }

  lose(pi, why) { if (this.winner === null) { this.winner = this.opp(pi); this.log(`🏆 ${this.P(this.winner).name} gagne : ${why}.`); this.update(); } }

  async startTurn() {
    this.turn++; const pi = this.active, P = this.P(pi);
    P.coachPlayed = false; P.benchSwapUsed = false; P.attacksThisTurn = 0;
    this.players.forEach((x) => (x.pvRecoveredThisTurn = 0));
    this.phase = "entretien"; this.log(`— Tour ${this.turn} : ${P.name} —`);
    await this.draw(pi, 1); if (this.winner !== null) return;
    for (const s of this.slots(pi)) await this.unengage(s);
    for (const e of P.essences) await this.unengageEssence(pi, e);
    if (P.reserve.length) { const e = P.reserve.shift(); P.essences.push({ card: e, engaged: false }); this.log(`${P.name} joue ${C(e).name}.`); }
    this.phase = "action"; this.update();
  }
  async endTurn() {
    const pi = this.active, P = this.P(pi);
    this.phase = "fin";
    while (P.hand.length > HAND_MAX && this.winner === null) {
      const c = await this.ask(pi, { kind: "card", title: `Fin de tour : défaussez jusqu'à ${HAND_MAX} cartes`, cards: P.hand, aiPick: "worst" });
      P.hand = P.hand.filter((x) => x !== (c || P.hand[0])); this.discardCard(pi, c || P.hand[0]);
    }
    if (this.flags.worldsJaponBench) { for (const s of this.flags.worldsJaponBench) if (this.ownerOf(s) >= 0) await this.removeJoueur(s); delete this.flags.worldsJaponBench; }
    for (const k of Object.keys(this.flags)) if (k.endsWith(String(pi)) || k.endsWith("_t")) delete this.flags[k];
    this.expire();
    this.active = this.opp(pi); this.update();
  }

  // ---------- jouer une carte depuis la main ----------
  canPlay(pi, c) {
    const card = C(c), P = this.P(pi);
    if (this.phase !== "action" || this.active !== pi) return false;
    if (card.category === "Essence") return false;
    if (card.category === "Joueur") return this.freeLanes(pi).length > 0 || (!P.benchSwapUsed && this.slots(pi).some((s) => !s.engaged));
    if (card.color !== "Neutre" && !this.hasEssenceColor(pi, card.color)) return false;
    if (card.category === "Coach" && P.coachPlayed) return false;
    if (card.category === "Objet") return this.slots(pi).length > 0;
    return spec(c).canPlay ? spec(c).canPlay(this, pi) : true;
  }
  async playFromHand(pi, c, opts = {}) {
    if (!this.canPlay(pi, c)) return false;
    const P = this.P(pi), card = C(c);
    P.hand = P.hand.filter((x) => x !== c);
    if (card.category === "Joueur") {
      let lane = opts.lane ?? this.freeLanes(pi)[0];
      if (lane === undefined || P.lanes[lane]) {
        const victim = await this.ask(pi, { kind: "slot", title: "Aucune case libre : quel Joueur non engagé bench ?", slots: this.slots(pi).filter((s) => !s.engaged), aiPick: "weakest" });
        if (!victim) { P.hand.push(c); return false; }
        lane = this.laneOf(pi, victim); await this.removeJoueur(victim); P.benchSwapUsed = true;
      }
      await this.deploy(pi, c, lane);
    } else if (card.category === "Objet") {
      const target = opts.slot || await this.ask(pi, { kind: "slot", title: `Lier ${card.name} à quel Joueur ?`, slots: this.slots(pi), aiPick: spec(c).aiTarget || "strongest" });
      if (!target) { P.hand.push(c); return false; }
      await this.linkObjet(pi, c, target);
    } else {
      if (card.category === "Coach") P.coachPlayed = true;
      this.log(`${P.name} joue ${card.name}.`);
      if (spec(c).play) await spec(c).play(this, pi, c);
      this.discardCard(pi, c);
    }
    this.update(); return true;
  }

  beginCombat() { this.phase = "combat"; this.update(); }
  // ---------- combat ----------
  canAttack(pi, slot) {
    return this.phase === "combat" && this.active === pi && !slot.engaged && !(slot.cantAttackUntil >= this.turn)
      && !this.mods.some((m) => m.cantAttack && this._modHits(m, slot, pi));
  }
  attackOptions(pi, slot) {
    return C(slot).attacks.map((a, i) => i).filter((i) => this.payment(pi, this.attackCost(pi, slot, i)));
  }
  // Joueur adverse que l'attaquant est obligé de cibler (Provocation / SLAY / 99% Faith).
  forcedTarget(pi, slot) {
    const lane = this.laneOf(pi, slot), o = this.P(this.opp(pi)).lanes[lane];
    return o && this.keywords(o).has("PROVOCATION") ? o : null;
  }
  async attack(pi, slot, ai) {
    if (!this.canAttack(pi, slot) || this.winner !== null) return;
    const P = this.P(pi), O = this.P(this.opp(pi)), opi = this.opp(pi), card = C(slot), lane = this.laneOf(pi, slot);
    let cost = this.attackCost(pi, slot, ai);
    // La Chevalière : payer 2 Neutre à la place
    const chev = slot.objets.find((o) => spec(o).chevaliere);
    if (chev && await this.ask(pi, { kind: "confirm", title: `Bench ${C(chev).name} pour que l'attaque coûte 2 Essences Neutres ?`, aiDefault: cost.length > 2 })) {
      await this.benchObjet(pi, chev, slot); cost = ["Neutre", "Neutre"];
    }
    if (!this.pay(pi, cost)) return;
    const first = P.attacksThisTurn === 0; P.attacksThisTurn++;
    const lyon = this.flags[`lyon${pi}`] && slot.objets.length && !slot.lyonUsed;
    if (lyon) slot.lyonUsed = true; else await this.engage(slot);
    const atk = card.attacks[ai];
    this.log(`${P.name} attaque avec ${card.name} : ${atk.name}.`);
    await this.emit("attackLine", { pi: opi, lane, attacker: slot });
    // M4 : défausser jusqu'à 3 cartes pour +10 chacune
    for (const o of slot.objets) if (spec(o).onAttack) await spec(o).onAttack(this, slot, pi, o);
    const fx = spec(slot).attackFx?.[ai];
    if (fx) await fx(this, slot, pi);
    if (this.ownerOf(slot) < 0 || this.winner !== null) return;

    let target = this.forcedTarget(pi, slot);
    const jus = slot.objets.some((o) => spec(o).canHitLine) && O.lanes[lane];
    if (!target && jus && await this.ask(pi, { kind: "confirm", title: `Cibler ${C(O.lanes[lane]).name} (Jus de bagarre) plutôt que le CEO ?`, aiDefault: this.attackValue(slot, ai) >= this.defense(O.lanes[lane]) })) target = O.lanes[lane];
    let killed = false;
    if (target) {
      killed = await this.hitJoueur(pi, slot, ai, target, 0);
    } else {
      // Le CEO adverse peut déclarer un défenseur sur la même ligne (ou Garde)
      const noDefLane = this.mods.some((m) => m.noDefendFrom === slot);
      const defenders = this.slots(opi).filter((s) => !s.engaged && (this.keywords(s).has("GARDE") || (this.laneOf(opi, s) === lane && !noDefLane)));
      let def = defenders.length ? await this.ask(opi, { kind: "slot", title: `${card.name} attaque (${this.attackValue(slot, ai)}). Déclarer un défenseur ?`, slots: defenders, allowNone: true, aiPick: "defend", attackValue: this.attackValue(slot, ai) }) : null;
      if (def) {
        await this.engage(def);
        def = await this.permutation(opi, def);
        this.log(`${O.name} défend avec ${C(def).name}.`);
        for (const o of [...slot.objets]) if (spec(o).onDefenderDeclared) { const r = await spec(o).onDefenderDeclared(this, slot, pi, o); if (r === "cancel") return; }
        // Soutien : un Joueur adjacent de l'attaquant peut ajouter sa valeur d'attaque
        let support = 0;
        const sups = this.slots(pi).filter((s) => s !== slot && !s.engaged && Math.abs(this.laneOf(pi, s) - lane) === 1 && this.attackOptions(pi, s).length);
        if (sups.length) {
          const need = this.defense(def) - this.attackValue(slot, ai);
          const s = await this.ask(pi, { kind: "slot", title: "Engager un Joueur adjacent en soutien ?", slots: sups, allowNone: true, aiPick: need > 0 ? "support" : "none", need });
          if (s) {
            const sai = this.attackOptions(pi, s).sort((a, b) => this.attackValue(s, b) - this.attackValue(s, a))[0];
            this.pay(pi, this.attackCost(pi, s, sai)); await this.engage(s); support = this.attackValue(s, sai);
            this.log(`${C(s).name} soutient l'attaque (+${support}).`);
          }
        }
        killed = await this.hitJoueur(pi, slot, ai, def, support);
      } else {
        await this.hitCEO(pi, slot);
      }
    }
    if (first) { this.flags[`firstAttack${pi}`] = { slot, killed }; await this.emit("firstAttackDone", { pi, slot, killed }); }
    if (spec(slot).afterAttack?.[ai] && this.ownerOf(slot) >= 0) await spec(slot).afterAttack[ai](this, slot, pi);
    this.update();
  }
  async permutation(opi, def) {
    if (!spec(def).permutation) return def;
    const others = this.slots(opi).filter((s) => s !== def && s.engaged);
    if (!others.length) return def;
    const o = await this.ask(opi, { kind: "slot", title: "Permutation : renvoyer Meet & Greeter dans le Club et faire défendre un Joueur engagé ?", slots: others, allowNone: true, aiPick: "none" });
    if (!o) return def;
    const lane = this.laneOf(opi, def), from = this.laneOf(opi, o);
    await this.removeJoueur(def, "club"); this.P(opi).lanes[from] = null; this.P(opi).lanes[lane] = o;
    return o;
  }
  // Compare l'attaque à la Défense ; renvoie true si le Joueur ciblé est vaincu.
  async hitJoueur(pi, slot, ai, target, support) {
    if (this.keywords(target).has("SHIELD") && !target.shieldUsed) {
      target.shieldUsed = true; this.log(`Shield : ${C(target).name} ignore l'attaque.`); return false;
    }
    const v = this.attackValue(slot, ai) + support + (slot.tmpAtk || 0), d = this.defense(target); slot.tmpAtk = 0;
    this.log(`${v} contre Def ${d}.`);
    if (v >= d) { await this.vanquish(target, slot); return true; }
    return false;
  }
  async hitCEO(pi, slot) {
    const opi = this.opp(pi), O = this.P(opi);
    if (!O.pv.length) { this.lose(opi, `${C(slot).name} touche le CEO adverse qui n'a plus de Point de Victoire`); return; }
    const top = O.pv.shift();
    this.log(`${C(slot).name} touche le CEO de ${O.name} !`);
    if (spec(slot).nukePV?.(this, slot, pi)) { this.discardCard(opi, top); this.log("Le PV est défaussé sans être regardé."); }
    else if (hasResilience(C(top)) && await this.ask(opi, { kind: "confirm", title: `Résilience : révéler ${C(top).name} et déclencher son effet ?`, cards: [top], aiDefault: true })) {
      this.log(`${O.name} déclenche la Résilience de ${C(top).name}.`);
      const r = spec(top).resilience;
      if (r === "play") await this.playFree(opi, top); else { if (r) await r(this, opi, top); this.discardCard(opi, top); }
    } else O.hand.push(top);
    O.pvRecoveredThisTurn++;
    await this.emit("recoverPV", { pi: opi, attacker: slot, attackerPi: pi });
  }
  // « Jouez cette carte » (Résilience) : effet de la carte sans coût ni restriction.
  async playFree(pi, c) {
    const card = C(c);
    if (card.category === "Objet") {
      const t = await this.ask(pi, { kind: "slot", title: `Lier ${card.name} à quel Joueur ?`, slots: this.slots(pi), aiPick: "strongest" });
      if (t) return this.linkObjet(pi, c, t);
    } else if (card.category === "Joueur") {
      const lane = this.freeLanes(pi)[0];
      if (lane !== undefined) return this.deploy(pi, c, lane);
    } else if (spec(c).play) await spec(c).play(this, pi, c);
    this.discardCard(pi, c);
  }

  // ---------- capacités activables (Instalock) ----------
  activables(pi) { return this.slots(pi).filter((s) => spec(s).activate && !s.engaged && this.phase === "action" && this.active === pi); }
  async activate(pi, slot) { if (spec(slot).activate) { await spec(slot).activate(this, slot, pi); this.update(); } }
}
