// Données de l'extension « Mates Origins » (GM1).
// Pour ajouter une carte : ajoute une ligne dans RAW. Les numéros sont attribués dans l'ordre.
// Format : [nom, rôle, jeu, rareté, type, puissance, texte]
// Rôles : Fondateur, Joueur, Créateur, Mate, Objet — Types : ATK (Attaque), TAC (Tactique), DEF (Défense)

export const SET = { code: "GM1", name: "Mates Origins" };

export const RARITIES = {
  C:  { name: "Commune",     color: "#9aa3ad", order: 0 },
  PC: { name: "Peu commune", color: "#3fbf7f", order: 1 },
  R:  { name: "Rare",        color: "#3b8cff", order: 2 },
  E:  { name: "Épique",      color: "#a55bff", order: 3 },
  L:  { name: "Légendaire",  color: "#f5b82e", order: 4 },
  S:  { name: "Secrète",     color: "#ff4fa3", order: 5 },
};

export const TYPES = {
  ATK: { name: "Attaque",  icon: "⚔️", beats: "TAC" },
  TAC: { name: "Tactique", icon: "🧠", beats: "DEF" },
  DEF: { name: "Défense",  icon: "🛡️", beats: "ATK" },
};

const RAW = [
  // Communes
  ["itachi_rl",      "Joueur",   "Rocket League", "C", "ATK", 3, "Un aérien, deux aériens… il ne compte plus."],
  ["odanghosty",     "Mate",     "Gentle Mates",  "C", "TAC", 2, "Toujours là quand il faut."],
  ["pollofn6",       "Joueur",   "Fortnite",      "C", "ATK", 3, "Drop chaud, sortie froide."],
  ["OvOMayhem",      "Mate",     "Gentle Mates",  "C", "DEF", 2, "Le chaos, mais organisé."],
  ["MariusCOW",      "Mate",     "Gentle Mates",  "C", "DEF", 3, "Calme comme une vache au pré."],
  ["nassrll_",       "Mate",     "Gentle Mates",  "C", "TAC", 2, "Il observe, puis il frappe."],
  ["SibDMDL",        "Mate",     "Gentle Mates",  "C", "ATK", 2, "Petit pseudo, grosse énergie."],
  ["berryxfps",      "Joueur",   "FPS",           "C", "ATK", 3, "Viseur réglé au pixel près."],
  ["itscheek_",      "Mate",     "Gentle Mates",  "C", "TAC", 2, "Le sourire avant la victoire."],
  ["vanyak3kk",      "Mate",     "Gentle Mates",  "C", "DEF", 2, "Ne lâche jamais rien."],
  ["Enkeo_",         "Mate",     "Gentle Mates",  "C", "TAC", 3, "Un plan pour chaque situation."],
  ["Gromalokk",      "Mate",     "Gentle Mates",  "C", "DEF", 3, "Solide comme un roc."],
  ["47glyph",        "Mate",     "Gentle Mates",  "C", "TAC", 1, "Un symbole, un mystère."],
  ["wensvl",         "Joueur",   "Valorant",      "C", "ATK", 2, "Entry rapide, retour plus rapide."],
  ["bipoval",        "Joueur",   "Valorant",      "C", "DEF", 2, "Tient son site, point."],
  ["chowh1",         "Mate",     "Gentle Mates",  "C", "ATK", 2, "Toujours affamé de victoires."],
  ["kurama_203",     "Mate",     "Gentle Mates",  "C", "ATK", 3, "Neuf queues de détermination."],
  ["L3SCoco",        "Mate",     "Gentle Mates",  "C", "DEF", 2, "Doux dehors, dur dedans."],
  ["akiiral2",       "Mate",     "Gentle Mates",  "C", "TAC", 2, "La patience est une arme."],
  ["Maillot GM",     "Objet",    "Gentle Mates",  "C", "DEF", 1, "Noir et rose, porté avec fierté."],
  ["Clavier du QG",  "Objet",    "Gentle Mates",  "C", "ATK", 1, "Les touches WASD sont usées."],

  // Peu communes
  ["MK_RZA",         "Mate",     "Gentle Mates",  "PC", "TAC", 4, "Le flow avant tout."],
  ["ItsCored",       "Joueur",   "Gentle Mates",  "PC", "ATK", 4, "Au cœur de l'action."],
  ["imthemarteen",   "Mate",     "Gentle Mates",  "PC", "DEF", 4, "Un mur bienveillant."],
  ["Nikof",          "Mate",     "Gentle Mates",  "PC", "TAC", 3, "Analyse, adapte, gagne."],
  ["MarineLord",     "Mate",     "Gentle Mates",  "PC", "DEF", 4, "Seigneur des mers et des lanes."],
  ["Veohz",          "Mate",     "Gentle Mates",  "PC", "ATK", 5, "Vite. Très vite."],
  ["Merstaach",      "Mate",     "Gentle Mates",  "PC", "TAC", 4, "La moustache de la stratégie."],
  ["Snaski",         "Mate",     "Gentle Mates",  "PC", "ATK", 4, "Sournois comme un serpent."],
  ["KUNDIKUNDI",     "Mate",     "Gentle Mates",  "PC", "DEF", 5, "Deux fois plus de présence."],
  ["HalloWFR",       "Mate",     "Gentle Mates",  "PC", "TAC", 4, "Frissons garantis."],
  ["Le Bus GM",      "Objet",    "Gentle Mates",  "PC", "DEF", 3, "Direction : la LAN."],

  // Rares
  ["Oski_RL",        "Joueur",   "Rocket League", "R", "TAC", 6, "Lit le jeu deux touches à l'avance."],
  ["ArchieRL_",      "Joueur",   "Rocket League", "R", "ATK", 6, "Flip reset ? Évidemment."],
  ["Enzosx__",       "Joueur",   "Gentle Mates",  "R", "DEF", 5, "Le dernier rempart."],
  ["namiivlr",       "Joueuse",  "Valorant",      "R", "ATK", 6, "Un clutch dans chaque manche."],
  ["martiivlr",      "Joueuse",  "Valorant",      "R", "TAC", 6, "Les utilitaires au millimètre."],
  ["Minny",          "Mate",     "Gentle Mates",  "R", "DEF", 5, "Petite taille, grand impact."],
  ["TomJedusor_TFT", "Joueur",   "TFT",           "R", "TAC", 7, "Sa compo est un sortilège."],
  ["Elyona_SC2",     "Joueuse",  "StarCraft II",  "R", "TAC", 7, "APM hors du commun."],
  ["Le QG",          "Objet",    "Gentle Mates",  "R", "DEF", 6, "Là où tout se prépare."],

  // Épiques
  ["Wawa_dbfz",      "Joueur",   "Jeux de combat", "E", "ATK", 8, "Les combos ne s'arrêtent jamais."],
  ["beyAz",          "Joueur",   "Valorant",       "E", "TAC", 8, "Calme, précis, implacable."],
  ["Le Trophée",     "Objet",    "Gentle Mates",   "E", "DEF", 7, "Il brille encore plus sur l'étagère."],

  // Légendaires
  ["Gotaga",         "Fondateur", "Gentle Mates",  "L", "ATK", 9, "Le GOAT ouvre la voie."],
  ["Squeezie",       "Fondateur", "Gentle Mates",  "L", "TAC", 9, "Une idée, et tout un public suit."],
  ["Brawks",         "Fondateur", "Gentle Mates",  "L", "DEF", 9, "Le pilier qui tient la maison."],

  // Secrète
  ["Les Trois Mates", "Fondateur", "Gentle Mates", "S", "ATK", 10, "Quand ils sont réunis, rien ne résiste."],
];

export const CARDS = RAW.map(([name, role, game, rarity, type, power, flavor], i) => ({
  id: `${SET.code}-${String(i + 1).padStart(3, "0")}`,
  num: i + 1,
  name, role, game, rarity, type, power, flavor,
}));

export const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const BY_RARITY = Object.fromEntries(
  Object.keys(RARITIES).map((r) => [r, CARDS.filter((c) => c.rarity === r)])
);
