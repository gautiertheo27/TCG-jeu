// Extension « Mates Origins » (GM1) — numérotation façon TCG moderne :
//  • set principal numéroté 001/046 → 046/046, trié par rareté (C → PC → R → RR) ;
//  • cartes « secrètes » numérotées au-delà du total (047/046 → 060/046) : IR, UR, SIR, HR.
// Pour ajouter une image officielle : remplir le champ `img` (URL) d'une carte ; sinon visuel CSS.

export const SET = { code: "GM1", name: "Mates Origins" };

// Raretés dans l'ordre réel (de la plus courante à la plus rare).
export const RARITIES = {
  C:   { name: "Commune",                    symbol: "●",   color: "#9aa3ad", order: 0, secret: false },
  PC:  { name: "Peu commune",                symbol: "◆",   color: "#3fbf7f", order: 1, secret: false },
  R:   { name: "Rare",                       symbol: "★",   color: "#3b8cff", order: 2, secret: false },
  RR:  { name: "Double Rare",                symbol: "★★",  color: "#a55bff", order: 3, secret: false },
  IR:  { name: "Rare Illustration",          symbol: "★",   color: "#e8c25a", order: 4, secret: true },
  UR:  { name: "Ultra Rare",                 symbol: "★★",  color: "#d8dde6", order: 5, secret: true },
  SIR: { name: "Rare Illustration Spéciale", symbol: "★★",  color: "#ff4fa3", order: 6, secret: true },
  HR:  { name: "Hyper Rare",                 symbol: "★★★", color: "#f5b82e", order: 7, secret: true },
};

export const TYPES = {
  ATK: { name: "Attaque",  icon: "⚔️", beats: "TAC" },
  TAC: { name: "Tactique", icon: "🧠", beats: "DEF" },
  DEF: { name: "Défense",  icon: "🛡️", beats: "ATK" },
};

