import { C } from "./engine/core.js";
import { CARDS } from "./cards.js";
import { KEYWORD_INFO, tipsFor, comboFor } from "./glossary.js";
// Mode tuto : pages d'explication + conseils contextuels pendant une partie guidée contre l'IA.
const byName = (n) => CARDS.find((c) => c.name === n);
const thumb = (name) => { const c = byName(name); return c ? `<img class="cb-img" src="${c.img}" alt="${name}" loading="lazy">` : ""; };
const combo = (a, b, why) => `<div class="combo"><div class="cb-cards">${thumb(a)}${b ? '<span class="cb-plus">+</span>' + thumb(b) : ""}</div><p><b>${a}${b ? " + " + b : ""}</b><br>${why}</p></div>`;
const mk = (n, x, y) => `<span class="mk" style="left:${x}%;top:${y}%">${n}</span>`;
const anat = (img, marks, legend) => `<div class="anat"><div class="anat-img"><img src="${img}" alt="" loading="lazy">${marks}</div><ol class="anat-leg">${legend.map((t) => `<li>${t}</li>`).join("")}</ol></div>`;
const kwRow = (k, ex) => `<li><b>${k[0] + k.slice(1).toLowerCase()}</b> — ${KEYWORD_INFO[k]} <span class="muted small">Exemple : ${ex}.</span></li>`;

