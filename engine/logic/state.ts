import { ALL_DIGITS, digitBit } from '../bits';
import { possibleDigits } from '../combinations';
import { CELL_COUNT, UNITS } from '../model';
import type { LogicContext } from './context';
import type { Elimination, LogicState, Step, TechniqueId } from './types';

/**
 * État de départ : chaque case reçoit les chiffres permis par la taille et la somme de sa cage
 * (comme la commande « Remplir toutes les notes »). Ce remplissage n'est pas compté comme une étape.
 */
export function initialState(ctx: LogicContext): LogicState {
  const cand = new Uint16Array(CELL_COUNT).fill(ALL_DIGITS);
  for (const cage of ctx.cages) {
    const allowed = possibleDigits(cage.cells.length, cage.sum);
    for (const cell of cage.cells) cand[cell] &= allowed;
  }
  return { cand, value: new Uint8Array(CELL_COUNT) };
}

export function cloneState(state: LogicState): LogicState {
  return { cand: state.cand.slice(), value: state.value.slice() };
}

/** Pose un chiffre et le retire des cases qu'elle voit. Renvoie faux si une case se retrouve sans candidat. */
export function placeDigit(state: LogicState, ctx: LogicContext, cell: number, digit: number): boolean {
  const bit = digitBit(digit);
  if (!(state.cand[cell] & bit)) return false;
  state.value[cell] = digit;
  state.cand[cell] = bit;
  let ok = true;
  for (const other of ctx.seen[cell]) {
    if (state.value[other]) {
      if (state.value[other] === digit) ok = false;
      continue;
    }
    state.cand[other] &= ~bit;
    if (state.cand[other] === 0) ok = false;
  }
  return ok;
}

/** Applique une étape. Renvoie faux si elle mène à une contradiction. */
export function applyStep(state: LogicState, ctx: LogicContext, step: Step): boolean {
  let ok = true;
  for (const { cell, digits } of step.eliminations) {
    if (state.value[cell]) continue;
    state.cand[cell] &= ~digits;
    if (state.cand[cell] === 0) ok = false;
  }
  for (const { cell, digit } of step.placements) {
    if (state.value[cell] === digit) continue;
    if (state.value[cell] || !placeDigit(state, ctx, cell, digit)) ok = false;
  }
  return ok;
}

export function isSolved(state: LogicState): boolean {
  return state.value.every((v) => v !== 0);
}

/** Cases vides parmi une liste. */
export function freeCells(state: LogicState, cells: readonly number[]): number[] {
  return cells.filter((cell) => state.value[cell] === 0);
}

/** Chiffres déjà posés dans une liste de cases (masque) et leur somme. */
export function placedInfo(state: LogicState, cells: readonly number[]): { mask: number; sum: number } {
  let mask = 0;
  let sum = 0;
  for (const cell of cells) {
    const v = state.value[cell];
    if (v) {
      mask |= digitBit(v);
      sum += v;
    }
  }
  return { mask, sum };
}

/** Unités (0 à 26) qui contiennent toutes les cases données. */
export function commonUnits(cells: readonly number[]): number[] {
  if (cells.length === 0) return [];
  return UNITS.map((_, u) => u).filter((u) => cells.every((cell) => UNITS[u].includes(cell)));
}

/** Toutes les façons de choisir k éléments dans une liste, dans l'ordre. */
export function* kCombinations<T>(
  items: readonly T[],
  k: number,
  start = 0,
  prefix: T[] = [],
): Generator<T[]> {
  if (prefix.length === k) {
    yield [...prefix];
    return;
  }
  for (let i = start; i <= items.length - (k - prefix.length); i++) {
    prefix.push(items[i]);
    yield* kCombinations(items, k, i + 1, prefix);
    prefix.pop();
  }
}

/** Accumule des éliminations, en ne gardant que les candidats réellement présents. */
export class EliminationSet {
  private readonly state: LogicState;
  private readonly map = new Map<number, number>();

  constructor(state: LogicState) {
    this.state = state;
  }

  add(cell: number, digits: number): void {
    if (this.state.value[cell]) return;
    const m = digits & this.state.cand[cell];
    if (m) this.map.set(cell, (this.map.get(cell) ?? 0) | m);
  }

  get isEmpty(): boolean {
    return this.map.size === 0;
  }

  list(): Elimination[] {
    return [...this.map.entries()].sort((a, b) => a[0] - b[0]).map(([cell, digits]) => ({ cell, digits }));
  }
}

/** Fabrique une étape avec des valeurs par défaut. */
export function makeStep(technique: TechniqueId, fields: Partial<Omit<Step, 'technique'>>): Step {
  return {
    technique,
    placements: [],
    eliminations: [],
    cells: [],
    digits: 0,
    units: [],
    cages: [],
    ...fields,
  };
}

/** Masque des chiffres déjà posés dans une unité. */
export function unitPlacedMask(state: LogicState, unit: number): number {
  return placedInfo(state, UNITS[unit]).mask;
}

/** Cases vides d'une unité qui ont encore le chiffre `bit` en candidat. */
export function positionsInUnit(state: LogicState, unit: number, bit: number): number[] {
  return UNITS[unit].filter((cell) => state.value[cell] === 0 && (state.cand[cell] & bit) !== 0);
}
