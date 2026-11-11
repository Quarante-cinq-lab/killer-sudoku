import { digitBit } from '../bits';
import { CELL_COUNT, orthogonalNeighbours, type Cage } from '../model';
import type { Rng } from '../random';

/** Contraintes de forme imposées aux cages d'une grille (issues de la configuration du niveau). */
export interface CageLimits {
  minSize: number;
  maxSize: number;
  /** Nombre maximal de cages d'une seule case dans toute la grille. */
  maxSingleCell: number;
}

/** Tire une taille de cage au hasard, selon les poids [taille, poids] du profil. */
export function pickSize(rng: Rng, weights: readonly (readonly [number, number])[]): number {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let x = rng() * total;
  for (const [size, w] of weights) {
    x -= w;
    if (x < 0) return size;
  }
  return weights[weights.length - 1][0];
}

/**
 * Découpe un ensemble de cases en morceaux d'un seul tenant, sans chiffre répété dans un morceau.
 *
 * On part toujours de la case la plus « coincée » (celle qui a le moins de voisines libres) : cela
 * évite de laisser derrière soi des cases isolées. Chaque morceau grandit jusqu'à une taille tirée au
 * sort, en préférant le plus souvent, lui aussi, les voisines les plus coincées.
 * Les cases restées seules sont ensuite rattachées, si possible, à un morceau voisin.
 */
export function partitionCells(
  rng: Rng,
  cells: readonly number[],
  solution: readonly number[],
  weights: readonly (readonly [number, number])[],
  maxSize: number,
): number[][] {
  const free = new Uint8Array(CELL_COUNT);
  for (const c of cells) free[c] = 1;
  const owner = new Int16Array(CELL_COUNT).fill(-1);
  const parts: number[][] = [];
  const freeNeighbours = (cell: number): number =>
    orthogonalNeighbours(cell).reduce((n, x) => n + free[x], 0);
  /** Case la moins entourée de cases libres (au hasard parmi les ex æquo). */
  const mostCornered = (list: readonly number[]): number => {
    let best: number[] = [];
    let bestCount = 5;
    for (const c of list) {
      const n = freeNeighbours(c);
      if (n < bestCount) {
        best = [c];
        bestCount = n;
      } else if (n === bestCount) best.push(c);
    }
    return best[Math.floor(rng() * best.length)];
  };

  let remaining = cells.length;
  while (remaining > 0) {
    const start = mostCornered(cells.filter((c) => free[c]));
    const target = Math.min(pickSize(rng, weights), maxSize);
    const part = [start];
    let used = digitBit(solution[start]);
    free[start] = 0;
    owner[start] = parts.length;
    while (part.length < target) {
      const frontier = [
        ...new Set(
          part.flatMap(orthogonalNeighbours).filter((n) => free[n] && !(used & digitBit(solution[n]))),
        ),
      ];
      if (frontier.length === 0) break;
      // Deux fois sur trois la voisine la plus coincée (formes compactes), sinon une voisine au hasard.
      const next = rng() < 0.67 ? mostCornered(frontier) : frontier[Math.floor(rng() * frontier.length)];
      free[next] = 0;
      owner[next] = parts.length;
      used |= digitBit(solution[next]);
      part.push(next);
    }
    remaining -= part.length;
    parts.push(part);
  }

  // Rattache les cases isolées à un morceau voisin qui n'a pas encore leur chiffre (le plus petit d'abord).
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length !== 1) continue;
    const cell = parts[i][0];
    const options = orthogonalNeighbours(cell)
      .map((n) => owner[n])
      .filter((p) => p !== -1 && p !== i && parts[p].length > 0 && parts[p].length < maxSize)
      .filter((p) => parts[p].every((c) => solution[c] !== solution[cell]))
      .sort((a, b) => parts[a].length - parts[b].length);
    if (options.length === 0) continue;
    parts[options[0]].push(cell);
    owner[cell] = options[0];
    parts[i] = [];
  }
  return parts.filter((p) => p.length > 0).map((p) => p.sort((a, b) => a - b));
}

/** Transforme des morceaux de grille en cages (somme d'après la solution), triées par première case. */
export function toCages(parts: readonly (readonly number[])[], solution: readonly number[]): Cage[] {
  return parts
    .map((p) => {
      const cells = [...p].sort((a, b) => a - b);
      return { sum: cells.reduce((s, c) => s + solution[c], 0), cells };
    })
    .sort((a, b) => a.cells[0] - b.cells[0]);
}

/** Vrai si les cages respectent les tailles permises et le nombre maximal de cages d'une case. */
export function respectsLimits(cages: readonly { cells: readonly number[] }[], limits: CageLimits): boolean {
  let singles = 0;
  for (const cage of cages) {
    const size = cage.cells.length;
    if (size === 1) singles++;
    if (size < limits.minSize || size > limits.maxSize) return false;
  }
  return singles <= limits.maxSingleCell;
}

/**
 * Étape 2 de la génération : découpe toute la grille en cages selon le profil du niveau.
 * Renvoie null si, après plusieurs essais, le découpage ne respecte pas les limites (cases isolées).
 */
export function growCages(
  rng: Rng,
  solution: readonly number[],
  weights: readonly (readonly [number, number])[],
  limits: CageLimits,
  attempts = 30,
): Cage[] | null {
  const all = Array.from({ length: CELL_COUNT }, (_, i) => i);
  for (let i = 0; i < attempts; i++) {
    const cages = toCages(partitionCells(rng, all, solution, weights, limits.maxSize), solution);
    if (respectsLimits(cages, limits)) return cages;
  }
  return null;
}
