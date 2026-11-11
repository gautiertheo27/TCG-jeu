// Duel en ligne : les deux navigateurs jouent EXACTEMENT la même partie (même graine, mêmes decks, mêmes décisions).
// Chaque joueur ne décide que pour son siège ; ses actions et ses réponses sont envoyées à l'autre, qui les rejoue.
import { C } from "./engine/core.js";

const ABORT = Symbol("abort");
const encode = (req, v) => {
  switch (req.kind) {
    case "confirm": return !!v;
    case "choice": return v == null ? -1 : req.options.findIndex((o) => o.value === v);
    case "card": return v == null ? -1 : req.cards.indexOf(v);
    case "slot": return v == null ? -1 : req.slots.indexOf(v);
  }
  return null;
};
const decode = (req, e) => {
  switch (req.kind) {
    case "confirm": return !!e;
    case "choice": return e < 0 ? null : req.options[e].value;
    case "card": return e < 0 ? null : req.cards[e];
    case "slot": return e < 0 ? null : req.slots[e];
  }
  return null;
};
const fallback = (req) => (req.kind === "confirm" ? false : null);

export class Sync {
  // net : { send(msg), onMessage(fn), close() } ; humanAsk(req) : la réponse du joueur de CE siège (interface ou IA de test)
  constructor({ seat, net, humanAsk, onForfeit }) {
    this.seat = seat; this.net = net; this.humanAsk = humanAsk; this.onForfeit = onForfeit;
    this.outN = 0; this.inExpected = 0; this.inbuf = new Map(); this.sent = [];
    this.actions = []; this.actionWaiter = null; this.answers = new Map(); this.answerWaiters = new Map(); this.askSeq = 0; this.closed = false;
    net.onMessage((m) => this._recv(m));
    this.hb = setInterval(() => { if (!this.closed) this.net.send({ k: "hb", last: this.outN - 1 }); }, 2000);   // détecte un message perdu
  }
  send(msg) { msg.n = this.outN++; this.sent.push(msg); return Promise.resolve(this.net.send(msg)).catch(() => {}); }
  _recv(m) {
    if (this.closed || !m || typeof m !== "object") return;
    if (!["hb", "resend", "act", "ans", "forfeit"].includes(m.k)) return;       // poignée de main et autres : pas pour la synchronisation
    if (m.k === "hb") { if (m.last >= this.inExpected) this.net.send({ k: "resend", from: this.inExpected }); return; }       // il m'en manque : redemande
    if (m.k === "resend") { for (const x of this.sent) if (x.n >= m.from) this.net.send(x); return; }
    if (m.n < this.inExpected) return;                       // déjà reçu
    this.inbuf.set(m.n, m);
    while (this.inbuf.has(this.inExpected)) { const x = this.inbuf.get(this.inExpected); this.inbuf.delete(this.inExpected); this.inExpected++; this._handle(x); }
  }
  _handle(m) {
    if (m.k === "act") { this.actions.push(m.a); this.actionWaiter?.(); this.actionWaiter = null; }
    else if (m.k === "ans") { this.answers.set(m.seq, m.v); this.answerWaiters.get(m.seq)?.(); this.answerWaiters.delete(m.seq); }
    else if (m.k === "forfeit") this.onForfeit?.();
  }
  // Branche une partie : les actions de MON siège sont envoyées à l'adversaire avant d'être exécutées.
  attach(g) {
    this.g = g; const seat = this.seat, self = this;
    this.orig = { play: g.playFromHand.bind(g), attack: g.attack.bind(g), activate: g.activate.bind(g), combat: g.beginCombat.bind(g) };
    g.playFromHand = (pi, c, o = {}) => { if (pi === seat) self.send({ k: "act", a: { t: "play", uid: c.uid, lane: o.lane } }); return self.orig.play(pi, c, o); };
    g.attack = (pi, s, ai) => { if (pi === seat) self.send({ k: "act", a: { t: "attack", uid: s.uid, ai } }); return self.orig.attack(pi, s, ai); };
    g.activate = (pi, s) => { if (pi === seat) self.send({ k: "act", a: { t: "activate", uid: s.uid } }); return self.orig.activate(pi, s); };
    g.beginCombat = () => { if (g.active === seat) self.send({ k: "act", a: { t: "combat" } }); return self.orig.combat(); };
    g._ask = (game, pi, req) => self.ask(pi, req);
  }
  async ask(pi, req) {
    if (this.closed) return fallback(req);
    if (req.kind === "info") return pi === this.seat ? this.humanAsk(req) : null;      // consultation : visible seulement de celui qui joue
    const seq = this.askSeq++;
    if (pi === this.seat) { const v = await this.humanAsk(req); this.send({ k: "ans", seq, v: encode(req, v) }); return v; }
    if (!this.answers.has(seq)) await new Promise((res) => this.answerWaiters.set(seq, res));
    if (this.closed) return fallback(req);
    const e = this.answers.get(seq); this.answers.delete(seq); return decode(req, e);
  }
  sendEnd() { return this.send({ k: "act", a: { t: "end" } }); }
  forfeit() { return this.send({ k: "forfeit" }); }
  // Tour de l'adversaire : on rejoue ses actions dans l'ordre, jusqu'à la fin de son tour.
  async remoteTurn() {
    const g = this.g, opp = 1 - this.seat, P = g.P(opp);
    while (!this.closed && g.winner === null) {
      if (!this.actions.length) await new Promise((res) => (this.actionWaiter = res));
      if (this.closed) return;
      const a = this.actions.shift();
      if (a.t === "end") return;
      if (a.t === "play") { const c = P.hand.find((x) => x.uid === a.uid); if (c) await this.orig.play(opp, c, a.lane === undefined ? {} : { lane: a.lane }); }
      else if (a.t === "attack") { const s = P.lanes.find((x) => x && x.uid === a.uid); if (s) await this.orig.attack(opp, s, a.ai); }
      else if (a.t === "activate") { const s = P.lanes.find((x) => x && x.uid === a.uid); if (s) await this.orig.activate(opp, s); }
      else if (a.t === "combat") this.orig.combat();
    }
  }
  close() {
    this.closed = true; clearInterval(this.hb);
    this.actionWaiter?.(); this.answerWaiters.forEach((r) => r()); this.answerWaiters.clear();
    try { this.net.close?.(); } catch (_) {}
  }
}
