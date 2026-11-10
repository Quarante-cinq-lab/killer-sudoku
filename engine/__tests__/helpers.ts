import { digitBit } from '../bits';
import { maxCageSum, minCageSum } from '../combinations';
import { boxOf, CELL_COUNT, colOf, orthogonalNeighbours, rowOf, type Cage, type Puzzle } from '../model';
import { randomInt, shuffle, type Rng } from '../random';

/**
 * Solveur « témoin », volontairement naïf et écrit autrement que le solveur exact :
 * il remplit les cases cage par cage, dans l'ordre, sans aucune déduction, en vérifiant seulement
 * les règles. Il est lent, mais si les deux solveurs trouvent toujours le même nombre de solutions,
 * on peut avoir confiance dans le solveur exact.
 */
export function naiveCountSolutions(puzzle: Puzzle, limit = 2): number {
  const cages = [...puzzle.cages].sort((a, b) => Math.min(...a.cells) - Math.min(...b.cells));
  const order: { cell: number; cage: number; remainingInCage: number }[] = [];
  cages.forEach((cage, i) => {
    const cells = [...cage.cells].sort((a, b) => a - b);
    cells.forEach((cell, k) => order.push({ cell, cage: i, remainingInCage: cells.length - k - 1 }));
  });
  const grid = new Array<number>(CELL_COUNT).fill(0);
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  const cageUsed = new Array<number>(cages.length).fill(0);
  const cageSum = new Array<number>(cages.length).fill(0);
  let count = 0;

  const fill = (pos: number): void => {
    if (pos === order.length) {
      count++;
      return;
    }
    const { cell, cage, remainingInCage } = order[pos];
    const r = rowOf(cell);
    const c = colOf(cell);
    const b = boxOf(cell);
    for (let d = 1; d <= 9 && count < limit; d++) {
      const bit = digitBit(d);
      if ((rows[r] | cols[c] | boxes[b] | cageUsed[cage]) & bit) continue;
      const left = cages[cage].sum - cageSum[cage] - d;
      if (
        remainingInCage === 0
          ? left !== 0
          : left < minCageSum(remainingInCage) || left > maxCageSum(remainingInCage)
      ) {
        continue;
      }
      grid[cell] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      cageUsed[cage] |= bit;
      cageSum[cage] += d;
      fill(pos + 1);
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      cageUsed[cage] &= ~bit;
      cageSum[cage] -= d;
    }
  };

  fill(0);
  return count;
}

/**
 * Découpe une grille résolue en cages aléatoires de taille `minSize` à `maxSize`, sans chiffre répété
 * dans une cage. Version simple réservée aux tests ; le vrai générateur (étape 3) suivra les profils
 * de niveau. Une cage peut rester plus petite que prévu si elle est coincée.
 */
export function randomCages(rng: Rng, solution: readonly number[], minSize: number, maxSize: number): Puzzle {
  const owner = new Array<number>(CELL_COUNT).fill(-1);
  const cages: Cage[] = [];
  for (const start of shuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, i) => i),
  )) {
    if (owner[start] !== -1) continue;
    const target = randomInt(rng, minSize, maxSize);
    const cells = [start];
    let used = digitBit(solution[start]);
    owner[start] = cages.length;
    while (cells.length < target) {
      const frontier = cells
        .flatMap(orthogonalNeighbours)
        .filter((n) => owner[n] === -1 && (used & digitBit(solution[n])) === 0);
      if (frontier.length === 0) break;
      const next = frontier[Math.floor(rng() * frontier.length)];
      owner[next] = cages.length;
      used |= digitBit(solution[next]);
      cells.push(next);
    }
    cells.sort((a, b) => a - b);
    cages.push({ sum: cells.reduce((s, cell) => s + solution[cell], 0), cells });
  }
  return { cages };
}
