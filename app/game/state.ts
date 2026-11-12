/**
 * État d'une partie et toutes les actions du joueur, sous forme de fonctions pures : chaque action reçoit
 * l'état actuel et renvoie un nouvel état, sans rien afficher. C'est ce qui permet de tout tester
 * automatiquement, et de sauvegarder la partie telle quelle.
 *
 * Annuler/Rétablir : chaque action enregistre ce qu'elle a changé, « avant » et « après » : le contenu
 * des cases touchées et, si besoin, les combinaisons barrées et les cages virtuelles. L'historique n'a pas
 * de limite et il est sauvegardé avec la partie.
 */
import { digitBit, digitsOf } from '../../engine/bits';
import { combinationsFor } from '../../engine/combinations';
import { cageIndexByCell, CELL_COUNT, PEERS, type Puzzle } from '../../engine/model';

/** Version du format de sauvegarde d'une partie (les anciennes sont converties par migrateGame). */
export const GAME_FORMAT = 3;

/** Nombre d'erreurs qui arrête la partie quand le mode erreurs est actif (section 7.6). */
export const MAX_ERRORS = 3;

/** Contenu d'une case : un chiffre définitif (0 = vide) et des notes, dans leur ordre de saisie. */
export interface CellContent {
  value: number;
  notes: number[];
}

export interface CellChange {
  cell: number;
  before: CellContent;
  after: CellContent;
}

/** Cage ajoutée par le joueur (section 7.4) : des cases et une somme qu'il a déduite. */
export interface VirtualCage {
  id: number;
  sum: number;
  cells: number[];
}

/** Ce qui n'est pas dans les cases : combinaisons barrées (par cage) et cages virtuelles. */
export interface Extras {
  /** Combinaisons barrées, par cage : clé « c<case de la somme> » ou « v<numéro de cage virtuelle> ». */
  struck: Record<string, number[]>;
  virtualCages: VirtualCage[];
}

/** Une action annulable. */
export interface Change {
  cells: CellChange[];
  extras?: { before: Extras; after: Extras };
}

/** Aides désactivables (section 9). */
export interface Aids {
  highlightUnits: boolean;
  highlightSameDigits: boolean;
  conflicts: boolean;
  autoCleanNotes: boolean;
  filterCombinations: boolean;
  autoNotes: boolean;
  /** Mode Somme : afficher la règle des 45 (somme des cases qui dépassent d'une zone complète). */
  sumRule45: boolean;
  check: boolean;
  hint: boolean;
}

export const DEFAULT_AIDS: Aids = {
  highlightUnits: true,
  highlightSameDigits: true,
  conflicts: true,
  autoCleanNotes: true,
  filterCombinations: true,
  autoNotes: true,
  sumRule45: true,
  check: true,
  hint: true,
};

/** Préréglage « Puriste » : tout est désactivé sauf le surlignage. */
export const PURIST_AIDS: Aids = {
  highlightUnits: true,
  highlightSameDigits: true,
  conflicts: false,
  autoCleanNotes: false,
  filterCombinations: false,
  autoNotes: false,
  sumRule45: false,
  check: false,
  hint: false,
};

export interface GameState extends Extras {
  version: typeof GAME_FORMAT;
  puzzleId: string;
  values: number[];
  notes: number[][];
  /** Actions annulables, la plus récente en dernier. */
  undo: Change[];
  /** Actions annulées qu'on peut rétablir, la plus récente en dernier. */
  redo: Change[];
  /** Temps de jeu cumulé, en millisecondes (le chronomètre en cours est géré à part). */
  elapsedMs: number;
  completed: boolean;
  /**
   * Mode erreurs (section 7.6), fixé au début de la partie : chaque chiffre posé est comparé à la solution,
   * un chiffre faux compte une erreur, et la partie est perdue à la 3e.
   */
  errorMode: boolean;
  /** Erreurs commises (un effacement ou « Annuler » ne les retire pas). */
  errors: number;
  /** Partie arrêtée à 3 erreurs. */
  lost: boolean;
  /** Nombre d'indices et de vérifications utilisés (section 9). */
  hints: number;
  checks: number;
  aids: Aids;
}

