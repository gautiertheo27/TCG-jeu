// IA : répond aux demandes du moteur et joue ses tours.
import { C, spec, hasResilience } from "./core.js";

const value = (c) => { const k = c.card ? c.card : c; return (k.def || 0) + Math.max(0, ...((k.attacks || []).map((a) => parseInt(a.damage, 10) || 0))) + (k.category === "Joueur" ? 50 : 0); };
const cv = (x) => { const k = C(x); return (k.category === "Essence" ? 5 : value(k)) + (k.category === "Coach" || k.category === "Moment" ? 40 : 0); };

export function aiAnswer(g, pi, req) {
  const none = req.allowNone ? null : undefined;
  switch (req.kind) {
    case "info": return null;
    case "confirm": return req.aiDefault ?? true;
    case "choice": {
      if (req.aiDefault !== undefined) return req.aiDefault;
      return req.allowNone ? null : req.options[0]?.value;
    }
    case "card": {
      const cs = req.cards || []; if (!cs.length) return null;
      const sorted = [...cs].sort((a, b) => cv(a) - cv(b));
      if (req.aiPick === "worst") return sorted[0];
      if (req.aiPick === "best") return sorted[sorted.length - 1];
      return req.allowNone ? null : sorted[sorted.length - 1];
    }
    case "slot": {
      const ss = req.slots || []; if (!ss.length) return null;
      const by = (f) => [...ss].sort((a, b) => f(b) - f(a))[0];
      switch (req.aiPick) {
        case "none": return req.allowNone ? null : ss[0];
        case "weakest": return by((s) => -g.defense(s));
        case "enemyBest": case "strongest": return by((s) => g.defense(s) + Math.max(0, ...C(s).attacks.map((_, i) => g.attackValue(s, i))));
        case "defend": {
          // défend si l'attaque ne vainc pas le défenseur, ou si c'est une menace importante
          const safe = ss.filter((s) => g.defense(s) > req.attackValue);
          if (safe.length) return by((s) => g.defense(s));
          return g.P(pi).pv.length <= 1 ? by((s) => -value(s)) : null;
        }
        case "support": return [...ss].sort((a, b) => g.attackValue(b, 0) - g.attackValue(a, 0)).find((s) => Math.max(...g.attackOptions(pi, s).map((i) => g.attackValue(s, i))) >= req.need) || null;
        default: return req.allowNone ? null : by((s) => g.defense(s));
      }
    }
  }
  return null;
}

// Joue un tour complet pour l'IA (après startTurn). `pause` permet à l'interface d'animer.
export async function aiTurn(g, pi, pause = async () => {}) {
  const P = g.P(pi);
  // Phase d'action
  for (let guard = 0; guard < 25 && g.winner === null; guard++) {
    const playable = P.hand.filter((c) => g.canPlay(pi, c));
    if (!playable.length) break;
    const rank = (c) => { const k = C(c); return k.category === "Joueur" ? 100 + value(k) : k.category === "Objet" ? 60 : k.category === "Coach" ? 40 : 20; };
    const c = playable.sort((a, b) => rank(b) - rank(a))[0];
    const k = C(c);
    // Ne pas gaspiller un Moment/Coach sans cible ou sans intérêt : on les joue seulement quand on a une main chargée.
    if ((k.category === "Moment" || k.category === "Coach") && P.hand.length < 3 && g.winner === null && Math.random() < 0.5) break;
    const ok = await g.playFromHand(pi, c); if (!ok) break;
    await pause();
  }
  for (const s of g.activables(pi)) { if (Math.random() < 0.5) { await g.activate(pi, s); await pause(); } }
  // Phase de combat
  if (g.turn > 1 && g.winner === null) {
    g.beginCombat();
    for (let guard = 0; guard < 12 && g.winner === null; guard++) {
      const cands = g.slots(pi).filter((s) => g.canAttack(pi, s));
      let best = null;
      for (const s of cands) for (const i of g.attackOptions(pi, s)) {
        const lane = g.laneOf(pi, s), tgt = g.forcedTarget(pi, s) || g.P(1 - pi).lanes[lane];
        const v = g.attackValue(s, i); let score = v;
        if (!tgt) score += 200; else if (v >= g.defense(tgt)) score += 120; else score -= 40;
        score -= g.attackCost(pi, s, i).length * 5;
        if (!best || score > best.score) best = { s, i, score };
      }
      if (!best || best.score < 0) break;
      await g.attack(pi, best.s, best.i); await pause();
    }
  }
}
