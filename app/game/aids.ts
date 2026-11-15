/**
 * Calculs des aides (section 9) et des outils killer (section 7.4), sans affichage : conflits,
 * vérification, combinaisons. Tout est recalculé à partir de l'état de la grille.
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

/** Vrai si toutes les cases se voient deux à deux : leurs chiffres sont alors forcément différents. */
export function allDistinct(puzzle: Puzzle, cells: readonly number[]): boolean {
  const owner = cageIndexByCell(puzzle);
  return cells.every((a, i) =>
    cells.slice(i + 1).every((b) => PEERS[a].includes(b) || owner[a] === owner[b]),
  );
}

/**
 * Vrai si une combinaison contredit les chiffres déjà posés dans ces cases : l'un d'eux n'en fait pas partie
 * (filtrage des combinaisons, section 9).
 */
export function contradicts(
  digits: readonly number[],
  cells: readonly number[],
  values: readonly number[],
): boolean {
  return cells.some((cell) => values[cell] !== 0 && !digits.includes(values[cell]));
}

/** Calculatrice libre : combinaisons d'une somme en N cases, avec chiffres obligatoires et exclus. */
export function finderLines(sum: number, count: number, required: number, excluded: number): number[][] {
  if (count < 1 || count > 9) return [];
  return combinationsWith(count, sum, required, excluded).map(digitsOf);
}

/** Bouton rapide affiché sur la grille à côté de la sélection (section 7.4). */
export type QuickAction =
  /** « + » : total des sommes des cages dont la sélection contient la case de la somme. */
  | { kind: 'sum'; total: number }
  /** « ? » : ouvre « Combinaisons » sur cette somme et ces cases. */
  | { kind: 'combinations'; sum: number; cells: readonly number[] };

/**
 * Somme et combinaisons rapides (section 7.4) :
 * - plusieurs cases portant la somme d'une cage : « + », dont le toucher affiche le total de ces sommes ;
 * - plusieurs cases, mais une seule somme de cage : « ? » sur cette somme et ces cases ;
 * - une seule case : « ? » sur toute sa cage.
 * Rien sans case active (`focus`), ni dans les autres cas.
 */
export function quickAction(
  puzzle: Puzzle,
  selection: readonly number[],
  focus: number | null,
): QuickAction | null {
  if (focus === null || selection.length === 0) return null;
  const sums = selection.flatMap((cell) =>
    puzzle.cages.filter((c) => cageAnchor(c) === cell).map((c) => c.sum),
  );
  if (selection.length >= 2 && sums.length >= 2) {
    return { kind: 'sum', total: sums.reduce((a, b) => a + b, 0) };
  }
  if (selection.length >= 2 && sums.length === 1) {
    return { kind: 'combinations', sum: sums[0], cells: selection };
  }
  if (selection.length === 1) {
    const cage = puzzle.cages.find((c) => c.cells.includes(focus));
    if (cage) return { kind: 'combinations', sum: cage.sum, cells: cage.cells };
  }
  return null;
}
