import { C } from "./engine/core.js";
// Mode tuto : pages d'explication + conseils contextuels pendant une partie guidée contre l'IA.
export const TUTO_PAGES = [
  { title: "But du jeu", html: `<p>Tu es le <b>CEO d'un club</b>. Pour gagner, <b>touche le CEO adverse alors qu'il n'a plus aucun Point de Victoire</b> (PV), ou fais en sorte que ton adversaire <b>ne puisse plus piocher</b>.</p>
    <p>Chacun commence avec <b>4 PV</b>. Quand un de tes PV est touché, tu récupères la carte en main : tu perds un « bouclier » mais tu gagnes une carte.</p>` },
  { title: "Le plateau", html: `<ul><li><b>Terrain</b> : 3 cases où tu déploies tes Joueurs.</li><li><b>Essences</b> : ta ressource. Chaque tour, une Essence de ta <b>Réserve</b> (10 cartes) arrive ici. Attaquer ou jouer une carte en consomme (elle s'engage, puis se dégage au tour suivant).</li>
    <li><b>Club</b> : ta pioche (40 cartes). <b>Défausse</b> : les cartes jouées ou vaincues (touche la pile pour la voir).</li><li><b>Points de Victoire</b> : tes 4 cercles roses. <b>Main</b> : 5 cartes maximum en fin de tour.</li></ul>` },
  { title: "Un tour de jeu", html: `<ol><li><b>Entretien</b> (automatique) : tu pioches 1 carte, tes cartes engagées se redressent, une nouvelle Essence arrive.</li>
    <li><b>Action</b> : déploie un Joueur, lie un Objet, joue un Coach (1 par tour) ou un Moment.</li><li><b>Combat</b> : fais attaquer tes Joueurs (pas au tout premier tour de la partie).</li><li><b>Fin</b> : défausse jusqu'à 5 cartes en main, puis c'est à l'adversaire.</li></ol>` },
  { title: "Les cartes", html: `<ul><li><b>Joueur</b> : a une <b>Défense</b> (🛡) et des attaques qui coûtent des Essences.</li><li><b>Objet</b> : se lie à un Joueur pour le renforcer.</li><li><b>Coach</b> : effet immédiat, 1 seul par tour.</li><li><b>Moment</b> : effet instantané.</li><li><b>Essence</b> : ressource, arrive toute seule depuis la Réserve.</li></ul>
    <p>Objets, Coachs et Moments demandent une <b>Essence de leur couleur</b> déjà sur ton Terrain (les cartes Neutres n'en demandent pas).</p>` },
  { title: "Combattre", html: `<p>Choisis un Joueur prêt, puis une attaque : il s'<b>engage</b> (il se couche). L'adversaire peut alors <b>déclarer un défenseur</b> sur la même ligne.</p>
    <ul><li>Valeur d'attaque <b>≥ Défense</b> du défenseur → le défenseur est <b>vaincu</b>.</li><li><b>Pas de défenseur</b> → tu touches le CEO : il perd 1 PV.</li><li>Un Joueur adjacent peut <b>soutenir</b> l'attaque (+sa valeur d'attaque).</li></ul>
    <p>Mots-clés : <b>Garde</b> (défend n'importe quelle ligne), <b>Riposte</b> (frappe en retour), <b>Légion</b> (peut revenir en main), <b>Shield</b> (ignore une attaque), <b>Provocation</b> (doit être ciblé).</p>` },
];

export function tutoHint(g, seat, { busy, myTurn, canPlay, canAttackAny }) {
  if (g.winner !== null) return { text: g.winner === seat ? "🏆 Bravo, tu as gagné ! Tu connais maintenant les bases." : "Partie terminée. Ce n'est pas grave : relance le tuto ou joue un vrai duel !" };
  if (!myTurn) return { text: "⏳ <b>Tour de l'adversaire.</b> Regarde les animations : il déploie, attaque, et tu peux choisir de <b>défendre</b>. Touche une carte pour lire son texte." };
  if (busy) return { text: "…" };
  const me = g.P(seat), lanes = g.slots(seat);
  if (g.phase === "action") {
    const playable = me.hand.filter((c) => canPlay(c)), players = playable.filter((c) => C(c).category === "Joueur");
    if (!lanes.length && players.length) return { text: "<b>1. Déploie un Joueur.</b> Touche une carte en surbrillance dans ta main (🛡 = Défense), puis « Jouer en case N ».", glow: [".hcard.playable"] };
    if (playable.length && lanes.length < 3 && players.length) return { text: "<b>Tu peux déployer un autre Joueur</b> (3 cases max) ou lier un Objet / jouer un Coach. Tu fais ce que tu veux : plus de Joueurs = plus d'attaques et de défenseurs.", glow: [".hcard.playable", "#btnCombat", "#btnEnd"] };
    if (g.turn > 1 && canAttackAny() ) return { text: "<b>2. Passe en phase de combat</b> pour attaquer avec un de tes Joueurs (il faut assez d'Essences pour payer l'attaque).", glow: ["#btnCombat"] };
    return { text: g.turn > 1 ? "Rien à faire de plus (pas d'Essence ou pas de Joueur prêt). <b>Passe le tour.</b>" : "C'est le premier tour : pas de combat. <b>Passe le tour</b> ; l'adversaire jouera ensuite.", glow: ["#btnEnd"] };
  }
  if (g.phase === "combat") {
    if (canAttackAny()) return { text: "<b>3. Attaque !</b> Touche un de tes Joueurs entouré de rose, puis choisis son attaque. L'adversaire peut défendre : si ton attaque ≥ sa Défense, il est vaincu ; sans défenseur, tu touches son CEO.", glow: [] };
    return { text: "Plus d'attaque possible ce tour. <b>Termine ton tour.</b>", glow: ["#btnEnd"] };
  }
  return { text: "…" };
}