export function newGame(puzzleId: string, aids: Aids = DEFAULT_AIDS, errorMode = true): GameState {
  return {
    version: GAME_FORMAT,
    puzzleId,
    values: new Array<number>(CELL_COUNT).fill(0),
    notes: Array.from({ length: CELL_COUNT }, () => []),
    struck: {},
    virtualCages: [],
    undo: [],
    redo: [],
    elapsedMs: 0,
    completed: false,
    errorMode,
    errors: 0,
    lost: false,
    hints: 0,
    checks: 0,
    aids: { ...aids },
  };
}

/**
 * Convertit une partie sauvegardée par une version précédente de l'application (format 1 : historique
 * limité aux cases, pas d'aides ni de compteurs ; format 2 : pas de mode erreurs). Les champs inconnus
 * sont conservés. Une partie commencée avant le mode erreurs le garde désactivé, pour ne pas changer ses
 * règles en cours de route.
 */
export function migrateGame<T extends object>(saved: T): T & GameState {
  const raw = saved as Partial<GameState> & { undo?: unknown[]; redo?: unknown[] };
  if (raw.version === GAME_FORMAT) return saved as T & GameState;
  const toChange = (entry: unknown): Change =>
    Array.isArray(entry) ? { cells: entry as CellChange[] } : (entry as Change);
  return {
    ...saved,
    version: GAME_FORMAT,
    struck: raw.struck ?? {},
    virtualCages: raw.virtualCages ?? [],
    undo: (raw.undo ?? []).map(toChange),
    redo: (raw.redo ?? []).map(toChange),
    hints: raw.hints ?? 0,
    checks: raw.checks ?? 0,
    aids: { ...DEFAULT_AIDS, ...raw.aids },
    errorMode: raw.errorMode ?? false,
    errors: raw.errors ?? 0,
    lost: raw.lost ?? false,
  } as T & GameState;
}

/** Vrai si la partie est finie : gagnée, ou perdue à 3 erreurs. Plus aucune saisie n'est possible. */
export function isOver(state: GameState): boolean {
  return state.completed || state.lost;
}

const contentOf = (state: GameState, cell: number): CellContent => ({
  value: state.values[cell],
  notes: [...state.notes[cell]],
});

const sameContent = (a: CellContent, b: CellContent): boolean =>
  a.value === b.value && a.notes.length === b.notes.length && a.notes.every((n, i) => n === b.notes[i]);

const extrasOf = (state: GameState): Extras => ({
  struck: state.struck,
  virtualCages: state.virtualCages,
});

/** Écrit des contenus de cases et, éventuellement, des « extras » dans une copie de l'état. */
function write(state: GameState, cells: readonly CellChange[], side: 'before' | 'after', extras?: Extras) {
  const values = [...state.values];
  const notes = [...state.notes];
  for (const change of cells) {
    values[change.cell] = change[side].value;
    notes[change.cell] = [...change[side].notes];
  }
  return { ...state, values, notes, ...(extras ?? {}) };
}

/** Enregistre une action : seules les cases qui changent vraiment entrent dans l'historique. */
function commit(state: GameState, contents: ReadonlyMap<number, CellContent>, extras?: Extras): GameState {
  const cells: CellChange[] = [];
  for (const [cell, after] of contents) {
    const before = contentOf(state, cell);
    if (!sameContent(before, after)) cells.push({ cell, before, after });
  }
  if (cells.length === 0 && !extras) return state;
  const change: Change = extras ? { cells, extras: { before: extrasOf(state), after: extras } } : { cells };
  return { ...write(state, cells, 'after', extras), undo: [...state.undo, change], redo: [] };
}

/** Cases vues par une case : sa ligne, sa colonne, son bloc et sa cage. */
export function seenCells(puzzle: Puzzle, cell: number): number[] {
  const cage = puzzle.cages[cageIndexByCell(puzzle)[cell]];
  return [...new Set([...PEERS[cell], ...cage.cells.filter((c) => c !== cell)])];
}

/**
 * Chiffre définitif dans les cases sélectionnées : il remplace leurs notes. Si toutes les cases
 * contiennent déjà ce chiffre, il est retiré (un second appui efface).
 * Avec le nettoyage automatique (section 9), le chiffre posé disparaît des notes des cases qu'il voit,
 * dans la même action (un seul « Annuler » défait le tout).
 */
