/**
 * Calculs des aides (section 9) et des outils killer (section 7.4), sans affichage : conflits,
 * vérification, combinaisons d'une cage. Tout est recalculé à partir de l'état de la grille.
 */
import { digitBit, digitsOf } from '../../engine/bits';
import { combinationsFor, combinationsWith } from '../../engine/combinations';
import {
  boxOf,
  cageAnchor,
  cageIndexByCell,
  colOf,
  PEERS,
  rowOf,
  UNITS,
  type Puzzle,
} from '../../engine/model';
import type { VirtualCage } from './state';

/**
 * Cases en conflit : un même chiffre deux fois dans une ligne, une colonne, un bloc ou une cage, ou une
 * cage dont les chiffres posés ne peuvent plus donner la somme (trop grands, ou plus aucune combinaison).
 */
export function conflictCells(puzzle: Puzzle, values: readonly number[]): Set<number> {
  const result = new Set<number>();
  const groups = [...UNITS, ...puzzle.cages.map((c) => c.cells)];
  for (const cells of groups) {
    const seen = new Map<number, number[]>();
    for (const cell of cells) {
      const v = values[cell];
      if (!v) continue;
      const list = seen.get(v) ?? [];
      list.push(cell);
      seen.set(v, list);
    }
    for (const list of seen.values()) if (list.length > 1) list.forEach((c) => result.add(c));
  }
  for (const cage of puzzle.cages) {
    const placed = cage.cells.filter((c) => values[c]);
    if (placed.length === 0) continue;
    const mask = placed.reduce((m, c) => m | digitBit(values[c]), 0);
    const sum = placed.reduce((s, c) => s + values[c], 0);
    const free = cage.cells.length - placed.length;
    const possible =
      free === 0
        ? sum === cage.sum
        : combinationsFor(free, cage.sum - sum).some((combo) => (combo & mask) === 0);
    if (!possible) placed.forEach((c) => result.add(c));
  }
  return result;
}

/** Vérification (section 9) : cases remplies dont le chiffre diffère de la solution. */
export function wrongCells(values: readonly number[], solution: readonly number[]): number[] {
  return values.flatMap((v, cell) => (v && v !== solution[cell] ? [cell] : []));
}

/** Cases de la ligne, de la colonne et du bloc d'une case (surlignage). */
export function unitCells(cell: number): Set<number> {
  const r = rowOf(cell);
  const c = colOf(cell);
  const b = boxOf(cell);
  return new Set([...UNITS[r], ...UNITS[9 + c], ...UNITS[18 + b]]);
}

/** Une cage vue par la fenêtre des combinaisons : réelle ou virtuelle. */
export interface ComboSource {
  /** Clé des combinaisons barrées (voir GameState.struck). */
  key: string;
  virtual: boolean;
  sum: number;
  cells: readonly number[];
}

/** Les cages de la case sélectionnée : sa cage réelle, puis les cages virtuelles qui la contiennent. */
export function comboSources(
  puzzle: Puzzle,
  virtualCages: readonly VirtualCage[],
  cell: number,
): ComboSource[] {
  const cage = puzzle.cages[cageIndexByCell(puzzle)[cell]];
  const sources: ComboSource[] = [
    { key: `c${cageAnchor(cage)}`, virtual: false, sum: cage.sum, cells: cage.cells },
  ];
  for (const v of virtualCages) {
    if (v.cells.includes(cell)) sources.push({ key: `v${v.id}`, virtual: true, sum: v.sum, cells: v.cells });
  }
  return sources;
}

/** Vrai si toutes les cases se voient deux à deux : leurs chiffres sont alors forcément différents. */
export function allDistinct(puzzle: Puzzle, cells: readonly number[]): boolean {
  const owner = cageIndexByCell(puzzle);
  return cells.every((a, i) =>
    cells.slice(i + 1).every((b) => PEERS[a].includes(b) || owner[a] === owner[b]),
  );
}

export interface ComboLine {
  mask: number;
  digits: number[];
  /** Faux si la combinaison contredit les chiffres déjà posés dans la cage (filtrage, section 9). */
  compatible: boolean;
}

/**
 * Combinaisons d'une cage : toutes celles de sa taille et de sa somme. Une combinaison est incompatible
 * si un chiffre déjà posé dans la cage n'en fait pas partie.
 */
export function combinationLines(source: ComboSource, values: readonly number[]): ComboLine[] {
  const placed = source.cells.reduce((m, c) => (values[c] ? m | digitBit(values[c]) : m), 0);
  return combinationsFor(source.cells.length, source.sum).map((mask) => ({
    mask,
    digits: digitsOf(mask),
    compatible: (placed & ~mask) === 0,
  }));
}

/** Calculatrice libre : combinaisons d'une somme en N cases, avec chiffres obligatoires et exclus. */
export function finderLines(sum: number, count: number, required: number, excluded: number): number[][] {
  if (count < 1 || count > 9) return [];
  return combinationsWith(count, sum, required, excluded).map(digitsOf);
}
