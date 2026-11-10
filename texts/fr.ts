// Tous les textes de l'application, en français, regroupés ici.
// Partagé par l'interface (app/) et par les scripts (trace, rapports) ; aucune logique.

export const TEXTS = {
  appName: 'Killer Sudoku',
  underConstruction: 'Application en construction',
  engineCheckOk: (ms: number) => `Moteur opérationnel : grille de test résolue en ${ms} ms.`,
  engineCheckFailed: 'Le moteur n’a pas pu résoudre la grille de test.',

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