export const TUTO_PAGES = [
  { title: "But du jeu", html: `<p>Tu es le <b>CEO d'un club</b>. Pour gagner, <b>touche le CEO adverse alors qu'il n'a plus aucun Point de Victoire</b> (PV), ou fais en sorte que ton adversaire <b>ne puisse plus piocher</b>.</p>
    <p>Chacun commence avec <b>4 PV</b>. Quand ton CEO est touché, tu perds un PV : la carte va dans ta main (et peut déclencher un bonus, la <b>Résilience</b>). Le but d'un tour est donc de <b>retirer ou contourner les défenseurs</b> de l'adversaire pour atteindre son CEO, tout en protégeant le tien.</p>
    <p class="tip">💡 Pendant la partie, passe la souris (ou touche) sur n'importe quel élément du plateau : une bulle t'explique à quoi il sert. Le bouton « 💡 Bulles d'aide » les active ou les coupe.</p>` },
  { title: "Le plateau", html: `<ul><li><b>Terrain</b> : 3 cases où tu déploies tes Joueurs. Chaque Joueur attaque et défend sur <b>sa ligne</b>, face à la case de l'adversaire.</li>
    <li><b>Essences</b> : ta ressource. Une Essence de ta <b>Réserve</b> (10 cartes) arrive ici chaque tour. Une Essence <b>engagée</b> (grisée) est déjà dépensée ce tour : elle se redresse à ton prochain Entretien.</li>
    <li><b>Club</b> : ta pioche (40 cartes). Un Club vide au moment de piocher = défaite.</li><li><b>Défausse</b> : cartes jouées ou défaussées (touche la pile pour la voir : certains effets la réutilisent).</li>
    <li><b>Points de Victoire</b> : tes 4 cercles roses. <b>Main</b> : 5 cartes maximum en fin de tour.</li></ul>` },
  { title: "Un tour de jeu", html: `<ol><li><b>Entretien</b> (automatique) : tu pioches 1 carte, tes cartes engagées se redressent, une nouvelle Essence arrive.</li>
    <li><b>Action</b> : déploie un Joueur, lie des Objets, joue un Coach (1 par tour) et des Moments. <i>Prépare ici ton attaque.</i></li><li><b>Combat</b> : fais attaquer tes Joueurs prêts, en payant leurs Essences (pas de combat au tout premier tour de la partie).</li>
    <li><b>Fin</b> : défausse jusqu'à 5 cartes en main, puis c'est à l'adversaire.</li></ol>
    <p class="tip">💡 L'ordre compte : joue tes Coachs et Moments <b>avant</b> de passer en phase de combat, sinon leur bonus d'Attaque ne servira pas.</p>` },
  { title: "Anatomie d'une carte Joueur", html: `<p>Voici comment lire une carte. Les numéros sur l'image correspondent à la liste.</p>` +
    anat("cartes/034.webp", [mk(1, 23, 8), mk(2, 79, 8.6), mk(3, 50, 30), mk(4, 16, 58), mk(5, 72, 57.6), mk(6, 14.5, 66.4), mk(7, 47, 66), mk(8, 81, 66), mk(9, 50, 70.5), mk(10, 50, 76.5), mk(11, 50, 85), mk(12, 15, 92.5)].join(""), [
      "<b>Nom</b> de la carte.", "<b>Symbole de couleur</b> : la couleur d'Essence de la carte. Elle décide quelles Essences servent à la jouer ou à payer ses attaques.", "<b>Illustration</b> (aucun effet de jeu).",
      "<b>Type</b> : Joueur, Objet, Coach, Moment ou Essence.", "<b>Défense</b> : si l'attaque adverse est <b>supérieure ou égale</b>, ce Joueur est vaincu.",
      "<b>Coût de l'attaque</b> : chaque rond est une Essence à engager. Rond coloré = Essence de cette couleur ; rond gris = n'importe laquelle.", "<b>Nom de l'attaque</b>. Un Joueur peut en avoir plusieurs : tu en choisis une.",
      "<b>Dégâts</b> : la valeur d'attaque à comparer à la Défense. Un « + » veut dire qu'elle augmente selon le texte juste dessous.", "<b>Texte de l'attaque</b> : ici, +10 pour chaque Objet lié à ce Joueur.",
      "<b>Mot-clé</b> (Riposte, Garde, Provocation, Légion, Buff, Shield) : une capacité permanente expliquée juste en dessous.", "<b>Effet du mot-clé</b> : le règlement de cette capacité.", "<b>Numéro et rareté</b> (C Commune, PC Peu commune, R Rare, E Épique, L Légendaire, P Promo)."]) },
  { title: "Anatomie d'un Coach, d'un Moment ou d'un Objet", html: `<p>Ces cartes n'attaquent pas : elles ont un <b>effet</b> et souvent une <b>Résilience</b>.</p>` +
    anat("cartes/014.webp", [mk(1, 19, 58), mk(2, 72, 58), mk(3, 50, 70.5), mk(4, 50, 83.7)].join(""), [
      "<b>Type</b> : ici un Coach (un seul par tour). Un Moment peut se jouer plusieurs fois par tour ; un Objet se lie à un Joueur.", "<b>Vitesse</b> : « Instant » = effet immédiat, à jouer pendant ta phase d'Action (un Objet affiche « Lien »).",
      "<b>Effet</b> : ce qui se passe quand tu la joues. Ici, tous tes Joueurs ont +30 Attaque jusqu'à la fin du tour.", "<b>Résilience</b> : un bonus <b>seulement si cette carte est un de tes PV</b> touchés par une attaque. Tu peux alors la révéler pour déclencher cet effet. Un PV perdu n'est donc pas toujours perdu pour rien."]) +
    `<p class="tip">💡 Sur une carte Coach, Moment ou Objet d'une couleur, il faut déjà avoir <b>une Essence de cette couleur sur ton Terrain</b> pour la jouer. Les cartes <b>Neutres</b> se jouent toujours.</p>` },
  { title: "Essences, couleurs et coûts", html: `<p>Chaque attaque se paie en <b>engageant</b> des Essences. Exemple : <b>Baby Shark</b> (Vanyabubu) coûte <b>1 Essence Orange</b>, <b>Éclosion</b> (Pitchounes) en coûte <b>2</b>, et <b>Premier Souffle</b> (Tout Commence Ici) coûte <b>1 Essence quelconque</b> (rond gris, « Neutre »).</p>
    <ul><li>Tu n'engages une Essence qu'<b>une fois par tour</b> : avec 2 Essences, tu paies une attaque à 2 ou deux attaques à 1.</li><li>Un deck à <b>2 couleurs</b> + des cartes <b>Neutres</b> est le plus stable : tu as presque toujours de quoi payer et jouer.</li>
    <li>Plus un Joueur est cher, plus il frappe fort (Gotaga Posé : 150+ pour 4 Essences). Prévois une <b>courbe de coût</b> : des Joueurs à 1 Essence pour les premiers tours, quelques gros pour la fin de partie.</li></ul>` },
  { title: "Les mots-clés", html: `<ul class="kwlist">${[kwRow("PROVOCATION", "Pas Compris"), kwRow("GARDE", "Mur Salvateur en donne jusqu'à la fin du tour adverse"), kwRow("BUFF", "Tout Commence Ici, Agent M.E.L"), kwRow("RIPOSTE", "Vanyabubu, Pitchounes"), kwRow("LÉGION", "La Planète, Gotaga Posé, Loup du Game"), kwRow("SHIELD", "Baby Driver")].join("")}</ul>
    <p class="muted small">Pendant la partie, touche un Joueur pour voir ses mots-clés expliqués, ou survole un badge de mot-clé sous la carte.</p>` },
  { title: "Combattre pas à pas", html: `<ol><li>Choisis un Joueur <b>prêt</b> (non engagé) et une attaque que tu peux payer. Il s'<b>engage</b> (il se couche).</li>
    <li>L'adversaire peut déclarer un <b>défenseur</b> : un de ses Joueurs non engagés <b>sur la même ligne</b> (ou un Joueur à Garde). Ce défenseur s'engage aussi.</li>
    <li>Tu peux alors engager un Joueur <b>adjacent</b> pour <b>soutenir</b> l'attaque : sa valeur d'attaque s'ajoute à la tienne (il paie ses Essences).</li>
    <li>On compare : <b>attaque ≥ Défense</b> = le défenseur est vaincu. Sinon, rien ne se passe (et un Riposte peut te punir).</li>
    <li><b>Pas de défenseur</b> ? Ton attaque touche le CEO : l'adversaire perd 1 PV (sans PV, tu gagnes !).</li></ol>
    <div class="tip">💡 <b>Exemple</b> : ton Tout Commence Ici (Premier Souffle, <b>90</b>) attaque. L'adversaire défend avec Pitchounes (Défense <b>120</b>) : 90 &lt; 120, ça ne passe pas. Tu engages Agent M.E.L adjacent en soutien (Coup de fil <b>100</b>) : 90 + 100 = <b>190 ≥ 120</b>, Pitchounes est vaincu. Attention : il a Riposte, l'adversaire peut lancer son attaque contre Tout Commence Ici.</div>` },
  { title: "Pourquoi jouer telle carte avec telle carte ?", html: `<p>Les bonnes parties se gagnent avec des <b>combos</b> : des cartes dont les effets se complètent.</p>` + [
      combo("Tout Commence Ici", "Zacking Buff", "Le Buff donne +10 en permanence à tes autres Joueurs, le Coach +30 à tous jusqu'à la fin du tour. Avec 2 ou 3 Joueurs prêts, tes attaques dépassent les Défenses moyennes."),
      combo("Pause Technique", "Buy Bundle M8 !!", "Deux façons de <b>retirer le défenseur</b> avant d'attaquer (engager ou renvoyer en main). Sans défenseur, ton attaque touche le CEO."),
      combo("Vanyabubu", "Cooked", "Riposte + Objet : Baby Shark gagne +10 par Objet lié, et Cooked ajoute +30. S'il est vaincu, sa riposte est énorme."),
      combo("Pas Compris", "Pitchounes", "Une Provocation force l'attaquant à la viser, un Riposte punit celui qui vainc. L'adversaire perd du temps et des Essences."),
      combo("Joueur de l'Ombre", "Erza", "Il rejoue l'effet d'entrée d'un Joueur de ta défausse (Erza, Nyzer...). Les cartes défaussées en fin de tour deviennent des ressources."),
      combo("Gotaga Posé", "Gros Bonnet", "Un gros Joueur à Légion + 30 Défense : il est très dur à vaincre, et même s'il l'est tu le récupères en défaussant une carte."),
      combo("Mur Salvateur", "Lofi Girl", "Défends d'abord (Garde + 10 Défense), puis rends ta Défense offensive : Lofi Girl désengage un Joueur pour qu'il attaque encore."),
    ].join("") + `<p class="muted small">Pendant la partie, la fiche d'une carte (touche-la) montre « 🤝 Combos » quand elle a une synergie connue.</p>` },
  { title: "Construire un bon deck", html: `<ul><li><b>40 cartes</b> dans le Club (3 exemplaires maximum d'une même carte), <b>10 Essences</b> dans la Réserve.</li><li>Vise <b>15 à 18 Joueurs</b> : sans Joueurs, tu ne peux ni attaquer ni défendre.</li>
    <li><b>Deux couleurs</b> maximum + des cartes <b>Neutres</b>.</li><li>Des Joueurs à <b>coût bas</b> pour démarrer, quelques gros pour finir, 4 à 6 Objets, quelques Coachs et Moments qui <b>se combinent</b> avec tes Joueurs.</li>
    <li>Les decks prêtés en sont de bons exemples : <b>Tempo</b> (Joueurs pas chers qui frappent vite), <b>Contrôle</b> (engager, bencher), <b>Objets</b> (Joueurs renforcés) ou <b>Combos</b> (cartes neutres faciles). Ouvre « Voir le deck » pour voir leur courbe de coût.</li></ul>` },
  { title: "À toi de jouer", html: `<p>Une partie guidée contre l'IA va commencer. Un encadré <b>🎓 Tuto</b> te dira quoi faire à chaque étape, les éléments à utiliser <b>clignotent en jaune</b>, et les <b>bulles d'aide</b> expliquent tout ce que tu survoles.</p>
    <p>Aucune récompense en tuto : essaie, rate, recommence !</p>` },
];

