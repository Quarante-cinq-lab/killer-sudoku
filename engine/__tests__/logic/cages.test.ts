import { describe, expect, it } from 'vitest';
import { digitsOf, maskOf } from '../../bits';
import { placeDigit } from '../../logic/state';
import {
  cageCombination,
  cageUnitOverlap,
  crossCageCombinations,
  parity,
} from '../../logic/techniques/cages';
import {
  blankState,
  colCells,
  contextWith,
  elimMap,
  expectedElims,
  removeCand,
  rowCells,
  setCands,
  setupOnS,
} from './helpers';

describe('combinaisons de cage', () => {
  it('cage 10 en 2 cases : {1,2,3} face à {7,8} exclut le 1', () => {
    const ctx = contextWith([{ sum: 10, cells: [0, 1] }]);
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 1, [7, 8]);
    const steps = [...cageCombination(state, ctx)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual({ 0: [1] });
    expect(steps[0].combos?.map(digitsOf).sort()).toEqual([
      [2, 8],
      [3, 7],
    ]);
  });

  it('tient compte d’un chiffre déjà posé dans la cage', () => {
    const ctx = contextWith([{ sum: 15, cells: [0, 1, 2] }]);
    const state = blankState();
    placeDigit(state, ctx, 0, 9);
    setCands(state, 1, [1, 2, 3, 4, 5]);
    setCands(state, 2, [1, 2, 3, 4, 5]);
    const step = [...cageCombination(state, ctx)][0];
    expect(elimMap(step)).toEqual({ 1: [3], 2: [3] }); // reste 6 en deux cases : 1+5 ou 2+4
    expect(step.combos?.map(digitsOf).sort()).toEqual([
      [1, 5, 9],
      [2, 4, 9],
    ]);
  });

  it('ne trouve rien quand toutes les combinaisons restent possibles', () => {
    const ctx = contextWith([{ sum: 11, cells: [0, 9] }]);
    const state = blankState();
    setCands(state, 0, [2, 3, 4]);
    setCands(state, 9, [7, 8, 9]);
    expect([...cageCombination(state, ctx)]).toEqual([]);
  });
});

describe('chevauchement cage/unité', () => {
  it('cage 17 en 2 cases sur la ligne 1 : 8 et 9 sortent du reste de la ligne', () => {
    const ctx = contextWith([{ sum: 17, cells: [0, 1] }]);
    const state = blankState();
    setCands(state, 0, [8, 9]);
    setCands(state, 1, [8, 9]);
    const step = [...cageUnitOverlap(state, ctx)].find((s) => s.units[0] === 0);
    expect(step && elimMap(step)).toEqual(expectedElims(rowCells(1, [0, 1]), [8, 9]));
  });

  it('le 3 de la colonne 1 ne peut être que dans la cage : la cage doit contenir 3', () => {
    const ctx = contextWith([{ sum: 12, cells: [0, 9, 10] }]);
    const state = blankState();
    removeCand(state, colCells(1, [0, 9]), 3);
    const step = [...cageUnitOverlap(state, ctx)].find((s) => s.units[0] === 9 && s.digits === maskOf([3]));
    // Combinaisons de 12 en 3 cases avec un 3 : 1+3+8, 2+3+7, 3+4+5. L2C2 (hors colonne) ne peut pas être 3.
    expect(step && elimMap(step)).toEqual({ 0: [6, 9], 9: [6, 9], 10: [3, 6, 9] });
  });

  it('ne trouve rien quand aucun chiffre n’est obligatoire dans la cage', () => {
    const ctx = contextWith([{ sum: 10, cells: [0, 1] }]);
    expect([...cageUnitOverlap(blankState(), ctx)]).toEqual([]);
  });
});

describe('combinaisons croisées', () => {
  it('deux cages de 10 dans une ligne : si l’une est {1,9}, l’autre ne l’est pas', () => {
    const ctx = contextWith([
      { sum: 10, cells: [0, 1] },
      { sum: 10, cells: [2, 3] },
    ]);
    const state = blankState();
    for (const cell of [0, 1]) setCands(state, cell, [1, 2, 8, 9]);
    for (const cell of [2, 3]) setCands(state, cell, [1, 9]);
    const step = [...crossCageCombinations(state, ctx)].find((s) => s.units[0] === 0);
    expect(step && elimMap(step)).toEqual(expectedElims([0, 1], [1, 9]));
  });

  it('écarte une combinaison incompatible avec toutes celles de l’autre cage', () => {
    const ctx = contextWith([
      { sum: 10, cells: [0, 1] },
      { sum: 11, cells: [2, 3] },
    ]);
    const state = blankState();
    for (const cell of [0, 1]) setCands(state, cell, [1, 2, 3, 7, 8, 9]);
    setCands(state, 2, [2, 3]);
    setCands(state, 3, [8, 9]);
    // Cage 11 : 2+9 ou 3+8. La combinaison 2+8 de la cage 10 croise les deux : elle est exclue.
    const step = [...crossCageCombinations(state, ctx)].find((s) => s.units[0] === 0);
    expect(step && elimMap(step)).toEqual(expectedElims([0, 1], [2, 8]));
  });

  it('ne compare pas deux cages qui ne sont pas dans la même unité', () => {
    const ctx = contextWith([
      { sum: 10, cells: [0, 1] },
      { sum: 10, cells: [27, 28] },
    ]);
    const state = blankState();
    for (const cell of [0, 1]) setCands(state, cell, [1, 2, 8, 9]);
    for (const cell of [27, 28]) setCands(state, cell, [1, 9]);
    expect([...crossCageCombinations(state, ctx)]).toEqual([]);
  });
});

describe('parité', () => {
  it('ligne 1 : les cages incluses imposent un nombre pair d’impairs, donc L1C9 est pair', () => {
    // Cages 8, 10, 15, 10 dans la ligne 1 ; L1C9 dans une cage qui descend en L2C9.
    const { ctx, state } = setupOnS([
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 17],
    ]);
    const step = [...parity(state, ctx)].find((s) => s.units[0] === 0);
    expect(step && elimMap(step)).toEqual({ 8: [1, 3, 7, 9] });
  });

  it('colonne 1 : quatre cages de somme impaire contiennent 4 impairs, donc L9C1 est impair', () => {
    const { ctx, state } = setupOnS([
      [0, 9],
      [18, 27],
      [36, 45],
      [54, 63],
      [72, 73],
    ]);
    const step = [...parity(state, ctx)].find((s) => s.units[0] === 9);
    expect(step && elimMap(step)).toEqual({ 72: [2, 4, 6] });
  });

  it('ne trouve rien quand la parité n’apporte aucune information', () => {
    const { ctx, state } = setupOnS([]);
    expect([...parity(state, ctx)]).toEqual([]);
  });
});
