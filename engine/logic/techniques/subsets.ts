import { digitBit, popcount } from '../../bits';
import { UNITS } from '../../model';
import { EliminationSet, freeCells, kCombinations, makeStep, unitPlacedMask } from '../state';
import type { LogicState, Step, TechniqueId } from '../types';

/**
 * Sous-ensemble nu : n cases d'une unité qui, à elles toutes, n'ont que n candidats.
 * Ces n chiffres leur sont réservés : on les retire des autres cases de l'unité.
 */
function* nakedSubset(state: LogicState, size: number, technique: TechniqueId): Generator<Step> {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const free = freeCells(state, UNITS[unit]);
    const pool = free.filter((cell) => {
      const count = popcount(state.cand[cell]);
      return count >= 2 && count <= size;
    });
    for (const group of kCombinations(pool, size)) {
      let union = 0;
      for (const cell of group) union |= state.cand[cell];
      if (popcount(union) !== size) continue;
      const elims = new EliminationSet(state);
      for (const cell of free) if (!group.includes(cell)) elims.add(cell, union);
      if (elims.isEmpty) continue;
      yield makeStep(technique, { eliminations: elims.list(), cells: group, digits: union, units: [unit] });
    }
  }
}

/**
 * Sous-ensemble caché : n chiffres qui, dans une unité, ne peuvent aller que dans les mêmes n cases.
 * Ces cases leur sont réservées : on retire leurs autres candidats.
 */
function* hiddenSubset(state: LogicState, size: number, technique: TechniqueId): Generator<Step> {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const cells = UNITS[unit];
    const placed = unitPlacedMask(state, unit);
    const digits: { bit: number; positions: number }[] = [];
    for (let d = 1; d <= 9; d++) {
      const bit = digitBit(d);
      if (placed & bit) continue;
      let positions = 0;
      cells.forEach((cell, i) => {
        if (!state.value[cell] && state.cand[cell] & bit) positions |= 1 << i;
      });
      const count = popcount(positions);
      if (count >= 2 && count <= size) digits.push({ bit, positions });
    }
    for (const group of kCombinations(digits, size)) {
      let positions = 0;
      let mask = 0;
      for (const g of group) {
        positions |= g.positions;
        mask |= g.bit;
      }
      if (popcount(positions) !== size) continue;
      const groupCells = cells.filter((_, i) => positions & (1 << i));
      const elims = new EliminationSet(state);
      for (const cell of groupCells) elims.add(cell, ~mask);
      if (elims.isEmpty) continue;
      yield makeStep(technique, {
        eliminations: elims.list(),
        cells: groupCells,
        digits: mask,
        units: [unit],
      });
    }
  }
}

export const nakedPair = (state: LogicState): Generator<Step> => nakedSubset(state, 2, 'naked_pair');
export const nakedTriple = (state: LogicState): Generator<Step> => nakedSubset(state, 3, 'naked_triple');
export const nakedQuad = (state: LogicState): Generator<Step> => nakedSubset(state, 4, 'naked_quad');
export const hiddenPair = (state: LogicState): Generator<Step> => hiddenSubset(state, 2, 'hidden_pair');
export const hiddenTriple = (state: LogicState): Generator<Step> => hiddenSubset(state, 3, 'hidden_triple');
export const hiddenQuad = (state: LogicState): Generator<Step> => hiddenSubset(state, 4, 'hidden_quad');
