import { digitBit, popcount } from '../../bits';
import type { DerivedConstraint, LogicContext } from '../context';
import { enumerateSum } from '../enumerate';
import { EliminationSet, freeCells, makeStep, placedInfo } from '../state';
import type { LogicState, Step } from '../types';

/**
 * Règle des 45 : une ligne, une colonne ou un bloc fait 45 (une bande de k lignes : 45 × k).
 * Les égalités correspondantes sont préparées une fois pour toutes dans le contexte ;
 * ici, on les évalue avec les chiffres déjà posés.
 */
interface Evaluated {
  free: number[];
  coefs: number[];
  target: number;
}

function evaluate(state: LogicState, constraint: DerivedConstraint): Evaluated {
  const free: number[] = [];
  const coefs: number[] = [];
  let target = constraint.value;
  for (const cell of constraint.plus) {
    if (state.value[cell]) target -= state.value[cell];
    else {
      free.push(cell);
      coefs.push(1);
    }
  }
  for (const cell of constraint.minus) {
    if (state.value[cell]) target += state.value[cell];
    else {
      free.push(cell);
      coefs.push(-1);
    }
  }
  return { free, coefs, target };
}

const constraintCells = (c: DerivedConstraint): number[] => [...c.plus, ...c.minus].sort((a, b) => a - b);
const minusOf = (c: DerivedConstraint): { minus?: number[] } =>
  c.minus.length > 0 ? { minus: [...c.minus] } : {};

/** Règle des 45 sur une case : il ne reste qu'une case inconnue, sa valeur est donc connue. */
export function* rule45Single(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (const constraint of ctx.derived) {
    const { free, coefs, target } = evaluate(state, constraint);
    if (free.length !== 1) continue;
    const cell = free[0];
    const digit = coefs[0] > 0 ? target : -target;
    if (digit < 1 || digit > 9 || !(state.cand[cell] & digitBit(digit)) || popcount(state.cand[cell]) === 1)
      continue;
    yield makeStep('rule45_single', {
      placements: [{ cell, digit }],
      cells: constraintCells(constraint),
      digits: digitBit(digit),
      region: constraint.region,
      value: constraint.value,
      ...minusOf(constraint),
    });
  }
}

function* multiCell(state: LogicState, ctx: LogicContext, mixed: boolean): Generator<Step> {
  for (const constraint of ctx.derived) {
    if (constraint.minus.length > 0 !== mixed) continue;
    const { free, coefs, target } = evaluate(state, constraint);
    if (free.length < 2) continue;
    const result = enumerateSum(state, ctx, free, coefs, target);
    if (!result || result.truncated) continue;
    const elims = new EliminationSet(state);
    free.forEach((cell, i) => elims.add(cell, ~result.possible[i]));
    if (elims.isEmpty) continue;
    yield makeStep(mixed ? 'cage_comparison' : 'innies_outies_multi', {
      eliminations: elims.list(),
      cells: constraintCells(constraint),
      region: constraint.region,
      value: constraint.value,
      ...minusOf(constraint),
    });
  }
}

/** Innies/outies de plusieurs cases : la somme de plusieurs cases est connue, on liste les possibilités. */
export const inniesOutiesMulti = (state: LogicState, ctx: LogicContext): Generator<Step> =>
  multiCell(state, ctx, false);

/** Comparaison innie/outie : la différence entre des cases intérieures et extérieures est connue. */
export const cageComparison = (state: LogicState, ctx: LogicContext): Generator<Step> =>
  multiCell(state, ctx, true);

/**
 * Découpage de cage : la règle des 45 donne la somme d'une partie d'une cage ;
 * le reste de la cage a donc lui aussi une somme connue, qu'on exploite séparément.
 */
export function* cageSplitting(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (const constraint of ctx.derived) {
    if (constraint.minus.length > 0) continue;
    const { free, target } = evaluate(state, constraint);
    if (free.length === 0) continue;
    const k = ctx.cageOf[free[0]];
    if (!free.every((cell) => ctx.cageOf[cell] === k)) continue;
    const cage = ctx.cages[k];
    const cageFree = freeCells(state, cage.cells);
    const rest = cageFree.filter((cell) => !free.includes(cell));
    if (rest.length === 0) continue;
    const restTarget = cage.sum - placedInfo(state, cage.cells).sum - target;
    const ones = (cells: number[]): number[] => cells.map(() => 1);
    const part = enumerateSum(state, ctx, free, ones(free), target, { allDistinct: true });
    const remainder = enumerateSum(state, ctx, rest, ones(rest), restTarget, { allDistinct: true });
    if (!part || !remainder || part.truncated || remainder.truncated) continue;
    const elims = new EliminationSet(state);
    free.forEach((cell, i) => elims.add(cell, ~part.possible[i]));
    rest.forEach((cell, i) => elims.add(cell, ~remainder.possible[i]));
    if (elims.isEmpty) continue;
    yield makeStep('cage_splitting', {
      eliminations: elims.list(),
      cells: [...cage.cells],
      cages: [k],
      region: constraint.region,
      value: target,
    });
  }
}
