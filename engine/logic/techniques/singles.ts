import { digitBit, popcount, singleDigit } from '../../bits';
import { CELL_COUNT, UNITS } from '../../model';
import { makeStep, positionsInUnit, unitPlacedMask } from '../state';
import type { LogicState, Step } from '../types';

/** Singleton nu : une case qui n'a plus qu'un candidat. */
export function* nakedSingle(state: LogicState): Generator<Step> {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (state.value[cell] || popcount(state.cand[cell]) !== 1) continue;
    const digit = singleDigit(state.cand[cell]);
    yield makeStep('naked_single', {
      placements: [{ cell, digit }],
      cells: [cell],
      digits: state.cand[cell],
    });
  }
}

/** Singleton caché : dans une ligne, une colonne ou un bloc, un chiffre n'a plus qu'une place. */
export function* hiddenSingle(state: LogicState): Generator<Step> {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const placed = unitPlacedMask(state, unit);
    for (let digit = 1; digit <= 9; digit++) {
      const bit = digitBit(digit);
      if (placed & bit) continue;
      const positions = positionsInUnit(state, unit, bit);
      if (positions.length !== 1 || popcount(state.cand[positions[0]]) === 1) continue;
      yield makeStep('hidden_single', {
        placements: [{ cell: positions[0], digit }],
        cells: positions,
        digits: bit,
        units: [unit],
      });
    }
  }
}
