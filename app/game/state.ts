/**
 * État d'une partie et toutes les actions du joueur, sous forme de fonctions pures : chaque action reçoit
 * l'état actuel et renvoie un nouvel état, sans rien afficher. C'est ce qui permet de tout tester
 * automatiquement, et de sauvegarder la partie telle quelle.
 *
 * Annuler/Rétablir : chaque action enregistre, pour chaque case touchée, son contenu avant et après.
 * Annuler remet le contenu « avant », Rétablir le contenu « après ». L'historique n'a pas de limite.
 */
import { digitBit, digitsOf } from '../../engine/bits';
import { combinationsFor } from '../../engine/combinations';
import { cageIndexByCell, CELL_COUNT, PEERS, type Puzzle } from '../../engine/model';

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

export interface GameState {
  puzzleId: string;
  values: number[];
  notes: number[][];
  /** Actions annulables, la plus récente en dernier. */
  undo: CellChange[][];
  /** Actions annulées qu'on peut rétablir, la plus récente en dernier. */
  redo: CellChange[][];
  /** Temps de jeu cumulé, en millisecondes (le chronomètre en cours est géré à part). */
  elapsedMs: number;
  completed: boolean;
}

export function newGame(puzzleId: string): GameState {
  return {
    puzzleId,
    values: new Array<number>(CELL_COUNT).fill(0),
    notes: Array.from({ length: CELL_COUNT }, () => []),
    undo: [],
    redo: [],
    elapsedMs: 0,
    completed: false,
  };
}

const contentOf = (state: GameState, cell: number): CellContent => ({
  value: state.values[cell],
  notes: [...state.notes[cell]],
});

const sameContent = (a: CellContent, b: CellContent): boolean =>
  a.value === b.value && a.notes.length === b.notes.length && a.notes.every((n, i) => n === b.notes[i]);

/** Écrit des contenus dans une copie de l'état. */
function write(state: GameState, contents: readonly { cell: number; content: CellContent }[]): GameState {
  const values = [...state.values];
  const notes = [...state.notes];
  for (const { cell, content } of contents) {
    values[cell] = content.value;
    notes[cell] = [...content.notes];
  }
  return { ...state, values, notes };
}

/** Applique une action du joueur : les cases qui changent vraiment forment une entrée d'historique. */
function act(
  state: GameState,
  next: (cell: number, current: CellContent) => CellContent,
  cells: Iterable<number>,
) {
  const changes: CellChange[] = [];
  for (const cell of new Set(cells)) {
    const before = contentOf(state, cell);
    const after = next(cell, before);
    if (!sameContent(before, after)) changes.push({ cell, before, after });
  }
  if (changes.length === 0) return state;
  const written = write(
    state,
    changes.map((c) => ({ cell: c.cell, content: c.after })),
  );
  return { ...written, undo: [...state.undo, changes], redo: [] };
}

/**
 * Chiffre définitif dans les cases sélectionnées : il remplace leurs notes.
 * Si toutes les cases contiennent déjà ce chiffre, il est retiré (un second appui efface).
 */
export function setDigit(state: GameState, cells: readonly number[], digit: number): GameState {
  if (state.completed) return state;
  const all = cells.length > 0 && cells.every((c) => state.values[c] === digit);
  return act(state, () => ({ value: all ? 0 : digit, notes: [] }), cells);
}

/**
 * Note dans les cases sélectionnées encore vides : si toutes l'ont déjà, elle est retirée partout,
 * sinon elle est ajoutée (à la fin) là où elle manque.
 */
export function toggleNote(state: GameState, cells: readonly number[], digit: number): GameState {
  if (state.completed) return state;
  const empty = cells.filter((c) => state.values[c] === 0);
  const all = empty.length > 0 && empty.every((c) => state.notes[c].includes(digit));
  return act(
    state,
    (_, current) => ({
      value: 0,
      notes: all
        ? current.notes.filter((n) => n !== digit)
        : current.notes.includes(digit)
          ? current.notes
          : [...current.notes, digit],
    }),
    empty,
  );
}

/** Vide les cases sélectionnées (chiffres et notes). */
export function eraseCells(state: GameState, cells: readonly number[]): GameState {
  if (state.completed) return state;
  return act(state, () => ({ value: 0, notes: [] }), cells);
}

/** Vide toute la grille (annulable). */
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
  if (state.completed) return state;
  const empty = state.values.flatMap((v, cell) => (v === 0 ? [cell] : []));
  return act(state, (cell) => ({ value: 0, notes: candidates(puzzle, state.values, cell) }), empty);
}

export function canUndo(state: GameState): boolean {
  return state.undo.length > 0 && !state.completed;
}

export function canRedo(state: GameState): boolean {
  return state.redo.length > 0 && !state.completed;
}

export function undo(state: GameState): GameState {
  if (!canUndo(state)) return state;
  const changes = state.undo[state.undo.length - 1];
  const written = write(
    state,
    changes.map((c) => ({ cell: c.cell, content: c.before })),
  );
  return { ...written, undo: state.undo.slice(0, -1), redo: [...state.redo, changes] };
}

export function redo(state: GameState): GameState {
  if (!canRedo(state)) return state;
  const changes = state.redo[state.redo.length - 1];
  const written = write(
    state,
    changes.map((c) => ({ cell: c.cell, content: c.after })),
  );
  return { ...written, undo: [...state.undo, changes], redo: state.redo.slice(0, -1) };
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
  return !state.completed && isSolved(state, solution) ? { ...state, completed: true } : state;
}
