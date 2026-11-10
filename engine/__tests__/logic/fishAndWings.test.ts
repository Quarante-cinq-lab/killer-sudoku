import { describe, expect, it } from 'vitest';
import { swordfish, xWing } from '../../logic/techniques/fish';
import { xyzWing, yWing } from '../../logic/techniques/wings';
import {
  blankState,
  colCells,
  contextWith,
  elimMap,
  expectedElims,
  removeCand,
  rowCells,
  setCands,
} from './helpers';

describe('X-Wing', () => {
  it('le 5 des lignes 1 et 5 est en colonnes 2 et 8 : on le retire du reste de ces colonnes', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [1, 7]), 5);
    removeCand(state, rowCells(5, [37, 43]), 5);
    const steps = [...xWing(state)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual(
      expectedElims(
        [...colCells(2, [1, 37]), ...colCells(8, [7, 43])].sort((a, b) => a - b),
        [5],
      ),
    );
  });

  it('version colonnes : le 3 des colonnes 3 et 7 est en lignes 4 et 9', () => {
    const state = blankState();
    removeCand(state, colCells(3, [29, 74]), 3);
    removeCand(state, colCells(7, [33, 78]), 3);
    const steps = [...xWing(state)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual(
      expectedElims(
        [...rowCells(4, [29, 33]), ...rowCells(9, [74, 78])].sort((a, b) => a - b),
        [3],
      ),
    );
  });

  it('ne trouve rien si les colonnes ne coïncident pas', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [1, 7]), 5);
    removeCand(state, rowCells(5, [37, 42]), 5);
    expect([...xWing(state)]).toEqual([]);
  });
});

describe('Swordfish', () => {
  it('le 4 des lignes 1, 4 et 7 tient dans les colonnes 1, 5 et 9', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [0, 4]), 4);
    removeCand(state, rowCells(4, [31, 35]), 4);
    removeCand(state, rowCells(7, [54, 62]), 4);
    const steps = [...swordfish(state)];
    expect(steps).toHaveLength(1);
    // Hors des lignes 1, 4 et 7 (où le 4 n'est déjà plus possible ailleurs).
    const expected = [...colCells(1, [0, 27, 54]), ...colCells(5, [4, 31, 58]), ...colCells(9, [8, 35, 62])];
    expect(elimMap(steps[0])).toEqual(
      expectedElims(
        expected.sort((a, b) => a - b),
        [4],
      ),
    );
    expect([...xWing(state)]).toEqual([]);
  });

  it('version colonnes : le 8 des colonnes 2, 5 et 8 tient dans les lignes 2, 6 et 8', () => {
    const state = blankState();
    removeCand(state, colCells(2, [10, 46]), 8);
    removeCand(state, colCells(5, [49, 67]), 8);
    removeCand(state, colCells(8, [16, 70]), 8);
    const steps = [...swordfish(state)];
    expect(steps).toHaveLength(1);
    const expected = [
      ...rowCells(2, [10, 13, 16]),
      ...rowCells(6, [46, 49, 52]),
      ...rowCells(8, [64, 67, 70]),
    ];
    expect(elimMap(steps[0])).toEqual(
      expectedElims(
        expected.sort((a, b) => a - b),
        [8],
      ),
    );
  });

  it('ne trouve rien si les trois lignes occupent quatre colonnes', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [0, 4]), 4);
    removeCand(state, rowCells(4, [31, 35]), 4);
    removeCand(state, rowCells(7, [54, 59]), 4);
    expect([...swordfish(state)]).toEqual([]);
  });
});

describe('Y-Wing', () => {
  const ctx = contextWith();

  it('pivot L1C1 {1,2}, ailes L1C5 {1,3} et L5C1 {2,3} : L5C5 ≠ 3', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 4, [1, 3]);
    setCands(state, 36, [2, 3]);
    const steps = [...yWing(state, ctx)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual({ 40: [3] });
  });

  it('aile dans le bloc du pivot : le 3 sort des cases qui voient les deux ailes', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 10, [1, 3]);
    setCands(state, 6, [2, 3]);
    const steps = [...yWing(state, ctx)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual(expectedElims([1, 2, 15, 16, 17], [3]));
  });

  it('ne trouve rien si les ailes ne partagent pas de chiffre', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 4, [1, 3]);
    setCands(state, 36, [2, 4]);
    expect([...yWing(state, ctx)]).toEqual([]);
  });
});

describe('XYZ-Wing', () => {
  const ctx = contextWith();

  it('pivot {1,2,3} et ailes dans son bloc : le 3 sort du reste du bloc', () => {
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 1, [1, 3]);
    setCands(state, 9, [2, 3]);
    const steps = [...xyzWing(state, ctx)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual(expectedElims([2, 10, 11, 18, 19, 20], [3]));
  });

  it('aile dans la colonne du pivot : seules les cases qui voient les trois perdent le 3', () => {
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 2, [1, 3]);
    setCands(state, 27, [2, 3]);
    const steps = [...xyzWing(state, ctx)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual(expectedElims([9, 18], [3]));
  });

  it('ne trouve rien si une aile a un chiffre hors du pivot', () => {
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 1, [1, 4]);
    setCands(state, 9, [2, 3]);
    expect([...xyzWing(state, ctx)]).toEqual([]);
  });
});
