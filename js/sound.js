// Sons du jeu, synthétisés avec Web Audio (aucun fichier audio, donc aucun droit à gérer).
// Découpe du paquet, distribution, retournement, et jingles de rareté : Rare < Épique < Légendaire.
let ctx = null, master = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem("gmtcg.mute") === "1"; } catch (_) {}

export const isMuted = () => muted;
export function setMuted(m) { muted = !!m; try { localStorage.setItem("gmtcg.mute", m ? "1" : "0"); } catch (_) {} if (master) master.gain.value = muted ? 0 : 0.55; }

// Les navigateurs exigent un geste de l'utilisateur avant de produire du son.
export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  } catch (_) { return false; }
}
const ok = () => ctx && !muted && ctx.state !== "closed";

// bruit filtré avec enveloppe (froissement, souffle, déchirure)
function noise(t, dur, { type = "bandpass", f0 = 1200, f1 = f0, q = 1, gain = 0.25, attack = 0.005 } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
// note avec enveloppe (cloche / harpe)
function tone(t, freq, dur, { type = "sine", gain = 0.18, slideTo = null, attack = 0.006, vibrato = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  if (vibrato) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = vibrato; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const bell = (t, f, dur, gain) => { tone(t, f, dur, { type: "sine", gain }); tone(t, f * 2.01, dur * 0.7, { type: "sine", gain: gain * 0.4 }); tone(t, f * 3.02, dur * 0.4, { type: "triangle", gain: gain * 0.2 }); };
const sparkle = (t, n, span, gain = 0.07) => { for (let i = 0; i < n; i++) tone(t + Math.random() * span, 2200 + Math.random() * 3500, 0.18 + Math.random() * 0.2, { type: "sine", gain }); };
const now = () => ctx.currentTime + 0.01;

export const sfx = {
  // Paquet qu'on déchire : souffle montant + petits craquements
  tear() {
    if (!ok()) return; const t = now();
    noise(t, 0.55, { type: "bandpass", f0: 700, f1: 6500, q: 0.8, gain: 0.32 });
    noise(t + 0.02, 0.4, { type: "highpass", f0: 2500, f1: 9000, gain: 0.12 });
    for (let i = 0; i < 9; i++) noise(t + 0.03 + i * 0.045 + Math.random() * 0.02, 0.03, { type: "bandpass", f0: 3000 + Math.random() * 3000, q: 4, gain: 0.2 });
    tone(t + 0.45, 330, 0.25, { type: "triangle", gain: 0.07, slideTo: 660 });
  },
  // Cartes qui arrivent sur la pile
  deal(i = 0) {
    if (!ok()) return; const t = now() + i * 0.055;
    noise(t, 0.05, { type: "bandpass", f0: 2600, f1: 1800, q: 2, gain: 0.14 }); tone(t, 210, 0.06, { type: "sine", gain: 0.08, slideTo: 150 });
  },
  // Carte qu'on retourne : froissement + petit « clac », puis jingle selon la rareté
  flip(rarity = "C") {
    if (!ok()) return; const t = now();
    noise(t, 0.11, { type: "bandpass", f0: 1500, f1: 6500, q: 1.2, gain: 0.26 }); noise(t + 0.09, 0.05, { type: "bandpass", f0: 2200, q: 3, gain: 0.18 });
    tone(t + 0.1, 150, 0.08, { type: "sine", gain: 0.14, slideTo: 90 });
    const j = JINGLE[rarity]; if (j) j(t + 0.14);
  },
  // Carte écartée
  dismiss() { if (!ok()) return; noise(now(), 0.16, { type: "lowpass", f0: 3200, f1: 500, q: 0.7, gain: 0.16 }); },
  // Fin d'ouverture, petite fanfare (plus belle si on a tiré une grosse carte)
  fanfare(best = "C") {
    if (!ok()) return; const t = now(), big = ["E", "L", "P"].includes(best), notes = big ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    notes.forEach((f, i) => bell(t + i * 0.09, f, 0.6, 0.1));
  },
  tap() { if (!ok()) return; tone(now(), 880, 0.08, { type: "triangle", gain: 0.06, slideTo: 660 }); },
};

// Jingles de rareté. Commune / peu commune / essence : juste le froissement.
const JINGLE = {
  // Rare : deux notes claires
  R(t) { bell(t, 659, 0.5, 0.13); bell(t + 0.11, 880, 0.7, 0.13); },
  // Épique : arpège ascendant brillant qui scintille, avec une basse chaude
  E(t) {
    [392, 523, 659, 784, 1047].forEach((f, i) => bell(t + i * 0.085, f, 0.9, 0.15));
    tone(t, 196, 0.9, { type: "triangle", gain: 0.12, slideTo: 262 });
    noise(t, 0.7, { type: "bandpass", f0: 1500, f1: 7000, q: 1, gain: 0.1 });
    sparkle(t + 0.2, 7, 0.7, 0.08);
  },
  // Légendaire : montée dramatique, grand accord, cloche profonde et pluie d'étincelles
  L(t) {
    noise(t - 0.1, 0.5, { type: "bandpass", f0: 400, f1: 8000, q: 0.9, gain: 0.2 });
    tone(t - 0.1, 110, 0.55, { type: "sawtooth", gain: 0.05, slideTo: 440 });
    const c = t + 0.4;
    [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => { bell(c + i * 0.03, f, 1.8, 0.13); });
    tone(c, 131, 1.6, { type: "triangle", gain: 0.2, slideTo: 124 });         // basse
    tone(c, 65, 1.2, { type: "sine", gain: 0.25, slideTo: 48 });              // impact grave
    noise(c, 0.35, { type: "lowpass", f0: 900, f1: 120, q: 0.6, gain: 0.3 });
    [1568, 2093, 2637].forEach((f, i) => bell(c + 0.25 + i * 0.12, f, 1.3, 0.07));
    sparkle(c, 16, 1.4, 0.07);
  },
};
JINGLE.P = JINGLE.L;
