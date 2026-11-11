/**
 * Indice progressif (cahier des charges, section 9) : à partir de la grille du joueur (chiffres posés et
 * notes), on cherche la déduction la plus simple qui fait progresser. Si la grille contient une erreur,
 * l'indice la signale au lieu de proposer une déduction.
 */
import { digitBit, digitsOf, maskOf } from './bits';
import { DIFFICULTY_CONFIG, type DifficultyConfig } from './difficulty';
import type { LogicContext } from './logic/context';
import { nextStep } from './logic/solver';
import { initialState, isSolved, placeDigit } from './logic/state';
import type { LogicState, Step } from './logic/types';
import { CELL_COUNT } from './model';

export type Hint =
  /** Chiffres faux, ou cases dont les notes ne contiennent plus le bon chiffre. */
  | { kind: 'error'; wrongDigits: number[]; missingNotes: number[] }
  /** Une déduction, et l'état des candidats à partir duquel elle a été trouvée. */
  | { kind: 'step'; step: Step; state: LogicState }
  /** Aucune technique programmée ne s'applique (ne devrait pas arriver avec les grilles de la banque). */
  | { kind: 'stuck' }
  | { kind: 'solved' };

/**
 * Candidats tels que le joueur les connaît : chiffres permis par les cages, chiffres posés, et notes
 * (une case annotée ne garde que ses notes). Renvoie null si la grille du joueur est contradictoire.
 */
export function playerState(
  ctx: LogicContext,
  values: readonly number[],
  notes: readonly (readonly number[])[],
): LogicState | null {
  const state = initialState(ctx);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (values[cell] && !placeDigit(state, ctx, cell, values[cell])) return null;
  }
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (!values[cell] && notes[cell].length > 0) state.cand[cell] &= maskOf(notes[cell]);
  }
  return state;
}

/** Calcule l'indice pour la grille du joueur. */
export function findHint(
  ctx: LogicContext,
  solution: readonly number[],
  values: readonly number[],
  notes: readonly (readonly number[])[],
  config: DifficultyConfig = DIFFICULTY_CONFIG,
): Hint {
  const wrongDigits: number[] = [];
  const missingNotes: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (values[cell]) {
      if (values[cell] !== solution[cell]) wrongDigits.push(cell);
    } else if (notes[cell].length > 0 && !notes[cell].includes(solution[cell])) {
      missingNotes.push(cell);
    }
  }
  if (wrongDigits.length > 0 || missingNotes.length > 0) return { kind: 'error', wrongDigits, missingNotes };

  const state = playerState(ctx, values, notes);
  // Impossible si les chiffres et les notes sont justes ; par prudence, on le traite comme une erreur.
  if (!state) return { kind: 'error', wrongDigits, missingNotes };
  if (isSolved(state) && values.every((v) => v)) return { kind: 'solved' };
  const step = nextStep(state, ctx, config);
  return step ? { kind: 'step', step, state } : { kind: 'stuck' };
}

/**
 * Effet d'une déduction sur la grille du joueur (3e niveau de l'indice) : chiffres posés et notes à
 * jour. Une case sans notes touchée par une élimination reçoit ses candidats restants, pour que
 * l'élimination soit visible.
 */
export function hintEffect(
  hint: Extract<Hint, { kind: 'step' }>,
  values: readonly number[],
  notes: readonly (readonly number[])[],
): Map<number, { value: number; notes: number[] }> {
  const result = new Map<number, { value: number; notes: number[] }>();
  for (const { cell, digits } of hint.step.eliminations) {
    if (values[cell]) continue;
    const current = notes[cell].length > 0 ? notes[cell] : digitsOf(hint.state.cand[cell]);
    result.set(cell, { value: 0, notes: current.filter((d) => !(digitBit(d) & digits)) });
  }
  for (const { cell, digit } of hint.step.placements) result.set(cell, { value: digit, notes: [] });
  return result;
}
