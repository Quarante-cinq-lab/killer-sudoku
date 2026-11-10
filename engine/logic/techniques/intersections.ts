import { digitBit } from '../../bits';
import { boxOf, colOf, rowOf, UNITS } from '../../model';
import { EliminationSet, makeStep, positionsInUnit, unitPlacedMask } from '../state';
import type { LogicState, Step } from '../types';

/**
 * Pointing pair : dans un bloc, un chiffre n'est possible que sur une seule ligne (ou colonne).
 * Il sera donc dans ce bloc : on le retire du reste de cette ligne (ou colonne).
 */
export function* pointing(state: LogicState): Generator<Step> {
  for (let box = 0; box < 9; box++) {
    const unit = 18 + box;
    const placed = unitPlacedMask(state, unit);
    for (let d = 1; d <= 9; d++) {
      const bit = digitBit(d);
      if (placed & bit) continue;
      const positions = positionsInUnit(state, unit, bit);
      if (positions.length < 2) continue;
      for (const line of [rowOf, colOf]) {
        const index = line(positions[0]);
        if (!positions.every((cell) => line(cell) === index)) continue;
        const lineUnit = line === rowOf ? index : 9 + index;
        const elims = new EliminationSet(state);
        for (const cell of UNITS[lineUnit]) if (boxOf(cell) !== box) elims.add(cell, bit);
        if (elims.isEmpty) continue;
        yield makeStep('pointing', {
          eliminations: elims.list(),
          cells: positions,
          digits: bit,
          units: [unit, lineUnit],
        });
      }
    }
  }
}

/**
 * Box/line : dans une ligne (ou colonne), un chiffre n'est possible que dans un seul bloc.
 * Il sera donc sur cette ligne : on le retire du reste du bloc.
 */
export function* boxLine(state: LogicState): Generator<Step> {
  for (let lineUnit = 0; lineUnit < 18; lineUnit++) {
    const placed = unitPlacedMask(state, lineUnit);
    for (let d = 1; d <= 9; d++) {
      const bit = digitBit(d);
      if (placed & bit) continue;
      const positions = positionsInUnit(state, lineUnit, bit);
      if (positions.length < 2) continue;
      const box = boxOf(positions[0]);
      if (!positions.every((cell) => boxOf(cell) === box)) continue;
      const line = new Set(UNITS[lineUnit]);
      const elims = new EliminationSet(state);
      for (const cell of UNITS[18 + box]) if (!line.has(cell)) elims.add(cell, bit);
      if (elims.isEmpty) continue;
      yield makeStep('box_line', {
        eliminations: elims.list(),
        cells: positions,
        digits: bit,
        units: [lineUnit, 18 + box],
      });
    }
  }
}
