import { ALL_DIGITS, digitBit, digitsOf, maskOf } from '../../bits';
import { cellAt, CELL_COUNT, isSolutionOf, parseSolution, type Cage, type Puzzle } from '../../model';
import { createContext, type LogicContext } from '../../logic/context';
import { initialState } from '../../logic/state';
import type { LogicState, Step } from '../../logic/types';

/** Case désignée comme dans la trace : ligne et colonne de 1 à 9. */
export const L = (row: number, col: number): number => cellAt(row - 1, col - 1);

/**
 * Une grille de sudoku connue et valide. Les grilles de test construites dessus ont leurs sommes
 * calculées à partir d'elle : on connaît donc toujours la bonne réponse.
 */
export const S = parseSolution(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
);

/** Grille dont les cages données ont leurs sommes tirées de S ; toutes les autres cases sont des cages d'une case. */
export function puzzleOnS(cages: number[][]): Puzzle {
  const used = new Set(cages.flat());
  const all: Cage[] = cages.map((cells) => ({ sum: cells.reduce((s, c) => s + S[c], 0), cells }));
  for (let cell = 0; cell < CELL_COUNT; cell++)
    if (!used.has(cell)) all.push({ sum: S[cell], cells: [cell] });
  const puzzle = { cages: all };
  if (!isSolutionOf(puzzle, S)) throw new Error('Cages de test incompatibles avec la grille S.');
  return puzzle;
}

/** Contexte + état de départ d'une grille construite sur S. */
export function setupOnS(cages: number[][]): { ctx: LogicContext; state: LogicState } {
  const ctx = createContext(puzzleOnS(cages));
  return { ctx, state: initialState(ctx) };
}

/**
 * Contexte « à vide » : seules les cages données comptent (pour savoir quelles cases se voient et
 * énumérer leurs combinaisons). À ne pas utiliser pour la règle des 45.
 */
export function contextWith(cages: Cage[] = []): LogicContext {
  const used = new Set(cages.flatMap((c) => c.cells));
  const filler: Cage[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) if (!used.has(cell)) filler.push({ sum: 0, cells: [cell] });
  return createContext({ cages: [...cages, ...filler] });
}

/** État où toutes les cases ont tous les candidats. */
export function blankState(): LogicState {
  return { cand: new Uint16Array(CELL_COUNT).fill(ALL_DIGITS), value: new Uint8Array(CELL_COUNT) };
}

export function setCands(state: LogicState, cell: number, digits: number[]): void {
  state.cand[cell] = maskOf(digits);
}

export function removeCand(state: LogicState, cells: number[], digit: number): void {
  for (const cell of cells) state.cand[cell] &= ~digitBit(digit);
}

/** Éliminations d'une étape sous forme lisible : { case: [chiffres] }. */
export function elimMap(step: Step): Record<number, number[]> {
  return Object.fromEntries(step.eliminations.map((e) => [e.cell, digitsOf(e.digits)]));
}

/** Même chose pour une liste de cases qui perdent toutes les mêmes chiffres. */
export function expectedElims(cells: number[], digits: number[]): Record<number, number[]> {
  return Object.fromEntries(cells.map((cell) => [cell, digits]));
}

export const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Cases d'une ligne / colonne (1 à 9), sauf celles listées. */
export const rowCells = (row: number, except: number[] = []): number[] =>
  range(1, 9)
    .map((c) => L(row, c))
    .filter((cell) => !except.includes(cell));
export const colCells = (col: number, except: number[] = []): number[] =>
  range(1, 9)
    .map((r) => L(r, col))
    .filter((cell) => !except.includes(cell));
