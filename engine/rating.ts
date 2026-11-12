import { combinationsFor } from './combinations';
import { DIFFICULTY_CONFIG, type DifficultyConfig, type Range } from './difficulty';
import { createContext } from './logic/context';
import { entryPoints, solveLogically } from './logic/solver';
import { GROUPS, type Group, type Step } from './logic/types';
import { LEVELS, validatePuzzle, type Level, type Puzzle } from './model';

/** Pourquoi une grille est écartée (les phrases correspondantes sont dans le fichier de textes). */
export type RejectionCode =
  | 'non_resolue'
  | 'contradiction'
  | 'entre_deux_niveaux'
  | 'score_hors_limites'
  | 'cages_non_conformes'
  | 'goulot_isole';

export interface CageStats {
  minSize: number;
  maxSize: number;
  singleCell: number;
  /** Cages dont la taille et la somme n'admettent qu'une seule combinaison. */
  uniqueCombo: number;
}

export interface Summary {
  solved: boolean;
  score: number;
  techniques: Record<string, number>;
  groups: Record<Group, number>;
  /** Points de l'étape la plus difficile. */
  hardestPoints: number;
}

export interface Rating extends Summary {
  contradiction: boolean;
  entryPoints: number;
  cages: CageStats;
  level: Level | null;
  rejection: RejectionCode | null;
  steps: Step[];
}

export function cageStats(puzzle: Puzzle): CageStats {
  const sizes = puzzle.cages.map((c) => c.cells.length);
  return {
    minSize: Math.min(...sizes),
    maxSize: Math.max(...sizes),
    singleCell: sizes.filter((s) => s === 1).length,
    uniqueCombo: puzzle.cages.filter((c) => combinationsFor(c.cells.length, c.sum).length === 1).length,
  };
}

/** Score, nombre d'étapes par technique et par groupe. */
export function summarize(
  steps: readonly Step[],
  solved: boolean,
  config: DifficultyConfig = DIFFICULTY_CONFIG,
): Summary {
  const info = new Map(config.techniques.map((t) => [t.id, t]));
  const techniques: Record<string, number> = {};
  const groups = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  let score = 0;
  let hardestPoints = 0;
  for (const step of steps) {
    const t = info.get(step.technique);
    if (!t) continue;
    techniques[step.technique] = (techniques[step.technique] ?? 0) + 1;
    groups[t.group]++;
    score += t.points;
    hardestPoints = Math.max(hardestPoints, t.points);
  }
  return { solved, score, techniques, groups, hardestPoints };
}

const inRange = (value: number, [min, max]: Range): boolean =>
  (min === null || value >= min) && (max === null || value <= max);

/**
 * Niveau atteint par les seules conditions sur les techniques (sans score ni forme des cages) :
 * l'indice dans LEVELS du niveau le plus élevé dont une alternative est remplie, ou -1.
 */
export function conditionLevel(summary: Summary, config: DifficultyConfig = DIFFICULTY_CONFIG): number {
  const count = (key: string): number =>
    (GROUPS as readonly string[]).includes(key)
      ? summary.groups[key as Group]
      : (summary.techniques[key] ?? 0);
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const ok = config.levels[LEVELS[i]].conditions.some((alt) =>
      Object.entries(alt).every(([key, r]) => inRange(count(key), r)),
    );
    if (ok) return i;
  }
  return -1;
}

/**
 * Classe une grille : on retient le niveau le plus élevé dont les conditions sur les techniques sont
 * remplies, puis on vérifie son intervalle de score, la forme des cages et l'absence de goulot isolé.
 */
export function classify(
  summary: Summary,
  cages: CageStats,
  config: DifficultyConfig = DIFFICULTY_CONFIG,
): { level: Level | null; rejection: RejectionCode | null } {
  if (!summary.solved) return { level: null, rejection: 'non_resolue' };
  const index = conditionLevel(summary, config);
  if (index < 0) return { level: null, rejection: 'entre_deux_niveaux' };
  const level = LEVELS[index];
  const lc = config.levels[level];

  if (!inRange(summary.score, lc.score)) return { level: null, rejection: 'score_hors_limites' };
  const shapeOk =
    cages.minSize >= lc.cages.minSize &&
    cages.maxSize <= lc.cages.maxSize &&
    cages.singleCell <= lc.cages.maxSingleCell &&
    (lc.cages.maxUniqueCombo === null || cages.uniqueCombo <= lc.cages.maxUniqueCombo);
  if (!shapeOk) return { level: null, rejection: 'cages_non_conformes' };

  // Pas de goulot isolé : sans son étape la plus dure, la grille doit rester plus dure que le niveau inférieur.
  if (config.bottleneck.enabled && index > 0) {
    const lowerMin = config.levels[LEVELS[index - 1]].score[0];
    if (lowerMin !== null && summary.score - summary.hardestPoints < lowerMin) {
      return { level: null, rejection: 'goulot_isole' };
    }
  }
  return { level, rejection: null };
}

/** Note une grille : résolution logique complète, score, techniques, points d'entrée et niveau. */
export function ratePuzzle(puzzle: Puzzle, config: DifficultyConfig = DIFFICULTY_CONFIG): Rating {
  const issues = validatePuzzle(puzzle);
  if (issues.length > 0) throw new Error(`Grille mal formée : ${issues[0].message}`);
  const ctx = createContext(puzzle, config.rule45MaxCells);
  const result = solveLogically(ctx, config);
  const summary = summarize(result.steps, result.solved, config);
  const cages = cageStats(puzzle);
  const { level, rejection } = result.contradiction
    ? { level: null, rejection: 'contradiction' as const }
    : classify(summary, cages, config);
  return {
    ...summary,
    contradiction: result.contradiction,
    entryPoints: entryPoints(ctx, config),
    cages,
    level,
    rejection,
    steps: result.steps,
  };
}
