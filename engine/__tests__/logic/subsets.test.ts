import { describe, expect, it } from 'vitest';
import {
  hiddenPair,
  hiddenQuad,
  hiddenTriple,
  nakedPair,
  nakedQuad,
  nakedTriple,
} from '../../logic/techniques/subsets';
import type { Step } from '../../logic/types';
import {
  blankState,
  colCells,
  elimMap,
  expectedElims,
  range,
  removeCand,
  rowCells,
  setCands,
} from './helpers';

const inUnit = (steps: Iterable<Step>, unit: number): Step | undefined =>
  [...steps].find((s) => s.units[0] === unit);

describe('paire nue', () => {
  it('retire la paire du reste de la ligne', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [1, 2]);
    const step = inUnit(nakedPair(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims(rowCells(1, [0, 1]), [1, 2]));
  });

  it('retire la paire du reste de la colonne', () => {
    const state = blankState();
    setCands(state, 0, [5, 9]);
    setCands(state, 72, [5, 9]);
    const step = inUnit(nakedPair(state), 9);
    expect(step && elimMap(step)).toEqual(expectedElims(colCells(1, [0, 72]), [5, 9]));
  });

  it('ne voit pas de paire dans {1,2} et {1,3}', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [1, 3]);
    expect([...nakedPair(state)]).toEqual([]);
  });
});

describe('triplet nu', () => {
  it('reconnaît {1,2}, {2,3}, {1,3}', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [2, 3]);
    setCands(state, 2, [1, 3]);
    const step = inUnit(nakedTriple(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims(rowCells(1, [0, 1, 2]), [1, 2, 3]));
  });

  it('reconnaît {1,2,3}, {1,2}, {2,3} sur des cases éloignées', () => {
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 4, [1, 2]);
    setCands(state, 8, [2, 3]);
    const step = inUnit(nakedTriple(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims(rowCells(1, [0, 4, 8]), [1, 2, 3]));
  });

  it('ne voit pas de triplet quand l’union a 4 chiffres', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [2, 3]);
    setCands(state, 2, [3, 4]);
    expect([...nakedTriple(state)]).toEqual([]);
  });
});

describe('quadruplet nu', () => {
  it('reconnaît un quadruplet dans une ligne', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 2, [2, 3]);
    setCands(state, 4, [3, 4]);
    setCands(state, 6, [1, 4]);
    const step = inUnit(nakedQuad(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims(rowCells(1, [0, 2, 4, 6]), [1, 2, 3, 4]));
  });

  it('reconnaît un quadruplet dans une colonne', () => {
    const state = blankState();
    setCands(state, 5, [5, 6]);
    setCands(state, 14, [6, 7]);
    setCands(state, 23, [7, 8]);
    setCands(state, 32, [5, 8]);
    const step = inUnit(nakedQuad(state), 14);
    expect(step && elimMap(step)).toEqual(expectedElims(colCells(6, [5, 14, 23, 32]), [5, 6, 7, 8]));
  });

  it('ne voit pas de quadruplet quand l’union a 5 chiffres', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 2, [2, 3]);
    setCands(state, 4, [3, 4]);
    setCands(state, 6, [4, 5]);
    expect([...nakedQuad(state)]).toEqual([]);
  });
});

describe('paire cachée', () => {
  it('réserve deux cases d’une ligne à 6 et 7', () => {
    const state = blankState();
    for (const d of [6, 7]) removeCand(state, rowCells(1, [3, 4]), d);
    const step = inUnit(hiddenPair(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims([3, 4], [1, 2, 3, 4, 5, 8, 9]));
  });

  it('réserve deux cases d’un bloc à 1 et 2', () => {
    const state = blankState();
    for (const d of [1, 2]) removeCand(state, [60, 61, 62, 69, 71, 78, 79], d);
    const step = inUnit(hiddenPair(state), 26);
    expect(step && elimMap(step)).toEqual(expectedElims([70, 80], range(3, 9)));
  });

  it('ne voit rien si les deux chiffres n’ont pas les mêmes places', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [3, 4]), 6);
    removeCand(state, rowCells(1, [3, 5]), 7);
    expect(inUnit(hiddenPair(state), 0)).toBeUndefined();
  });
});

describe('triplet caché', () => {
  it('réserve trois cases d’une ligne à 1, 2 et 3', () => {
    const state = blankState();
    for (const d of [1, 2, 3]) removeCand(state, rowCells(1, [0, 4, 8]), d);
    const step = inUnit(hiddenTriple(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims([0, 4, 8], range(4, 9)));
  });

  it('réserve trois cases d’une colonne à 4, 5 et 6', () => {
    const state = blankState();
    for (const d of [4, 5, 6]) removeCand(state, colCells(3, [2, 29, 74]), d);
    const step = inUnit(hiddenTriple(state), 11);
    expect(step && elimMap(step)).toEqual(expectedElims([2, 29, 74], [1, 2, 3, 7, 8, 9]));
  });

  it('ne voit rien si les trois chiffres occupent quatre cases', () => {
    const state = blankState();
    for (const d of [1, 2, 3]) removeCand(state, rowCells(1, [0, 3, 4, 8]), d);
    expect(inUnit(hiddenTriple(state), 0)).toBeUndefined();
  });
});

describe('quadruplet caché', () => {
  it('réserve quatre cases d’une ligne à 1, 2, 3 et 4', () => {
    const state = blankState();
    for (const d of [1, 2, 3, 4]) removeCand(state, rowCells(1, [1, 3, 5, 7]), d);
    const step = inUnit(hiddenQuad(state), 0);
    expect(step && elimMap(step)).toEqual(expectedElims([1, 3, 5, 7], range(5, 9)));
  });

  it('réserve quatre cases d’un bloc à 6, 7, 8 et 9', () => {
    const state = blankState();
    for (const d of [6, 7, 8, 9]) removeCand(state, [31, 39, 40, 41, 49], d);
    const step = inUnit(hiddenQuad(state), 22);
    expect(step && elimMap(step)).toEqual(expectedElims([30, 32, 48, 50], range(1, 5)));
  });

  it('ne voit rien si les quatre chiffres occupent cinq cases', () => {
    const state = blankState();
    for (const d of [1, 2, 3, 4]) removeCand(state, rowCells(1, [1, 3, 5, 7, 8]), d);
    expect(inUnit(hiddenQuad(state), 0)).toBeUndefined();
  });
});
