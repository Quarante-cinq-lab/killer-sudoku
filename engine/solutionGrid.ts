import { digitBit } from './bits';
import { boxOf, CELL_COUNT, colOf, rowOf } from './model';
import { shuffle, type Rng } from './random';

/**
 * Tire au hasard une grille de sudoku complète et valide (étape 1 de l'algorithme de génération,
 * section 6.1) : on remplit case par case, en essayant les chiffres dans un ordre aléatoire,
 * et on revient en arrière en cas d'impasse.
 */
export function randomSolutionGrid(rng: Rng): number[] {
  const grid = new Array<number>(CELL_COUNT).fill(0);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);

  const fill = (cell: number): boolean => {
    if (cell === CELL_COUNT) return true;
    const r = rowOf(cell);
    const c = colOf(cell);
    const b = boxOf(cell);
    for (const d of shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const bit = digitBit(d);
      if ((rows[r] | cols[c] | boxes[b]) & bit) continue;
      grid[cell] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (fill(cell + 1)) return true;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
    }
    grid[cell] = 0;
    return false;
  };

  fill(0);
  return grid;
}
