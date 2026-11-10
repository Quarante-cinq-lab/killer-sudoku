import { DIFFICULTY_CONFIG, type DifficultyConfig } from '../difficulty';
import type { LogicContext } from './context';
import { applyStep, cloneState, initialState, isSolved } from './state';
import { TECHNIQUES } from './techniques';
import type { LogicState, Step } from './types';

export interface LogicResult {
  /** Vrai si toutes les cases ont été remplies par déduction. */
  solved: boolean;
  /** Vrai si une étape a mené à une contradiction (grille fausse ou état de départ erroné). */
  contradiction: boolean;
  steps: Step[];
  state: LogicState;
}

/** Prochaine étape : la première trouvée par la technique la plus simple qui s'applique. */
export function nextStep(
  state: LogicState,
  ctx: LogicContext,
  config: DifficultyConfig = DIFFICULTY_CONFIG,
): Step | null {
  for (const { id } of config.techniques) {
    for (const step of TECHNIQUES[id](state, ctx)) return step;
  }
  return null;
}

/**
 * Résout une grille comme un joueur : à chaque tour, on applique la technique la plus simple qui
 * fait progresser, puis on recommence depuis la plus simple. On s'arrête quand la grille est pleine
 * ou quand plus aucune technique ne s'applique.
 */
export function solveLogically(
  ctx: LogicContext,
  config: DifficultyConfig = DIFFICULTY_CONFIG,
  start?: LogicState,
  maxSteps = 5000,
): LogicResult {
  const state = start ? cloneState(start) : initialState(ctx);
  const steps: Step[] = [];
  while (!isSolved(state) && steps.length < maxSteps) {
    const step = nextStep(state, ctx, config);
    if (!step) break;
    steps.push(step);
    if (!applyStep(state, ctx, step)) return { solved: false, contradiction: true, steps, state };
  }
  return { solved: isSolved(state), contradiction: false, steps, state };
}

/**
 * Points d'entrée : nombre de déductions différentes du groupe A possibles dès le départ.
 * Moins il y en a, plus la grille est difficile à attaquer.
 */
export function entryPoints(ctx: LogicContext, config: DifficultyConfig = DIFFICULTY_CONFIG): number {
  const state = initialState(ctx);
  const effects = new Set<string>();
  for (const { id, group } of config.techniques) {
    if (group !== 'A') continue;
    for (const step of TECHNIQUES[id](state, ctx)) {
      const key = [
        ...step.placements.map((p) => `p${p.cell}=${p.digit}`),
        ...step.eliminations.map((e) => `e${e.cell}-${e.digits}`),
      ].join(' ');
      effects.add(key);
    }
  }
  return effects.size;
}
