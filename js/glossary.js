// Textes d'aide du duel : mots-clés, zones, phases, types de cartes, conseils par carte et combos. Utilisés par le tuto, les bulles d'info et les fiches de cartes.
export const KEYWORD_INFO = {
  PROVOCATION: "L'attaquant qui lui fait face doit le viser : il ne peut pas toucher ton CEO. C'est ton bouclier, à placer devant un Joueur fragile.",
  GARDE: "Peut défendre n'importe quelle ligne, pas seulement celle en face de lui. Idéal pour protéger un Joueur d'une autre case.",
  BUFF: "Effet permanent tant qu'il est en jeu : tes autres Joueurs gagnent de l'Attaque. Plus tu as de Joueurs sur le Terrain, plus il est rentable.",
  RIPOSTE: "Quand il est vaincu, tu peux lancer une de ses attaques (coût −1) contre le Joueur qui l'a vaincu. L'adversaire y réfléchit à deux fois avant de l'attaquer.",
  "LÉGION": "Quand il est vaincu, tu peux défausser une carte de ta main pour le récupérer en main au lieu de le perdre. Garde-le pour tes grosses cartes.",
  SHIELD: "Ignore la première attaque qu'il subit tant qu'il est en jeu. Parfait pour encaisser un premier coup sans risque.",
};
export const CATEGORY_INFO = {
  Joueur: "Ta troupe. Se déploie sur une des 3 cases du Terrain. Il a une Défense (🛡) pour résister et des attaques pour frapper. C'est lui qui attaque et qui défend.",
  Objet: "Se lie au Joueur de ton choix et le renforce tant qu'il reste en jeu. Si le Joueur part, l'Objet est mis de côté (bench). Pas de limite d'Objets par Joueur.",
  Coach: "Effet immédiat, à jouer pendant ta phase d'Action. Un seul Coach par tour. La carte est ensuite défaussée.",
  Moment: "Effet instantané, à jouer pendant ta phase d'Action (plusieurs par tour possibles). La carte est ensuite défaussée.",
  Essence: "Ta ressource. Une Essence de ta Réserve arrive sur ton Terrain à chaque tour. Tu les engages (tu les « dépenses ») pour payer les attaques.",
};
export const PHASE_INFO = {
  entretien: "Entretien (automatique) : tu pioches 1 carte, tes cartes engagées se redressent et une nouvelle Essence arrive.",
  action: "Action : déploie tes Joueurs, lie des Objets, joue ton Coach et tes Moments. Prépare ton attaque avant de passer au combat.",
  combat: "Combat : fais attaquer tes Joueurs prêts (non engagés) en payant leurs Essences. Chaque attaque engage le Joueur.",
  fin: "Fin de tour : tu défausses jusqu'à 5 cartes en main, puis c'est à l'adversaire.",
};
export const TIPS = {
  pv: "Points de Victoire : 4 cartes face cachée. Quand ton CEO est touché, tu perds un PV : la carte va dans ta main (et peut déclencher un bonus de Résilience). CEO touché sans aucun PV = défaite.",
  club: "Club : ta pioche. Si tu dois piocher alors qu'il est vide, tu perds la partie.",
  reserve: "Réserve : tes 10 Essences. Une nouvelle Essence arrive sur ton Terrain à chaque tour.",
  discard: "Défausse : cartes jouées ou vaincues. Touche la pile pour la voir : certains effets la réutilisent.",
  essences: "Essences : elles paient les attaques. Une Essence grisée est engagée (déjà utilisée) : elle se redresse à ton prochain Entretien.",
  def: "Défense : si l'attaque adverse est supérieure ou égale à ce nombre, ce Joueur est vaincu.",
  engaged: "Engagé : ce Joueur est couché (il a attaqué ou défendu). Il ne peut ni attaquer ni défendre avant ton prochain Entretien.",
  obj: "Objet lié à ce Joueur : il le renforce tant que le Joueur est en jeu.",
  lane: "Case du Terrain. Ton Joueur attaque et défend sur sa ligne, face à la case de l'adversaire. Un Joueur adjacent peut soutenir l'attaque.",
  hand: "Ta main (5 cartes maximum en fin de tour). Touche une carte pour la lire, puis la jouer si elle est en surbrillance.",
  oppHand: "Cartes en main de l'adversaire (tu ne les vois pas).",
  btnCombat: "Passe en phase de combat. Déploie d'abord tes Joueurs et joue tes Coachs/Moments : après, c'est l'heure d'attaquer.",
  btnEnd: "Termine ton tour. Tu défausseras jusqu'à 5 cartes en main si besoin.",
  btnForfeit: "Abandonner la partie (tu perds).",
};
export const KW_ORDER = ["PROVOCATION", "GARDE", "BUFF", "RIPOSTE", "LÉGION", "SHIELD"];
export const keywordsOf = (card) => { const e = (card.effect || "").toUpperCase(); return KW_ORDER.filter((k) => e.startsWith(k) || e.includes(`| ${k}`)); };