// [nom, rôle, jeu, rareté, type, puissance, texte, img?]
const RAW = [
  // ● Communes
  ["itachi_rl",      "Joueur", "Rocket League", "C", "ATK", 3, "Un aérien, deux aériens… il ne compte plus."],
  ["odanghosty",     "Mate",   "Gentle Mates",  "C", "TAC", 2, "Toujours là quand il faut."],
  ["pollofn6",       "Joueur", "Fortnite",      "C", "ATK", 3, "Drop chaud, sortie froide."],
  ["OvOMayhem",      "Mate",   "Gentle Mates",  "C", "DEF", 2, "Le chaos, mais organisé."],
  ["MariusCOW",      "Mate",   "Gentle Mates",  "C", "DEF", 3, "Calme comme une vache au pré."],
  ["nassrll_",       "Mate",   "Gentle Mates",  "C", "TAC", 2, "Il observe, puis il frappe."],
  ["SibDMDL",        "Mate",   "Gentle Mates",  "C", "ATK", 2, "Petit pseudo, grosse énergie."],
  ["berryxfps",      "Joueur", "FPS",           "C", "ATK", 3, "Viseur réglé au pixel près."],
  ["itscheek_",      "Mate",   "Gentle Mates",  "C", "TAC", 2, "Le sourire avant la victoire."],
  ["vanyak3kk",      "Mate",   "Gentle Mates",  "C", "DEF", 2, "Ne lâche jamais rien."],
  ["Enkeo_",         "Mate",   "Gentle Mates",  "C", "TAC", 3, "Un plan pour chaque situation."],
  ["Gromalokk",      "Mate",   "Gentle Mates",  "C", "DEF", 3, "Solide comme un roc."],
  ["47glyph",        "Mate",   "Gentle Mates",  "C", "TAC", 1, "Un symbole, un mystère."],
  ["wensvl",         "Joueur", "Valorant",      "C", "ATK", 2, "Entry rapide, retour plus rapide."],
  ["bipoval",        "Joueur", "Valorant",      "C", "DEF", 2, "Tient son site, point."],
  ["chowh1",         "Mate",   "Gentle Mates",  "C", "ATK", 2, "Toujours affamé de victoires."],
  ["kurama_203",     "Mate",   "Gentle Mates",  "C", "ATK", 3, "Neuf queues de détermination."],
  ["L3SCoco",        "Mate",   "Gentle Mates",  "C", "DEF", 2, "Doux dehors, dur dedans."],
  ["akiiral2",       "Mate",   "Gentle Mates",  "C", "TAC", 2, "La patience est une arme."],
  ["Maillot GM",     "Objet",  "Gentle Mates",  "C", "DEF", 1, "Noir et rose, porté avec fierté."],
  ["Clavier du QG",  "Objet",  "Gentle Mates",  "C", "ATK", 1, "Les touches WASD sont usées."],
  // ◆ Peu communes
  ["MK_RZA",         "Mate",   "Gentle Mates",  "PC", "TAC", 4, "Le flow avant tout."],
  ["ItsCored",       "Joueur", "Gentle Mates",  "PC", "ATK", 4, "Au cœur de l'action."],
  ["imthemarteen",   "Mate",   "Gentle Mates",  "PC", "DEF", 4, "Un mur bienveillant."],
  ["Nikof",          "Mate",   "Gentle Mates",  "PC", "TAC", 3, "Analyse, adapte, gagne."],
  ["MarineLord",     "Mate",   "Gentle Mates",  "PC", "DEF", 4, "Seigneur des mers et des lanes."],
  ["Veohz",          "Mate",   "Gentle Mates",  "PC", "ATK", 5, "Vite. Très vite."],
  ["Merstaach",      "Mate",   "Gentle Mates",  "PC", "TAC", 4, "La moustache de la stratégie."],
  ["Snaski",         "Mate",   "Gentle Mates",  "PC", "ATK", 4, "Sournois comme un serpent."],
  ["KUNDIKUNDI",     "Mate",   "Gentle Mates",  "PC", "DEF", 5, "Deux fois plus de présence."],
  ["HalloWFR",       "Mate",   "Gentle Mates",  "PC", "TAC", 4, "Frissons garantis."],
  ["Le Bus GM",      "Objet",  "Gentle Mates",  "PC", "DEF", 3, "Direction : la LAN."],
  // ★ Rares
  ["Oski_RL",        "Joueur",  "Rocket League", "R", "TAC", 6, "Lit le jeu deux touches à l'avance."],
  ["ArchieRL_",      "Joueur",  "Rocket League", "R", "ATK", 6, "Flip reset ? Évidemment."],
  ["Enzosx__",       "Joueur",  "Gentle Mates",  "R", "DEF", 5, "Le dernier rempart."],
  ["namiivlr",       "Joueuse", "Valorant",      "R", "ATK", 6, "Un clutch dans chaque manche."],
  ["martiivlr",      "Joueuse", "Valorant",      "R", "TAC", 6, "Les utilitaires au millimètre."],
  ["Minny",          "Mate",    "Gentle Mates",  "R", "DEF", 5, "Petite taille, grand impact."],
  ["TomJedusor_TFT", "Joueur",  "TFT",           "R", "TAC", 7, "Sa compo est un sortilège."],
  ["Elyona_SC2",     "Joueuse", "StarCraft II",  "R", "TAC", 7, "APM hors du commun."],
  ["Le QG",          "Objet",   "Gentle Mates",  "R", "DEF", 6, "Là où tout se prépare."],
  // ★★ Double Rares
  ["Wawa_dbfz",      "Joueur",    "Jeux de combat", "RR", "ATK", 8, "Les combos ne s'arrêtent jamais."],
  ["beyAz",          "Joueur",    "Valorant",       "RR", "TAC", 8, "Calme, précis, implacable."],
  ["Le Trophée",     "Objet",     "Gentle Mates",   "RR", "DEF", 7, "Il brille encore plus sur l'étagère."],
  ["Gotaga",         "Fondateur", "Gentle Mates",   "RR", "ATK", 9, "Le GOAT ouvre la voie."],
  ["Squeezie",       "Fondateur", "Gentle Mates",   "RR", "TAC", 9, "Une idée, et tout un public suit."],
  ["Brawks",         "Fondateur", "Gentle Mates",   "RR", "DEF", 9, "Le pilier qui tient la maison."],
  // ★ Rares Illustration (secrètes) — versions alternatives
  ["Oski_RL",        "Joueur",  "Rocket League", "IR", "TAC", 7, "Un soir de finale, sous les projecteurs."],
  ["ArchieRL_",      "Joueur",  "Rocket League", "IR", "ATK", 7, "Le ballon ne retombe jamais."],
  ["namiivlr",       "Joueuse", "Valorant",      "IR", "ATK", 7, "Le silence avant le clutch."],
  ["martiivlr",      "Joueuse", "Valorant",      "IR", "TAC", 7, "Chaque smoke est une œuvre."],
  ["Minny",          "Mate",    "Gentle Mates",  "IR", "DEF", 6, "Un sourire dans la tempête."],
  ["TomJedusor_TFT", "Joueur",  "TFT",           "IR", "TAC", 8, "Le carrousel tourne en sa faveur."],
  // ★★ Ultra Rares (full art)
  ["Wawa_dbfz",      "Joueur",  "Jeux de combat", "UR", "ATK", 9, "Combo infini, version pleine page."],
  ["beyAz",          "Joueur",  "Valorant",       "UR", "TAC", 9, "Le headshot qu'on regarde au ralenti."],
  ["Elyona_SC2",     "Joueuse", "StarCraft II",   "UR", "TAC", 8, "La carte entière lui appartient."],
  ["Enzosx__",       "Joueur",  "Gentle Mates",   "UR", "DEF", 7, "Le mur ne tombe pas."],
  // ★★ Rares Illustration Spéciales
  ["Gotaga",         "Fondateur", "Gentle Mates", "SIR", "ATK", 10, "Là où tout a commencé."],
  ["Squeezie",       "Fondateur", "Gentle Mates", "SIR", "TAC", 10, "Le rêve devient réalité."],
  ["Brawks",         "Fondateur", "Gentle Mates", "SIR", "DEF", 10, "Les fondations d'un empire."],
  // ★★★ Hyper Rare (gold)
  ["Les Trois Mates", "Fondateur", "Gentle Mates", "HR", "ATK", 11, "Quand ils sont réunis, rien ne résiste."],
];