export function setDigit(
  state: GameState,
  puzzle: Puzzle,
  cells: readonly number[],
  digit: number,
  solution?: readonly number[],
): GameState {
  if (isOver(state) || cells.length === 0) return state;
  const erase = cells.every((c) => state.values[c] === digit);
  const contents = new Map<number, CellContent>();
  for (const cell of cells) contents.set(cell, { value: erase ? 0 : digit, notes: [] });
  if (!erase && state.aids.autoCleanNotes) {
    for (const cell of cells) {
      for (const peer of seenCells(puzzle, cell)) {
        if (contents.has(peer) || state.values[peer] || !state.notes[peer].includes(digit)) continue;
        contents.set(peer, { value: 0, notes: state.notes[peer].filter((n) => n !== digit) });
      }
    }
  }
  const next = commit(state, contents);
  return erase ? next : countErrors(next, state, cells, digit, solution);
}

/**
 * Mode erreurs (section 7.6) : chaque case qui reçoit un chiffre faux compte une erreur (rétablir un chiffre
 * déjà compté ne compte pas à nouveau, car « Rétablir » ne passe pas par ici). À la 3e, la partie est perdue.
 */
function countErrors(
  next: GameState,
  before: GameState,
  cells: readonly number[],
  digit: number,
  solution?: readonly number[],
): GameState {
  if (!next.errorMode || !solution || next === before) return next;
  const wrong = cells.filter((c) => before.values[c] !== digit && solution[c] !== digit).length;
  if (wrong === 0) return next;
  const errors = Math.min(MAX_ERRORS, next.errors + wrong);
  return { ...next, errors, lost: errors >= MAX_ERRORS };
}

/** Chiffres faux visibles (mode erreurs) : ils restent en rouge jusqu'à ce qu'on les efface ou remplace. */
export function wrongDigits(
  state: Pick<GameState, 'errorMode' | 'values'>,
  solution: readonly number[],
): Set<number> {
  if (!state.errorMode) return new Set();
  return new Set(state.values.flatMap((v, c) => (v && v !== solution[c] ? [c] : [])));
}

/**
 * Note dans les cases sélectionnées encore vides : si toutes l'ont déjà, elle est retirée partout,
 * sinon elle est ajoutée (à la fin) là où elle manque.
 */
export function toggleNote(state: GameState, cells: readonly number[], digit: number): GameState {
  if (isOver(state)) return state;
  const empty = cells.filter((c) => state.values[c] === 0);
  const all = empty.length > 0 && empty.every((c) => state.notes[c].includes(digit));
  const contents = new Map<number, CellContent>();
  for (const cell of empty) {
    const notes = state.notes[cell];
    contents.set(cell, {
      value: 0,
      notes: all ? notes.filter((n) => n !== digit) : notes.includes(digit) ? notes : [...notes, digit],
    });
  }
  return commit(state, contents);
}

/**
 * Écrit plusieurs cases en une seule action annulable (application d'un indice).
 * Avec le nettoyage automatique, chaque chiffre posé disparaît aussi des notes des cases qu'il voit.
 */
export function writeCells(
  state: GameState,
  puzzle: Puzzle,
  contents: ReadonlyMap<number, CellContent>,
): GameState {
  if (isOver(state)) return state;
  const all = new Map(contents);
  if (state.aids.autoCleanNotes) {
    for (const [cell, { value }] of contents) {
      if (!value) continue;
      for (const peer of seenCells(puzzle, cell)) {
        if (all.has(peer) || state.values[peer] || !state.notes[peer].includes(value)) continue;
        all.set(peer, { value: 0, notes: state.notes[peer].filter((n) => n !== value) });
      }
    }
  }
  return commit(state, all);
}

/** Vide les cases sélectionnées (chiffres et notes). */
export function eraseCells(state: GameState, cells: readonly number[]): GameState {
  if (isOver(state)) return state;
  return commit(state, new Map(cells.map((c) => [c, { value: 0, notes: [] }])));
}

/** Vide toute la grille (annulable). Les cages virtuelles et combinaisons barrées restent. */
export function eraseAll(state: GameState): GameState {
  return eraseCells(
    state,
    Array.from({ length: CELL_COUNT }, (_, i) => i),
  );
}

/**
 * Candidats possibles d'une case vide : chiffres permis par sa cage (compte tenu des chiffres déjà posés
 * dans la cage) et absents de sa ligne, de sa colonne, de son bloc et de sa cage.
 */
