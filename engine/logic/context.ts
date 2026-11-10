import { cageIndexByCell, cellAt, CELL_COUNT, PEERS, UNITS, type Cage, type Puzzle } from '../model';
import type { Region } from './types';

/**
 * Une égalité déduite de la règle des 45 : somme(plus) − somme(minus) = value.
 * - « innies » : cases d'une zone qui ne sont pas dans une cage entièrement incluse ;
 * - « outies » : cases qui dépassent de la zone, dans les cages qui la touchent ;
 * - mixte (plus et minus non vides) : un innie comparé à un outie.
 */
export interface DerivedConstraint {
  region: Region;
  plus: number[];
  minus: number[];
  value: number;
}

/** Tout ce qui ne change pas pendant la résolution d'une grille. */
export interface LogicContext {
  cages: readonly Cage[];
  cageOf: Int16Array;
  /** seeMatrix[a × 81 + b] vaut 1 si a et b doivent être différentes (même unité ou même cage). */
  seeMatrix: Uint8Array;
  /** Pour chaque case, la liste des cases qu'elle « voit ». */
  seen: readonly (readonly number[])[];
  derived: readonly DerivedConstraint[];
}

export function sees(ctx: LogicContext, a: number, b: number): boolean {
  return ctx.seeMatrix[a * CELL_COUNT + b] === 1;
}

/** Prépare le contexte d'une grille. `maxDerivedCells` limite la taille des égalités de la règle des 45. */
export function createContext(puzzle: Puzzle, maxDerivedCells = 5): LogicContext {
  const cageOf = cageIndexByCell(puzzle);
  const seeMatrix = new Uint8Array(CELL_COUNT * CELL_COUNT);
  for (let a = 0; a < CELL_COUNT; a++) for (const b of PEERS[a]) seeMatrix[a * CELL_COUNT + b] = 1;
  for (const cage of puzzle.cages) {
    for (const a of cage.cells) for (const b of cage.cells) if (a !== b) seeMatrix[a * CELL_COUNT + b] = 1;
  }
  const seen = Array.from({ length: CELL_COUNT }, (_, a) => {
    const list: number[] = [];
    for (let b = 0; b < CELL_COUNT; b++) if (seeMatrix[a * CELL_COUNT + b]) list.push(b);
    return list;
  });
  return {
    cages: puzzle.cages,
    cageOf,
    seeMatrix,
    seen,
    derived: buildDerived(puzzle, cageOf, maxDerivedCells),
  };
}

/** Zones de la règle des 45 : blocs, puis bandes de 1 à 9 lignes ou colonnes consécutives. */
function regions(): { region: Region; cells: number[]; units: number }[] {
  const list: { region: Region; cells: number[]; units: number }[] = [];
  for (let b = 0; b < 9; b++)
    list.push({ region: { kind: 'box', from: b, to: b }, cells: [...UNITS[18 + b]], units: 1 });
  for (let length = 1; length <= 9; length++) {
    for (let from = 0; from + length <= 9; from++) {
      const to = from + length - 1;
      const rows: number[] = [];
      const cols: number[] = [];
      for (let i = from; i <= to; i++) {
        for (let j = 0; j < 9; j++) {
          rows.push(cellAt(i, j));
          cols.push(cellAt(j, i));
        }
      }
      list.push({ region: { kind: 'rows', from, to }, cells: rows, units: length });
      list.push({ region: { kind: 'cols', from, to }, cells: cols, units: length });
    }
  }
  return list;
}

function buildDerived(puzzle: Puzzle, cageOf: Int16Array, maxCells: number): DerivedConstraint[] {
  const result: DerivedConstraint[] = [];
  const seenKeys = new Set<string>();
  const add = (region: Region, plus: number[], minus: number[], value: number): void => {
    const size = plus.length + minus.length;
    if (size === 0 || size > maxCells) return;
    plus.sort((a, b) => a - b);
    minus.sort((a, b) => a - b);
    const key = `${plus.join(',')}|${minus.join(',')}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    result.push({ region, plus, minus, value });
  };

  for (const { region, cells, units } of regions()) {
    if (cells.some((cell) => cageOf[cell] < 0)) continue;
    const inside = new Set(cells);
    const touching = [...new Set(cells.map((cell) => cageOf[cell]))];
    const regionSum = 45 * units;
    let innerSum = 0;
    let touchingSum = 0;
    const innerCells = new Set<number>();
    const partial: number[] = [];
    for (const index of touching) {
      const cage = puzzle.cages[index];
      touchingSum += cage.sum;
      if (cage.cells.every((cell) => inside.has(cell))) {
        innerSum += cage.sum;
        for (const cell of cage.cells) innerCells.add(cell);
      } else {
        partial.push(index);
      }
    }
    // Innies : les cases de la zone hors des cages entièrement incluses.
    add(
      region,
      cells.filter((cell) => !innerCells.has(cell)),
      [],
      regionSum - innerSum,
    );
    // Outies : les cases qui dépassent, dans toutes les cages qui touchent la zone.
    add(
      region,
      partial.flatMap((index) => puzzle.cages[index].cells.filter((cell) => !inside.has(cell))),
      [],
      touchingSum - regionSum,
    );
    // Mixte : on compte en plus une cage qui dépasse ; ses cases extérieures passent en « moins ».
    for (const index of partial) {
      const cage = puzzle.cages[index];
      const own = new Set(cage.cells);
      const innies = cells.filter((cell) => !innerCells.has(cell) && !own.has(cell));
      const outies = cage.cells.filter((cell) => !inside.has(cell));
      if (innies.length > 0 && outies.length > 0)
        add(region, innies, outies, regionSum - innerSum - cage.sum);
    }
  }
  return result;
}