const ORDER = Object.keys(RARITIES);
const sorted = RAW.map((r, i) => ({ r, i }))
  .sort((a, b) => ORDER.indexOf(a.r[3]) - ORDER.indexOf(b.r[3]) || a.i - b.i)
  .map((x) => x.r);
export const MAIN_COUNT = sorted.filter((r) => !RARITIES[r[3]].secret).length;

export const CARDS = sorted.map(([name, role, game, rarity, type, power, flavor, img], i) => {
  const num = i + 1;
  return {
    id: `${SET.code}-${String(num).padStart(3, "0")}`,
    num,
    label: `${String(num).padStart(3, "0")}/${String(MAIN_COUNT).padStart(3, "0")}`,
    name, role, game, rarity, type, power, flavor, img: img || null,
  };
});

export const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const BY_RARITY = Object.fromEntries(ORDER.map((r) => [r, CARDS.filter((c) => c.rarity === r)]));

// ---------- Composition d'un booster (10 cartes, ordre réel d'ouverture) ----------
// Les cartes sont révélées dans cet ordre : communes → peu communes → reverse → emplacement rare.
export const PACK_SLOTS = [
  { label: "Commune",      count: 4, table: [["C", 1]] },
  { label: "Peu commune",  count: 3, table: [["PC", 1]] },
  { label: "Reverse holo", count: 1, foil: true, table: [["C", 0.60], ["PC", 0.30], ["R", 0.10]] },
  { label: "Reverse / Illustration", count: 1, foilUnlessSecret: true,
    table: [["SIR", 0.02], ["IR", 0.08], ["R", 0.10], ["PC", 0.30], ["C", 0.50]] },
  { label: "Rare garantie", count: 1,
    table: [["HR", 0.007], ["UR", 0.065], ["RR", 0.168], ["R", 0.76]] },
];
export const PACK_SIZE = PACK_SLOTS.reduce((s, x) => s + x.count, 0);
