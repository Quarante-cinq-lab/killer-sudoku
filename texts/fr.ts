// Tous les textes de l'application, en français, regroupés ici.
// Partagé par l'interface (app/) et par les scripts (trace, rapports) ; aucune logique.

export const TEXTS = {
  appName: 'Killer Sudoku',

  home: {
    resume: 'Reprendre',
    resumeDetail: (name: string, time: string) => `${name} · ${time}`,
    newGrid: 'Nouvelle grille',
    unplayed: (n: number) => (n === 0 ? 'toutes jouées' : n === 1 ? '1 jamais jouée' : `${n} jamais jouées`),
    unavailable: 'bientôt',
    allPlayed: (level: string) =>
      `Toutes les grilles ${level} ont été jouées : voici celle que tu as terminée il y a le plus longtemps.`,
    loading: 'Chargement…',
  },

  game: {
    title: (level: string, number: number) => `${level} #${String(number).padStart(3, '0')}`,
    home: 'Accueil',
    pause: 'Pause',
    resume: 'Reprendre',
    paused: 'Partie en pause',
    menu: 'Menu',
    restart: 'Recommencer la grille',
    restartConfirm: 'Recommencer cette grille à zéro ? Le chronomètre repart aussi de zéro.',
    undo: 'Annuler',
    redo: 'Rétablir',
    hint: 'Indice',
    digits: 'Chiffres',
    notes: 'Notes',
    combinations: 'Combinaisons',
    calculator: 'Calculatrice',
    options: 'Options',
    virtualCages: 'Cages virtuelles',
    comingSoon: 'Disponible à l’étape 5',
    eraseAll: 'Tout effacer',
    eraseAllConfirm: 'Effacer tous les chiffres et toutes les notes ?',
    eraseSelection: 'Effacer la sélection',
    fillNotes: 'Remplir toutes les notes',
    close: 'Fermer',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    fullButWrong: 'La grille est remplie mais contient une erreur.',
    victoryTitle: 'Bravo !',
    victoryTime: (time: string) => `Grille terminée en ${time}`,
    replay: 'Rejouer',
    nextGrid: 'Grille suivante',
  },

  levels: {
    HARD: 'Hard',
    EXPERT: 'Expert',
    DIABOLIQUE: 'Diabolique',
    EXTREME: 'Extrême',
    ULTIME: 'Ultime',
  },

  techniques: {
    naked_single: 'Singleton nu',
    hidden_single: 'Singleton caché',
    cage_combination: 'Combinaisons de cage',
    rule45_single: 'Règle des 45',
    pointing: 'Pointing pair',
    box_line: 'Box/line',
    cage_unit_overlap: 'Chevauchement cage/unité',
    naked_pair: 'Paire nue',
    hidden_pair: 'Paire cachée',
    naked_triple: 'Triplet nu',
    hidden_triple: 'Triplet caché',
    innies_outies_multi: 'Innies/outies',
    cage_splitting: 'Découpage de cage',
    cage_comparison: 'Comparaison innies/outies',
    parity: 'Parité',
    cross_cage_combinations: 'Combinaisons croisées',
    naked_quad: 'Quadruplet nu',
    hidden_quad: 'Quadruplet caché',
    x_wing: 'X-Wing',
    y_wing: 'Y-Wing',
    xyz_wing: 'XYZ-Wing',
    swordfish: 'Swordfish',
  },

  rejections: {
    non_resolue: 'le solveur logique ne la résout pas entièrement',
    contradiction: 'le raisonnement aboutit à une contradiction',
    entre_deux_niveaux: 'elle ne remplit les conditions d’aucun niveau',
    score_hors_limites: 'son score sort de l’intervalle du niveau',
    cages_non_conformes: 'la forme de ses cages ne convient pas au niveau',
    goulot_isole: 'sa difficulté tient à une seule étape (goulot isolé)',
    decoupage_impossible: 'le découpage en cages n’a pas respecté le profil du niveau',
    unicite_impossible: 'les retouches n’ont pas suffi à rendre la solution unique',
    calcul_trop_long: 'la vérification de l’unicité a été trop longue',
    doublon: 'elle existe déjà dans la banque (à une symétrie près)',
    autre_niveau: 'elle est d’un autre niveau (option --only)',
  },

  generate: {
    usage:
      'Usage : npm run generate -- --level HARD|EXPERT --count 50 [--workers 7] [--seed 123] [--only] [--dry-run]',
    unknownLevel: (level: string) => `Niveau inconnu : « ${level} ».`,
    unreachable: (level: string) =>
      `Le niveau ${level} demande des techniques qui ne sont pas encore programmées (groupes C et D).`,
    start: (level: string, count: number, workers: number, seed: number, dryRun: boolean) =>
      `Génération ${level} : ${count} grille(s) visée(s), ${workers} cœur(s), graine ${seed}` +
      (dryRun ? ' (essai à blanc : rien n’est enregistré).' : '.'),
    bankState: (level: string, count: number, file: string) =>
      `Banque ${level} : ${count} grille(s) (${file}).`,
    found: (done: number, total: number, id: string, score: number, groupB: number, seconds: number) =>
      `[${done}/${total}] ${id}  score ${score}, ${groupB} étape(s) du groupe B  (${seconds.toFixed(1)} s)`,
    bonus: (id: string, score: number) => `   + ${id}  score ${score} (autre niveau, gardée aussi)`,
    interrupted: 'Arrêt demandé : les grilles déjà trouvées sont enregistrées.',
    reportTitle: 'Rapport',
    duration: (seconds: number, tries: number, msPerTry: number) =>
      `Durée : ${seconds.toFixed(1)} s, ${tries} essais (${msPerTry.toFixed(0)} ms par essai et par cœur).`,
    perGrid: (level: string, seconds: number) => `Temps moyen par grille ${level} : ${seconds.toFixed(2)} s.`,
    levelsHeader: 'Grilles obtenues par niveau :',
    levelLine: (level: string, count: number, bank: number | null) =>
      `  ${level.padEnd(11)} ${String(count).padStart(5)}` + (bank === null ? '' : `   (banque : ${bank})`),
    rejectionsHeader: 'Essais écartés :',
    rejectionLine: (reason: string, count: number) => `  ${String(count).padStart(5)} × ${reason}`,
    repairs: (avg: number) => `Retouches moyennes pour l’unicité : ${avg.toFixed(1)} par essai.`,
    scoresHeader: 'Scores (min · 10 % · médiane · 90 % · max) :',
    scoreLine: (level: string, values: readonly number[], withoutHardest: number) =>
      `  ${level.padEnd(11)} ${values.join(' · ')}   (sans l’étape la plus dure, au minimum ${withoutHardest})`,
  },

  trace: {
    cell: (row: number, col: number) => `L${row}C${col}`,
    row: (n: number) => `ligne ${n}`,
    col: (n: number) => `colonne ${n}`,
    box: (n: number) => `bloc ${n}`,
    rows: (from: number, to: number) => (from === to ? `ligne ${from}` : `lignes ${from} à ${to}`),
    cols: (from: number, to: number) => (from === to ? `colonne ${from}` : `colonnes ${from} à ${to}`),
    cage: (sum: number, anchor: string) => `cage ${sum} en ${anchor}`,
    sum: (value: number) => `somme ${value}`,
    equation: (plus: readonly string[], minus: readonly string[], value: number) =>
      [plus.join(' + '), ...minus].join(' − ') + ` = ${value}`,
    and: ' et ',
    placement: (cell: string, digit: number) => `${cell} = ${digit}`,
    elimination: (cell: string, digits: string) => `${cell} ≠ ${digits}`,
    combos: (list: string) => `combinaisons : ${list}`,
    line: (index: number, name: string, where: string, effect: string, points: number) =>
      `${String(index).padStart(3)}. ${name} — ${where} : ${effect}  [+${points}]`,
    solved: 'Grille résolue par déduction.',
    notSolved: (filled: number) => `Bloqué : ${filled} cases sur 81 remplies.`,
    score: (score: number) => `Score : ${score}`,
    level: (level: string) => `Niveau : ${level}`,
    rejected: (reason: string) => `Grille écartée : ${reason}.`,
    entryPoints: (n: number) => `Points d’entrée : ${n}`,
    techniquesHeader: 'Techniques utilisées :',
    techniqueCount: (name: string, count: number, points: number) => `  ${name} × ${count} (${points} pts)`,
    cagesInfo: (count: number, single: number, unique: number) =>
      `Cages : ${count}, dont ${single} d’une case et ${unique} à combinaison unique`,
  },
} as const;