// Conseils automatiques à partir du texte de la carte
export function tipsFor(card) {
  const out = [], e = card.effect || "", atk = card.attacks || [];
  const txt = [e, ...atk.map((a) => a.text || "")].join(" ");
  if (CATEGORY_INFO[card.category]) out.push(CATEGORY_INFO[card.category]);
  for (const k of keywordsOf(card)) out.push(`${k[0] + k.slice(1).toLowerCase()} : ${KEYWORD_INFO[k]}`);
  if (atk.length) out.push("Coût d'une attaque : chaque rond est une Essence à engager. Un rond coloré demande une Essence de cette couleur, un rond gris accepte n'importe laquelle. Un « + » après les dégâts signifie que la valeur augmente selon le texte sous l'attaque.");
  if (/Résilience/i.test(txt) || card.resilience) out.push("Résilience : si cette carte est un de tes PV touchés, tu peux la révéler pour déclencher cet effet bonus. Un PV perdu n'est donc pas toujours perdu pour rien.");
  if (card.category === "Joueur") {
    const best = Math.max(0, ...atk.map((a) => parseInt(a.damage, 10) || 0)), cheap = atk.length ? Math.min(...atk.map((a) => (a.cost || []).length)) : 9;
    if (best >= 120) out.push(`Grosse attaque (${best}) : parfait pour vaincre un Joueur à forte Défense.`);
    if (cheap <= 1 && atk.length) out.push("Attaque peu chère : il peut frapper dès les premiers tours, même avec peu d'Essences.");
    if ((card.def || 0) >= 120) out.push(`Défense élevée (${card.def}) : sert de mur pour protéger ton CEO.`);
    if ((card.def || 0) <= 60) out.push(`Défense fragile (${card.def}) : protège-le avec une Provocation ou une Garde.`);
  }
  if (card.category === "Objet") out.push("Lie-le au Joueur qui attaquera le plus (bonus d'Attaque) ou qui défendra (bonus de Défense), et évite de le mettre sur un Joueur sur le point d'être vaincu.");
  if (/\+\d+ (?:à l'|d')?Attaque|Attaque jusqu/i.test(e) && card.category !== "Objet" && card.category !== "Joueur") out.push("À jouer juste avant ta phase de combat, quand plusieurs de tes Joueurs sont prêts à attaquer.");
  if (/(pioch|Regardez|Révélez)/i.test(e) && card.category !== "Joueur") out.push("Pioche / tri : à jouer tôt dans le tour pour trouver tes Joueurs et tes Essences.");
  if (/(Engagez un Joueur adverse|Renvoyez|bench un Joueur adverse|ne peut pas déclencher)/i.test(e)) out.push("Contrôle : retire ou immobilise un défenseur avant d'attaquer. S'il n'y a plus de défenseur, ton attaque touche le CEO adverse.");
  if (card.color && card.color !== "Neutre" && card.category !== "Joueur") out.push(`Couleur ${card.color} : il faut déjà une Essence ${card.color} sur ton Terrain pour la jouer.`);
  if (card.color === "Neutre" && card.category !== "Joueur" && card.category !== "Essence") out.push("Carte Neutre : jouable sans condition de couleur, donc stable dans tous les decks.");
  return out;
}