export function candidates(puzzle: Puzzle, values: readonly number[], cell: number): number[] {
  const cage = puzzle.cages[cageIndexByCell(puzzle)[cell]];
  let placedMask = 0;
  let placedSum = 0;
  let free = 0;
  for (const c of cage.cells) {
    if (values[c]) {
      placedMask |= digitBit(values[c]);
      placedSum += values[c];
    } else free++;
  }
  let allowed = 0;
  for (const combo of combinationsFor(free, cage.sum - placedSum)) {
    if ((combo & placedMask) === 0) allowed |= combo;
  }
  for (const peer of PEERS[cell]) if (values[peer]) allowed &= ~digitBit(values[peer]);
  return digitsOf(allowed);
}

/** « Remplir toutes les notes » : chaque case vide reçoit tous ses candidats, dans l'ordre croissant. */
export function fillAllNotes(state: GameState, puzzle: Puzzle): GameState {
  if (isOver(state)) return state;
  const contents = new Map<number, CellContent>();
  state.values.forEach((v, cell) => {
    if (v === 0) contents.set(cell, { value: 0, notes: candidates(puzzle, state.values, cell) });
  });
  return commit(state, contents);
}

/** Copie des combinaisons barrées, sans celles d'une cage. */
function withoutKey(struck: Record<string, number[]>, key: string): Record<string, number[]> {
  return Object.fromEntries(Object.entries(struck).filter(([k]) => k !== key));
}

/** Barre ou rétablit une combinaison (masque de chiffres) dans la fenêtre des combinaisons d'une cage. */
export function toggleCombination(state: GameState, key: string, combo: number): GameState {
  if (isOver(state)) return state;
  const current = state.struck[key] ?? [];
  const next = current.includes(combo) ? current.filter((m) => m !== combo) : [...current, combo];
  const struck = withoutKey(state.struck, key);
  if (next.length > 0) struck[key] = next;
  return commit(state, new Map(), { struck, virtualCages: state.virtualCages });
}

/** Ajoute une cage virtuelle (au moins une case, somme de 1 à 405). */
export function addVirtualCage(state: GameState, cells: readonly number[], sum: number): GameState {
  if (isOver(state) || cells.length === 0 || sum < 1 || sum > 405) return state;
  const id = state.virtualCages.reduce((max, v) => Math.max(max, v.id), 0) + 1;
  const cage: VirtualCage = { id, sum, cells: [...new Set(cells)].sort((a, b) => a - b) };
  return commit(state, new Map(), { struck: state.struck, virtualCages: [...state.virtualCages, cage] });
}

/** Supprime une cage virtuelle (et les combinaisons barrées qui lui étaient associées). */
export function removeVirtualCage(state: GameState, id: number): GameState {
  if (isOver(state)) return state;
  const struck = withoutKey(state.struck, `v${id}`);
  return commit(state, new Map(), { struck, virtualCages: state.virtualCages.filter((v) => v.id !== id) });
}

export function canUndo(state: GameState): boolean {
  return state.undo.length > 0 && !isOver(state);
}

export function canRedo(state: GameState): boolean {
  return state.redo.length > 0 && !isOver(state);
}

export function undo(state: GameState): GameState {
  if (!canUndo(state)) return state;
  const change = state.undo[state.undo.length - 1];
  return {
    ...write(state, change.cells, 'before', change.extras?.before),
    undo: state.undo.slice(0, -1),
    redo: [...state.redo, change],
  };
}

export function redo(state: GameState): GameState {
  if (!canRedo(state)) return state;
  const change = state.redo[state.redo.length - 1];
  return {
    ...write(state, change.cells, 'after', change.extras?.after),
    undo: [...state.undo, change],
    redo: state.redo.slice(0, -1),
  };
}

/** Change les aides de la partie (ce n'est pas une action annulable). */
export function setAids(state: GameState, aids: Aids): GameState {
  return { ...state, aids: { ...aids } };
}

export function isFull(state: GameState): boolean {
  return state.values.every((v) => v !== 0);
}

/** Vrai si la grille est remplie et identique à la solution. */
export function isSolved(state: GameState, solution: readonly number[]): boolean {
  return state.values.every((v, i) => v === solution[i]);
}

/** Marque la partie comme gagnée si la grille est juste. */
export function checkVictory(state: GameState, solution: readonly number[]): GameState {
  return !isOver(state) && isSolved(state, solution) ? { ...state, completed: true } : state;
}
