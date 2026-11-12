/**
 * Recherche ciblée (niveaux DIABOLIQUE, EXTRÊME, ULTIME) : les grilles tirées au hasard sont presque
 * toujours soit faciles, soit impossibles à finir par déduction. On part donc d'une grille plus facile, déjà
 * valable (solution unique, résolue par déduction), et on retouche ses cages pas à pas : à chaque essai,
 * deux cages voisines sont fusionnées puis redécoupées autrement. On ne garde une retouche que si la
 * grille reste unique et résolue, ne dépasse pas le niveau visé, et devient plus difficile.
 */
import { DIFFICULTY_CONFIG, type DifficultyConfig } from '../difficulty';
import { countSolutions } from '../exactSolver';
import { cageIndexByCell, LEVELS, orthogonalNeighbours, type Level, type Puzzle } from '../model';
import type { Rng } from '../random';
import { conditionLevel, ratePuzzle, type Rating } from '../rating';
import { partitionCells, respectsLimits, toCages } from './cages';
import { cageLimits } from './generate';

export type CompactRating = Omit<Rating, 'steps'>;

function rate(puzzle: Puzzle, config: DifficultyConfig): CompactRating {
  const full: Partial<Rating> = ratePuzzle(puzzle, config);
  delete full.steps;
  return full as CompactRating;
}

/** Avancée vers les niveaux difficiles : une étape du groupe D compte comme trois du groupe C. */
const progress = (r: CompactRating): number => r.groups.C + 3 * r.groups.D;

/** Vrai si la grille `b` est plus difficile que `a` (avancée, puis score). */
const harder = (b: CompactRating, a: CompactRating): boolean =>
  progress(b) > progress(a) || (progress(b) === progress(a) && b.score > a.score);

/**
 * Durcit une grille vers le niveau visé. Renvoie la grille et sa note dès que le niveau est atteint (score
 * et forme des cages compris), ou null si les retouches n'y suffisent pas.
 */
export function hardenPuzzle(
  rng: Rng,
  start: Puzzle,
  startRating: CompactRating,
  solution: readonly number[],
  target: Level,
  config: DifficultyConfig = DIFFICULTY_CONFIG,
): { puzzle: Puzzle; rating: CompactRating; steps: number } | null {
  const profile = config.generation[target];
  const steps = profile.harden?.steps ?? 0;
  const limits = cageLimits(target, config);
  const targetIndex = LEVELS.indexOf(target);
  let puzzle = start;
  let rating = startRating;
  for (let step = 1; step <= steps; step++) {
    // Retouche : deux cages voisines fusionnées puis redécoupées autrement.
    const owner = cageIndexByCell(puzzle);
    const a = Math.floor(rng() * puzzle.cages.length);
    const neighbours = [
      ...new Set(puzzle.cages[a].cells.flatMap(orthogonalNeighbours).map((c) => owner[c])),
    ].filter((b) => b !== a);
    if (neighbours.length === 0) continue;
    const b = neighbours[Math.floor(rng() * neighbours.length)];
    const parts = toCages(
      partitionCells(
        rng,
        [...puzzle.cages[a].cells, ...puzzle.cages[b].cells],
        solution,
        profile.cageSizes,
        limits.maxSize,
      ),
      solution,
    );
    const cages = [...puzzle.cages.filter((_, i) => i !== a && i !== b), ...parts].sort(
      (x, y) => x.cells[0] - y.cells[0],
    );
    if (!respectsLimits(cages, limits)) continue;
    const candidate: Puzzle = { cages };
    const exact = countSolutions(candidate, { maxNodes: 200_000 });
    if (!exact.complete || exact.count !== 1) continue;
    const r = rate(candidate, config);
    if (!r.solved || conditionLevel(r, config) > targetIndex || !harder(r, rating)) continue;
    puzzle = candidate;
    rating = r;
    if (r.level === target) return { puzzle, rating, steps: step };
  }
  return null;
}
