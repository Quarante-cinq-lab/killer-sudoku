import { describe, expect, it } from 'vitest';
import { applyStep, placeDigit } from '../../logic/state';
import {
  cageComparison,
  cageSplitting,
  inniesOutiesMulti,
  rule45Single,
} from '../../logic/techniques/rule45';
import type { Step } from '../../logic/types';
import { elimMap, expectedElims, range, S, setupOnS } from './helpers';

const sameCells = (step: Step, cells: number[]): boolean => step.cells.join(',') === cells.join(',');

describe('règle des 45 sur une case', () => {
  // Bloc 1 : quatre cages de 2 cases à l'intérieur ; L3C3 est dans une cage qui sort du bloc.
  const boxLayout = [
    [0, 1],
    [2, 11],
    [9, 10],
    [18, 19],
    [20, 21],
  ];

  it('innie : la seule case du bloc 1 hors des cages incluses vaut 45 − leurs sommes', () => {
    const { ctx, state } = setupOnS(boxLayout);
    const step = [...rule45Single(state, ctx)].find((s) => s.region?.kind === 'box' && s.region.from === 0);
    expect(step?.placements).toEqual([{ cell: 20, digit: 8 }]);
    expect(S[20]).toBe(8);
  });

  it('outie : la seule case qui dépasse de la ligne 1 vaut la somme des cages − 45', () => {
    const { ctx, state } = setupOnS([
      [0, 1, 2],
      [3, 4],
      [5, 6, 7],
      [8, 17],
    ]);
    const placements = [...rule45Single(state, ctx)].flatMap((s) => s.placements);
    expect(placements).toContainEqual({ cell: 17, digit: 8 }); // outie
    expect(placements).toContainEqual({ cell: 8, digit: 2 }); // innie
  });

  it('ne propose rien pour une case déjà remplie', () => {
    const { ctx, state } = setupOnS(boxLayout);
    placeDigit(state, ctx, 20, 8);
    const placements = [...rule45Single(state, ctx)].flatMap((s) => s.placements);
    expect(placements.some((p) => p.cell === 20)).toBe(false);
  });
});

describe('innies/outies de plusieurs cases', () => {
  // Bloc 1 : innies L3C2 + L3C3 = 17, donc 8 et 9.
  const layout = [
    [0, 1],
    [2, 11],
    [9, 10],
    [19, 28],
    [20, 21],
  ];

  it('deux innies de somme 17 ne peuvent valoir que 8 et 9', () => {
    const { ctx, state } = setupOnS(layout);
    const step = [...inniesOutiesMulti(state, ctx)].find((s) => sameCells(s, [19, 20]));
    expect(step && elimMap(step)).toEqual({ 19: [5, 6], 20: [2, 3, 4, 5, 6, 7] });
    expect(step?.value).toBe(17);
  });

  it('deux outies de somme 12 sous la ligne 1', () => {
    const { ctx, state } = setupOnS([
      [0, 1, 2],
      [3, 4],
      [5, 6],
      [7, 16],
      [8, 17],
    ]);
    const step = [...inniesOutiesMulti(state, ctx)].find((s) => sameCells(s, [16, 17]));
    // L2C8 ∈ {1..4} (cage 5) et L2C9 = 12 − L2C8 doit être un candidat de la cage 10.
    expect(step && elimMap(step)).toEqual({ 16: [1, 2], 17: [1, 2, 3, 4, 6, 7] });
  });

  it('ne repropose rien une fois les éliminations faites', () => {
    const { ctx, state } = setupOnS(layout);
    const step = [...inniesOutiesMulti(state, ctx)].find((s) => sameCells(s, [19, 20]));
    expect(step).toBeDefined();
    if (step) applyStep(state, ctx, step);
    expect([...inniesOutiesMulti(state, ctx)].find((s) => sameCells(s, [19, 20]))).toBeUndefined();
  });
});

describe('découpage de cage', () => {
  it('les innies du bloc 1 sont dans une cage : le reste de la cage vaut 20 − 17 = 3', () => {
    const { ctx, state } = setupOnS([
      [0, 1],
      [2, 11],
      [9, 10],
      [19, 20, 21],
    ]);
    const step = [...cageSplitting(state, ctx)].find((s) => s.region?.kind === 'box' && s.region.from === 0);
    expect(step && elimMap(step)).toEqual({
      19: [3, 4, 5, 6, 7],
      20: [3, 4, 5, 6, 7],
      21: range(4, 9),
    });
  });

  it('les innies de la ligne 1 sont dans une cage 2×2 : le bas de la cage vaut 12', () => {
    const { ctx, state } = setupOnS([
      [0, 1, 2],
      [3, 4],
      [5, 6],
      [7, 8, 16, 17],
    ]);
    const step = [...cageSplitting(state, ctx)].find((s) => s.region?.kind === 'rows' && s.region.from === 0);
    expect(step && elimMap(step)).toEqual({
      ...expectedElims([7, 8], range(3, 9)),
      ...expectedElims([16, 17], [1, 2, 6]),
    });
  });

  it('ne s’applique pas quand les innies sont dans des cages différentes', () => {
    const { ctx, state } = setupOnS([
      [0, 1],
      [2, 11],
      [9, 10],
      [19, 28],
      [20, 21],
    ]);
    const step = [...cageSplitting(state, ctx)].find((s) => s.region?.kind === 'box' && s.region.from === 0);
    expect(step).toBeUndefined();
  });
});

describe('comparaison innies/outies', () => {
  it('bloc 1 : L3C3 − L4C1 = 0, donc L4C1 ne peut pas valoir 1', () => {
    const { ctx, state } = setupOnS([
      [0, 1],
      [2, 11],
      [9, 10],
      [18, 19, 27],
      [20, 21],
    ]);
    const step = [...cageComparison(state, ctx)].find((s) => sameCells(s, [20, 27]));
    expect(step?.minus).toEqual([27]);
    expect(step?.value).toBe(0);
    expect(step && elimMap(step)).toEqual({ 27: [1] });
  });

  it('ligne 1 : L2C8 = L1C9 + 2', () => {
    const { ctx, state } = setupOnS([
      [0, 1, 2],
      [3, 4],
      [5, 6],
      [7, 16],
      [8, 17],
    ]);
    const step = [...cageComparison(state, ctx)].find((s) => sameCells(s, [8, 16]));
    expect(step?.value).toBe(-2);
    expect(step && elimMap(step)).toEqual({ 8: [3, 4, 6, 7, 8, 9], 16: [1, 2] });
  });

  it('ne repropose rien une fois les éliminations faites', () => {
    const { ctx, state } = setupOnS([
      [0, 1, 2],
      [3, 4],
      [5, 6],
      [7, 16],
      [8, 17],
    ]);
    const step = [...cageComparison(state, ctx)].find((s) => sameCells(s, [8, 16]));
    if (step) applyStep(state, ctx, step);
    expect([...cageComparison(state, ctx)].find((s) => sameCells(s, [8, 16]))).toBeUndefined();
  });
});
