import { countSolutions } from '../exactSolver';
import { cageIndexByCell, orthogonalNeighbours, type Cage, type Puzzle } from '../model';
import { shuffle, type Rng } from '../random';
import { partitionCells, respectsLimits, toCages, type CageLimits } from './cages';

export type RepairFailure = 'calcul_trop_long' | 'unicite_impossible';

export interface RepairResult {
  /** La grille rendue unique, ou null en cas d'échec. */
  puzzle: Puzzle | null;
  /** Nombre de retouches effectuées. */
  repairs: number;
  failure: RepairFailure | null;
}

export interface RepairOptions {
  weights: readonly (readonly [number, number])[];
  limits: CageLimits;
  maxRepairs: number;
  /** Garde-fou du solveur exact pour chaque vérification. */
  maxNodes?: number;
}

/**
 * Étapes 3 et 4 de la génération : tant que le solveur exact trouve une deuxième solution, on retouche
 * localement les cages qui la permettent, puis on vérifie à nouveau.
 *
 * Une deuxième solution diffère de la vraie sur quelques cases, mais respecte toutes les sommes. Pour
 * l'interdire, on fusionne une cage concernée avec une voisine, puis on redécoupe cet ensemble autrement,
 * de sorte qu'au moins une nouvelle cage ait une somme différente dans la deuxième solution.
 * En dernier recours, si le niveau le permet (HARD), on isole une case dans une cage d'une case.
 */
export function makeUnique(
  rng: Rng,
  puzzle: Puzzle,
  solution: readonly number[],
  options: RepairOptions,
): RepairResult {
  let current = puzzle;
  for (let repairs = 0; ; repairs++) {
    const result = countSolutions(current, { maxNodes: options.maxNodes ?? 300_000 });
    if (!result.complete) return { puzzle: null, repairs, failure: 'calcul_trop_long' };
    if (result.count === 1) return { puzzle: current, repairs, failure: null };
    if (result.count === 0) throw new Error('Grille sans solution : la solution de départ devrait convenir.');
    if (repairs >= options.maxRepairs) return { puzzle: null, repairs, failure: 'unicite_impossible' };
    const other = result.solutions.find((s) => s.some((d, i) => d !== solution[i])) ?? result.solutions[1];
    const next =
      resplit(rng, current, solution, other, options) ?? isolate(rng, current, solution, other, options);
    if (!next) return { puzzle: null, repairs, failure: 'unicite_impossible' };
    current = next;
  }
}

/** Vrai si l'une des cages n'a pas la même somme dans l'autre solution (qui est alors exclue). */
function excludes(cages: readonly Cage[], other: readonly number[]): boolean {
  return cages.some((cage) => cage.cells.reduce((s, c) => s + other[c], 0) !== cage.sum);
}

/** Redécoupe une cage concernée, seule ou avec une cage voisine, pour exclure l'autre solution. */
export function resplit(
  rng: Rng,
  puzzle: Puzzle,
  solution: readonly number[],
  other: readonly number[],
  options: RepairOptions,
  tries = 12,
): Puzzle | null {
  const owner = cageIndexByCell(puzzle);
  const concerned = [...new Set(solution.flatMap((d, cell) => (d !== other[cell] ? [owner[cell]] : [])))];
  // Les groupes à redécouper : chaque cage concernée seule, puis avec chacune de ses voisines.
  const groups: number[][] = [];
  for (const a of concerned) {
    groups.push([a]);
    const neighbours = new Set(puzzle.cages[a].cells.flatMap(orthogonalNeighbours).map((c) => owner[c]));
    for (const b of neighbours) if (b !== a && (b > a || !concerned.includes(b))) groups.push([a, b]);
  }
  for (const group of shuffle(rng, groups)) {
    const cells = group.flatMap((i) => puzzle.cages[i].cells);
    const kept = puzzle.cages.filter((_, i) => !group.includes(i));
    for (let t = 0; t < tries; t++) {
      const parts = toCages(
        partitionCells(rng, cells, solution, options.weights, options.limits.maxSize),
        solution,
      );
      if (parts.length < 2 && group.length === 1) continue;
      if (!excludes(parts, other)) continue;
      const cages = [...kept, ...parts].sort((x, y) => x.cells[0] - y.cells[0]);
      if (respectsLimits(cages, options.limits)) return { cages };
    }
  }
  return null;
}

/** Dernier recours : isole une case qui diffère entre les deux solutions (si le niveau l'autorise). */
function isolate(
  rng: Rng,
  puzzle: Puzzle,
  solution: readonly number[],
  other: readonly number[],
  options: RepairOptions,
): Puzzle | null {
  const owner = cageIndexByCell(puzzle);
  const diff = shuffle(
    rng,
    solution.flatMap((d, cell) => (d !== other[cell] ? [cell] : [])),
  );
  for (const cell of diff) {
    const cage = puzzle.cages[owner[cell]];
    if (cage.cells.length === 1) continue;
    const rest = cage.cells.filter((c) => c !== cell);
    const parts = toCages([[cell], ...connectedParts(rest)], solution);
    const cages = [...puzzle.cages.filter((c) => c !== cage), ...parts].sort(
      (x, y) => x.cells[0] - y.cells[0],
    );
    if (respectsLimits(cages, options.limits)) return { cages };
  }
  return null;
}

/** Sépare des cases en groupes d'un seul tenant. */
export function connectedParts(cells: readonly number[]): number[][] {
  const left = new Set(cells);
  const parts: number[][] = [];
  for (const start of cells) {
    if (!left.has(start)) continue;
    left.delete(start);
    const part = [start];
    for (let i = 0; i < part.length; i++) {
      for (const n of orthogonalNeighbours(part[i])) {
        if (left.delete(n)) part.push(n);
      }
    }
    parts.push(part);
  }
  return parts;
}
