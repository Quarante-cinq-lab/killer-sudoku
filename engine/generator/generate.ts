import { DIFFICULTY_CONFIG, type DifficultyConfig } from '../difficulty';
import { GROUPS } from '../logic/types';
import type { Level, Puzzle } from '../model';
import { createRng } from '../random';
import { ratePuzzle, type Rating, type RejectionCode } from '../rating';
import { randomSolutionGrid } from '../solutionGrid';
import { growCages, type CageLimits } from './cages';
import { makeUnique, type RepairFailure } from './repair';

/** Pourquoi une grille candidate n'est pas retenue. */
export type GenerationRejection = 'decoupage_impossible' | RepairFailure | RejectionCode;

export interface Candidate {
  seed: number;
  /** Niveau visé (il détermine le profil de découpage). */
  target: Level;
  puzzle: Puzzle | null;
  solution: number[];
  repairs: number;
  /** Notation complète, sans le détail des étapes (null si la grille n'a pas pu être rendue unique). */
  rating: Omit<Rating, 'steps'> | null;
  /** Niveau obtenu : il peut différer du niveau visé. */
  level: Level | null;
  rejection: GenerationRejection | null;
}

/** Contraintes de découpage d'un niveau. */
export function cageLimits(level: Level, config: DifficultyConfig = DIFFICULTY_CONFIG): CageLimits {
  const { minSize, maxSize, maxSingleCell } = config.levels[level].cages;
  return { minSize, maxSize, maxSingleCell };
}

/**
 * Vrai si le moteur peut produire ce niveau : il faut au moins une technique programmée dans chaque
 * groupe que ses conditions exigent (par exemple le groupe C pour DIABOLIQUE).
 */
export function isLevelReachable(level: Level, config: DifficultyConfig = DIFFICULTY_CONFIG): boolean {
  return config.levels[level].conditions.some((alt) =>
    Object.entries(alt).every(([key, [min]]) => {
      if (min === null || min === 0) return true;
      if (!(GROUPS as readonly string[]).includes(key)) return config.techniques.some((t) => t.id === key);
      return config.techniques.some((t) => t.group === key);
    }),
  );
}

/**
 * Produit une grille candidate à partir d'une graine (section 6.1, étapes 1 à 5) : solution aléatoire,
 * découpage en cages selon le profil du niveau visé, réparation de l'unicité, puis notation.
 * Avec la même graine et la même configuration, le résultat est toujours le même.
 */
export function generateCandidate(
  seed: number,
  target: Level,
  config: DifficultyConfig = DIFFICULTY_CONFIG,
): Candidate {
  const rng = createRng(seed);
  const solution = randomSolutionGrid(rng);
  const profile = config.generation[target];
  const limits = cageLimits(target, config);
  const base = { seed, target, solution };

  const cages = growCages(rng, solution, profile.cageSizes, limits);
  if (!cages) {
    return {
      ...base,
      puzzle: null,
      repairs: 0,
      rating: null,
      level: null,
      rejection: 'decoupage_impossible',
    };
  }
  const repaired = makeUnique(rng, { cages }, solution, {
    weights: profile.cageSizes,
    limits,
    maxRepairs: profile.maxRepairs,
  });
  if (!repaired.puzzle) {
    return {
      ...base,
      puzzle: null,
      repairs: repaired.repairs,
      rating: null,
      level: null,
      rejection: repaired.failure,
    };
  }
  const full: Partial<Rating> = ratePuzzle(repaired.puzzle, config);
  delete full.steps; // le détail des étapes est inutile ici et alourdirait les échanges entre cœurs
  const rating = full as Omit<Rating, 'steps'>;
  return {
    ...base,
    puzzle: repaired.puzzle,
    repairs: repaired.repairs,
    rating,
    level: rating.level,
    rejection: rating.rejection,
  };
}
