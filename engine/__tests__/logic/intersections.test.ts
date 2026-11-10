import { describe, expect, it } from 'vitest';
import { boxLine, pointing } from '../../logic/techniques/intersections';
import { blankState, colCells, elimMap, expectedElims, removeCand, rowCells } from './helpers';

describe('pointing pair', () => {
  it('bloc 1 : le 4 est sur la ligne 1, on le retire du reste de la ligne', () => {
    const state = blankState();
    removeCand(state, [2, 9, 10, 11, 18, 19, 20], 4);
    const step = [...pointing(state)].find((s) => s.units[0] === 18);
    expect(step?.units).toEqual([18, 0]);
    expect(step && elimMap(step)).toEqual(expectedElims(rowCells(1, [0, 1, 2]), [4]));
  });

  it('bloc 5 : le 6 est sur la colonne 5, on le retire du reste de la colonne', () => {
    const state = blankState();
    removeCand(state, [30, 32, 39, 41, 48, 50], 6);
    const step = [...pointing(state)].find((s) => s.units[0] === 22);
    expect(step?.units).toEqual([22, 13]);
    expect(step && elimMap(step)).toEqual(expectedElims(colCells(5, [31, 40, 49]), [6]));
  });

  it('ne trouve rien quand le chiffre est réparti sur deux lignes du bloc', () => {
    const state = blankState();
    removeCand(state, [2, 10, 11, 18, 19, 20], 4); // reste L1C1, L1C2 et L2C1
    expect([...pointing(state)]).toEqual([]);
  });
});

describe('box/line', () => {
  it('ligne 1 : le 2 est dans le bloc 1, on le retire du reste du bloc', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [0, 1, 2]), 2);
    const step = [...boxLine(state)].find((s) => s.units[0] === 0);
    expect(step && elimMap(step)).toEqual(expectedElims([9, 10, 11, 18, 19, 20], [2]));
  });

  it('colonne 9 : le 9 est dans le bloc 9, on le retire du reste du bloc', () => {
    const state = blankState();
    removeCand(state, colCells(9, [62, 71, 80]), 9);
    const step = [...boxLine(state)].find((s) => s.units[0] === 17);
    expect(step && elimMap(step)).toEqual(expectedElims([60, 61, 69, 70, 78, 79], [9]));
  });

  it('ne trouve rien quand le chiffre est réparti sur deux blocs de la ligne', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [0, 1, 3]), 2);
    expect([...boxLine(state)]).toEqual([]);
  });
});