export function tutoHint(g, seat, { busy, myTurn, canPlay, canAttackAny }) {
  if (g.winner !== null) return { text: g.winner === seat ? "🏆 Bravo, tu as gagné ! Tu connais maintenant les bases." : "Partie terminée. Ce n'est pas grave : relance le tuto ou joue un vrai duel !" };
  if (!myTurn) return { text: "⏳ <b>Tour de l'adversaire.</b> Regarde les animations : il déploie, attaque, et tu peux choisir de <b>défendre</b>. Touche une carte pour lire son texte." };
  if (busy) return { text: "…" };
  const me = g.P(seat), lanes = g.slots(seat);
  if (g.phase === "action") {
    const playable = me.hand.filter((c) => canPlay(c)), players = playable.filter((c) => C(c).category === "Joueur");
    if (!lanes.length && players.length) return { text: "<b>1. Déploie un Joueur.</b> Touche une carte en surbrillance dans ta main (🛡 = Défense), puis « Jouer en case N ».", glow: [".hcard.playable"] };
    const others = playable.filter((c) => C(c).category !== "Joueur");
    if (lanes.length && others.length) { const c = C(others[0]); const tip = comboFor(c) || tipsFor(c).find((t) => !/^(Coût|Résilience)/.test(t)) || ""; return { text: `<b>Carte jouable : ${c.name}.</b> ${tip}<br><span class="muted small">Quand tu as fini tes déploiements, passe en phase de combat.</span>`, glow: [".hcard.playable", "#btnCombat"] }; }
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
