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
    legal: 'Projet personnel, non destiné à la diffusion. Tous droits réservés.',
    version: (app: string, engine: string) => `Version ${app} · moteur ${engine}`,
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
    eraseAll: 'Tout effacer',
    eraseAllConfirm: 'Effacer tous les chiffres et toutes les notes ?',
    eraseSelection: 'Effacer la sélection',
    fillNotes: 'Remplir toutes les notes',
    close: 'Fermer',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    fullButWrong: 'La grille est remplie mais contient une erreur.',
    check: 'Vérifier la grille',
    checkNone: 'Aucune erreur pour l’instant.',
    checkFound: (n: number) =>
      n === 1 ? '1 chiffre faux, marqué en rouge.' : `${n} chiffres faux, marqués en rouge.`,
    aidsTitle: 'Aides de la partie',
    aids: {
      highlightUnits: 'Surlignage ligne, colonne et bloc',
      highlightSameDigits: 'Surlignage des chiffres identiques',
      conflicts: 'Signalement des conflits',
      autoCleanNotes: 'Nettoyage automatique des notes',
      filterCombinations: 'Filtrage des combinaisons',
      autoNotes: 'Notes automatiques',
      check: 'Vérification',
      hint: 'Indice',
    },
    purist: 'Préréglage Puriste',
    allAids: 'Tout réactiver',
    on: 'Activée',
    off: 'Désactivée',
    combinationsTitle: 'Combinaisons',
    cageLabel: (sum: number, n: number) => `Cage ${sum} en ${n} cases`,
    virtualCageLabel: (sum: number, n: number) => `Cage virtuelle ${sum} en ${n} cases`,
    mayRepeat: 'Ces cases ne se voient pas toutes : un chiffre peut s’y répéter.',
    selectCell: 'Sélectionne une case de la grille.',
    noCombination: 'Aucune combinaison.',
    strikeHelp: 'Touche une combinaison pour la barrer ou la rétablir.',
    calculatorTitle: 'Calculatrice',
    calcSum: 'Somme',
    calcCount: 'Nombre de cases',
    calcTyping: 'Tape les chiffres avec le grand pavé ; « 0 » pour 10, 20…',
    calcDigits: 'Chiffres obligatoires ou exclus : touche un chiffre pour changer',
    calcList: 'Lister les combinaisons',
    calcClear: 'C',
    virtualTitle: 'Cages virtuelles',
    virtualHelp: 'Sélectionne des cases, tape leur somme avec le pavé, puis crée la cage.',
    virtualCreate: (n: number) => (n <= 1 ? `Créer avec ${n} case` : `Créer avec ${n} cases`),
    virtualNone: 'Aucune cage virtuelle.',
    virtualItem: (sum: number, n: number) => `${sum} en ${n} case${n > 1 ? 's' : ''}`,
    show: 'Montrer',
    remove: 'Supprimer',
    victoryStats: (hints: number, checks: number) =>
      `${hints} indice${hints > 1 ? 's' : ''} · ${checks} vérification${checks > 1 ? 's' : ''}`,
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

  /** Explication de chaque technique (2e niveau de l'indice). */
  explanations: {
    naked_single: 'Il ne reste qu’un seul chiffre possible dans cette case.',
    hidden_single: 'Dans cette zone, ce chiffre ne peut aller que dans une seule case.',
    cage_combination:
      'Avec sa somme et son nombre de cases, cette cage n’admet que certaines combinaisons : les autres chiffres sont impossibles.',
    rule45_single:
      'Une ligne, une colonne ou un bloc fait toujours 45. En retirant les cages entièrement à l’intérieur, on obtient la valeur de la case qui dépasse ou qui manque.',
    pointing:
      'Dans ce bloc, ce chiffre ne peut être que sur une seule ligne ou colonne : il est exclu du reste de cette ligne ou colonne.',
    box_line:
      'Sur cette ligne ou colonne, ce chiffre ne peut être que dans un seul bloc : il est exclu du reste de ce bloc.',
    cage_unit_overlap:
      'Un chiffre obligatoire de la cage ne peut se trouver que dans la partie commune avec une ligne, une colonne ou un bloc : il est exclu des autres cases de cette zone (ou l’inverse).',
    naked_pair:
      'Deux cases de cette zone n’acceptent que les deux mêmes chiffres : ces chiffres sont exclus des autres cases de la zone.',
    hidden_pair:
      'Deux chiffres ne peuvent aller que dans les deux mêmes cases de cette zone : ces cases ne peuvent rien contenir d’autre.',
    naked_triple:
      'Trois cases de cette zone se partagent trois chiffres : ces chiffres sont exclus des autres cases de la zone.',
    hidden_triple:
      'Trois chiffres ne peuvent aller que dans les trois mêmes cases de cette zone : ces cases ne peuvent rien contenir d’autre.',
    innies_outies_multi:
      'Règle des 45 sur plusieurs cases : la somme des cases qui dépassent ou qui manquent est connue, ce qui limite leurs chiffres.',
    cage_splitting:
      'La règle des 45 donne la somme d’une partie de la cage : le reste de la cage a donc une somme connue, et moins de combinaisons.',
    cage_comparison:
      'La règle des 45 relie les cases qui dépassent et celles qui manquent par une égalité : on compare leurs valeurs possibles.',
    parity:
      'Une ligne, une colonne ou un bloc contient toujours cinq chiffres impairs : en comptant les impairs imposés par les cages, on élimine des candidats.',
    cross_cage_combinations:
      'Les combinaisons de ces cages d’une même zone doivent être compatibles entre elles : certaines sont impossibles.',
    naked_quad:
      'Quatre cases de cette zone se partagent quatre chiffres : ces chiffres sont exclus des autres cases de la zone.',
    hidden_quad:
      'Quatre chiffres ne peuvent aller que dans les quatre mêmes cases de cette zone : ces cases ne peuvent rien contenir d’autre.',
    x_wing:
      'Sur deux lignes (ou colonnes), ce chiffre n’a que deux places, alignées deux à deux : il est exclu du reste de ces colonnes (ou lignes).',
    y_wing:
      'Une case pivot à deux chiffres voit deux « ailes » : quel que soit le chiffre du pivot, l’une des ailes vaut le chiffre commun, qui est donc exclu des cases voyant les deux ailes.',
    xyz_wing:
      'Comme un Y-Wing, mais le pivot a trois candidats : le chiffre commun est exclu des cases qui voient le pivot et les deux ailes.',
    swordfish:
      'Sur trois lignes (ou colonnes), ce chiffre n’a de place que dans les trois mêmes colonnes (ou lignes) : il est exclu du reste de ces colonnes (ou lignes).',
  },

  hint: {
    title: (level: number) => `Indice ${level}/3`,
    zone: (name: string, zone: string) => `${name} : ${zone}`,
    where: (where: string) => `Cases utilisées : ${where}`,
    more: 'Expliquer',
    apply: 'Appliquer',
    errorTitle: 'Il y a une erreur dans la grille.',
    errorDetail: (digits: number, notes: number) =>
      [
        digits > 0 ? (digits === 1 ? '1 chiffre faux' : `${digits} chiffres faux`) : '',
        notes > 0
          ? notes === 1
            ? '1 case dont les notes ont perdu le bon chiffre'
            : `${notes} cases dont les notes ont perdu le bon chiffre`
          : '',
      ]
        .filter(Boolean)
        .join(' et ') + ' (en jaune).',
    fixErrors: 'Effacer ces erreurs',
    stuck: 'Aucune déduction simple ne s’applique ici. On peut révéler une case.',
    reveal: 'Révéler une case',
    solved: 'La grille est déjà complète.',
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