// Combos concrets (cartes réelles du set)
export const COMBOS = {
  "Pas Compris": "Provocation : place-le devant tes Joueurs fragiles. Avec un Joueur à Riposte à côté (Vanyabubu, Pitchounes), l'adversaire est forcé d'attaquer un mur qui lui renvoie des coups.",
  "Les Rois du Saloon": "Provocation + Hold-Up (+10 par PV que tu as) : plus tu es en forme, plus il frappe fort. Garde tes PV et protège-le.",
  "Vanyabubu": "Riposte + Objets : Baby Shark gagne +10 par Objet lié. Lie-lui Ravitaillement ou Cooked : s'il est vaincu, il riposte avec une attaque gonflée.",
  "Pitchounes": "Riposte à grosse attaque (130) : l'adversaire hésite à le viser. Parfait en défenseur sur ta ligne centrale.",
  "Tout Commence Ici": "Buff +10 Attaque aux autres Joueurs. Avec Zacking Buff (+30 à tous) et deux ou trois Joueurs prêts, tes attaques passent au-dessus des Défenses moyennes.",
  "Agent M.E.L": "Buff : tes autres Joueurs ont +20 Attaque en permanence. Plus tu as de Joueurs sur le Terrain, plus il est rentable : pose-le tôt.",
  "Zacking Buff": "Joue-le en phase d'Action, juste avant le combat, quand tu as plusieurs Joueurs prêts : +30 Attaque à tous jusqu'à la fin du tour.",
  "Pause Technique": "Engage un Joueur adverse sans mot-clé : il ne peut plus défendre. Joue-le avant d'attaquer pour toucher le CEO sans défenseur.",
  "Buy Bundle M8 !!": "Renvoie en main un Joueur adverse sans Provocation : le défenseur disparaît avant ton attaque, et l'adversaire doit le redéployer.",
  "Gotaga Posé": "Légion : quand il est vaincu, défausse une carte pour le récupérer. Sa grosse attaque (150+) coûte cher en Essences : prévois-les à l'avance.",
  "La Planète": "Légion : s'il est vaincu, tu peux défausser une carte pour le récupérer en main. Télépathie fait 120 pour une Essence Mauve et une Neutre.",
  "Loup du Game": "Légion + attaque Neutre à 160 : stable (aucune couleur requise) et difficile à perdre pour de bon.",
  "Joueur de l'Ombre": "Déclenche l'effet d'entrée d'un Joueur de ta défausse (comme Nyzer ou Erza). Garde des Joueurs à effet d'entrée dans ta défausse (défausse de fin de tour, Légion).",
  "Baby Driver": "Shield : ignore la première attaque. Défense faible (40) mais l'adversaire gaspille une attaque. Pose-le en case où tu veux gagner du temps.",
  "Ravitaillement": "+10 Attaque et +10 Défense, avec un bonus de pioche selon la version de la carte. Un Objet simple et solide pour ton Joueur principal.",
  "Cooked": "+30 Attaque pour un Objet Neutre sans condition : lie-le au Joueur qui attaquera chaque tour.",
  "Gros Bonnet": "+30 Défense : lie-le à un Joueur que l'adversaire doit absolument passer (ou à une Provocation).",
  "Invitation": "Si le Joueur est vaincu, l'Objet est mis de côté à sa place et le Joueur reste en jeu. Lie-le à ta meilleure carte.",
  "Mur Salvateur": "Donne Garde et +10 Défense jusqu'à la fin du tour adverse : joue-le en fin de tour pour protéger un Joueur menacé.",
  "Lofi Girl": "Désengage un de tes Joueurs : il peut attaquer une seconde fois. Joue-le après la première attaque d'un Joueur qui frappe fort.",
  "Mercato": "Pioche 3 cartes : joue-le en début de partie pour trouver tes Joueurs et tes Essences.",
  "Mendo": "Coach neutre : +20 Attaque à tous tes Joueurs. Pense au même timing que Zacking Buff : juste avant la phase de combat.",
  "Erza": "À son arrivée, regarde 3 cartes du Club et en prend 1 : un Joueur qui remplace une pioche. Avec Joueur de l'Ombre, tu le rejoues depuis la défausse.",
};
export const comboFor = (card) => COMBOS[card.name] || null;
