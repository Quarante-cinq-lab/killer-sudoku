/**
 * Techniques des groupes C et D : au moins 3 tests chacune (cahier des charges, section 13).
 * Chaque test place un motif à la main dans un état où toutes les autres cases gardent tous leurs
 * candidats, puis vérifie la déduction attendue (ou son absence).
 */
import { describe, expect, it } from 'vitest';
import { digitBit } from '../../bits';
import { cageCombos, conflictChecker, linkGraph, node } from '../../logic/links';
import { alsXz } from '../../logic/techniques/als';
import { alignedPairExclusion } from '../../logic/techniques/ape';
import { aic, groupedXCycles, xCycles, xyChain } from '../../logic/techniques/chains';
import { medusa3d, simpleColoring } from '../../logic/techniques/coloring';
import { finnedSwordfish, finnedXWing, jellyfish } from '../../logic/techniques/fish';
import { wxyzWing } from '../../logic/techniques/wings';
import type { LogicState, Step } from '../../logic/types';
import { boxOf, UNITS } from '../../model';
import {
  blankState,
  colCells,
  contextWith,
  elimMap,
  expectedElims,
  L,
  removeCand,
  rowCells,
  setCands,
} from './helpers';

const ctx = contextWith();
const boxCells = (r: number, c: number, except: number[] = []): number[] =>
  UNITS[18 + boxOf(L(r, c))].filter((cell) => !except.includes(cell));
/** Vrai si une des étapes retire `digit` de `cell`. */
const removes = (steps: Step[], cell: number, digit: number): boolean =>
  steps.some((s) => s.eliminations.some((e) => e.cell === cell && e.digits & digitBit(digit)));
const sorted = (cells: number[]): number[] => [...cells].sort((a, b) => a - b);

describe('Jellyfish', () => {
  /** Le 7 n'est possible, dans les lignes 1, 3, 5 et 7, que dans les colonnes 1, 3, 5 et 7. */
  function jellyState(extra?: number): LogicState {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 3)]), 7);
    removeCand(state, rowCells(3, [L(3, 3), L(3, 5)]), 7);
    removeCand(state, rowCells(5, [L(5, 5), L(5, 7)]), 7);
    removeCand(state, rowCells(7, [L(7, 1), L(7, 7), ...(extra === undefined ? [] : [extra])]), 7);
    return state;
  }

  it('retire le 7 du reste des colonnes 1, 3, 5 et 7', () => {
    const steps = [...jellyfish(jellyState())];
    expect(steps).toHaveLength(1);
    const expected = [1, 3, 5, 7].flatMap((c) => [2, 4, 6, 8, 9].map((r) => L(r, c)));
    expect(elimMap(steps[0])).toEqual(expectedElims(sorted(expected), [7]));
  });

  it('version colonnes : mêmes positions, lignes et colonnes échangées', () => {
    const state = blankState();
    removeCand(state, colCells(1, [L(1, 1), L(3, 1)]), 7);
    removeCand(state, colCells(3, [L(3, 3), L(5, 3)]), 7);
    removeCand(state, colCells(5, [L(5, 5), L(7, 5)]), 7);
    removeCand(state, colCells(7, [L(1, 7), L(7, 7)]), 7);
    const steps = [...jellyfish(state)];
    expect(steps).toHaveLength(1);
    expect(Object.keys(elimMap(steps[0]))).toHaveLength(20);
  });

  it('ne trouve rien si une ligne a une place hors des quatre colonnes', () => {
    expect([...jellyfish(jellyState(L(7, 9)))]).toEqual([]);
  });
});

describe('X-Wing et Swordfish à aileron', () => {
  it('X-Wing à aileron : le 5 en colonnes 2 et 8 (lignes 1 et 5), aileron en L1C9', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 2), L(1, 8), L(1, 9)]), 5);
    removeCand(state, rowCells(5, [L(5, 2), L(5, 8)]), 5);
    const steps = [...finnedXWing(state)];
    expect(steps).toHaveLength(1);
    // Seules les cases de la colonne 8 dans le bloc de l'aileron perdent le 5.
    expect(elimMap(steps[0])).toEqual(expectedElims([L(2, 8), L(3, 8)], [5]));
  });

  it('X-Wing à aileron, version colonnes', () => {
    const state = blankState();
    removeCand(state, colCells(1, [L(2, 1), L(8, 1), L(9, 1)]), 5);
    removeCand(state, colCells(5, [L(2, 5), L(8, 5)]), 5);
    const steps = [...finnedXWing(state)];
    expect(steps).toHaveLength(1);
    expect(elimMap(steps[0])).toEqual(expectedElims([L(8, 2), L(8, 3)], [5]));
  });

  it('aucun X-Wing à aileron si les places en trop sont dans deux blocs', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 2), L(1, 8), L(1, 9)]), 5);
    removeCand(state, rowCells(5, [L(5, 2), L(5, 8), L(5, 5)]), 5);
    expect([...finnedXWing(state)]).toEqual([]);
  });

  it('Swordfish à aileron : le 5 en colonnes 1, 5 et 9, aileron en L1C2', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5), L(1, 2)]), 5);
    removeCand(state, rowCells(4, [L(4, 5), L(4, 9)]), 5);
    removeCand(state, rowCells(7, [L(7, 1), L(7, 9)]), 5);
    const steps = [...finnedSwordfish(state)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual(expectedElims([L(2, 1), L(3, 1)], [5]));
  });

  it('Swordfish à aileron : rien si l’aileron est loin des colonnes du poisson', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5), L(1, 7)]), 5);
    removeCand(state, rowCells(4, [L(4, 5), L(4, 9)]), 5);
    removeCand(state, rowCells(7, [L(7, 1), L(7, 9)]), 5);
    const steps = [...finnedSwordfish(state)];
    // L'aileron L1C7 est dans le bloc 3 : seule la colonne 9 y passe, en lignes 2 et 3.
    for (const s of steps) for (const e of s.eliminations) expect(boxOf(e.cell)).toBe(2);
  });

  it('Swordfish à aileron : rien sans aileron (c’est alors un Swordfish ordinaire)', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 5);
    removeCand(state, rowCells(4, [L(4, 5), L(4, 9)]), 5);
    removeCand(state, rowCells(7, [L(7, 1), L(7, 9)]), 5);
    expect([...finnedSwordfish(state)]).toEqual([]);
  });
});

/**
 * Chaîne de liens forts pour le 4 : A(1,1) = B(1,5) en ligne 1, B = C(5,5) en colonne 5,
 * C = D(6,4) dans le bloc 5. A et D sont de couleurs opposées.
 */
function coloringState(): LogicState {
  const state = blankState();
  removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 4);
  removeCand(state, colCells(5, [L(1, 5), L(5, 5)]), 4);
  removeCand(state, boxCells(5, 5, [L(5, 5), L(6, 4)]), 4);
  return state;
}

describe('Coloriage simple', () => {
  it('piège : L6C1 voit les deux couleurs (A et D), elle perd le 4', () => {
    const steps = [...simpleColoring(coloringState(), ctx)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual({ [L(6, 1)]: [4] });
  });

  it('contradiction : deux cases de même couleur dans un bloc font tomber cette couleur', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 4);
    removeCand(state, colCells(5, [L(1, 5), L(3, 5)]), 4);
    removeCand(state, rowCells(3, [L(3, 5), L(3, 2)]), 4);
    removeCand(state, colCells(2, [L(3, 2), L(2, 2)]), 4);
    const steps = [...simpleColoring(state, ctx)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual(expectedElims([L(1, 1), L(2, 2), L(3, 5)], [4]));
  });

  it('ne trouve rien avec un seul lien fort', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 4);
    expect([...simpleColoring(state, ctx)]).toEqual([]);
  });
});

describe('X-Cycles', () => {
  it('chaîne A = B − C = D pour le 4 : L6C1 voit les deux extrémités', () => {
    const steps = [...xCycles(coloringState(), ctx)];
    expect(removes(steps, L(6, 1), 4)).toBe(true);
  });

  it('la chaîne met en évidence les cases utilisées', () => {
    const steps = [...xCycles(coloringState(), ctx)].filter((s) => removes([s], L(6, 1), 4));
    expect(sorted(steps[0].cells)).toEqual(sorted([L(1, 1), L(1, 5), L(5, 5), L(6, 4)]));
  });

  it('ne trouve rien avec un seul lien fort', () => {
    const state = blankState();
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 4);
    expect([...xCycles(state, ctx)]).toEqual([]);
  });
});

describe('XY-Chain', () => {
  it('trois cases : L1C1 {1,2}, L1C5 {2,3}, L5C5 {3,1} ⇒ L5C1 perd le 1', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2]);
    setCands(state, L(1, 5), [2, 3]);
    setCands(state, L(5, 5), [3, 1]);
    expect(removes([...xyChain(state, ctx)], L(5, 1), 1)).toBe(true);
  });

  it('quatre cases : extrémités L1C1 et L5C9, L1C9 et L5C1 perdent le 1', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2]);
    setCands(state, L(1, 5), [2, 3]);
    setCands(state, L(5, 5), [3, 4]);
    setCands(state, L(5, 9), [4, 1]);
    const steps = [...xyChain(state, ctx)];
    expect(removes(steps, L(1, 9), 1)).toBe(true);
    expect(removes(steps, L(5, 1), 1)).toBe(true);
  });

  it('ne trouve rien si les extrémités n’ont pas de chiffre commun', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2]);
    setCands(state, L(1, 5), [2, 3]);
    setCands(state, L(5, 5), [3, 4]);
    expect([...xyChain(state, ctx)]).toEqual([]);
  });
});

describe('WXYZ-Wing', () => {
  it('quatre cases sur {1,2,3,4} : seul le 4 n’est pas restreint, L1C3 le perd', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 4]);
    setCands(state, L(1, 2), [1, 4]);
    setCands(state, L(2, 1), [2, 4]);
    setCands(state, L(1, 7), [3, 4]);
    const steps = [...wxyzWing(state, ctx)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual({ [L(1, 3)]: [4] });
  });

  it('ne trouve rien si tous les chiffres sont restreints (quatre cases d’un même bloc)', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 4]);
    setCands(state, L(1, 2), [1, 4]);
    setCands(state, L(2, 1), [2, 4]);
    setCands(state, L(2, 3), [3, 4]);
    expect([...wxyzWing(state, ctx)]).toEqual([]);
  });

  it('ne trouve rien avec cinq chiffres', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 5]);
    setCands(state, L(1, 2), [1, 4]);
    setCands(state, L(2, 1), [2, 4]);
    setCands(state, L(1, 7), [3, 4]);
    expect([...wxyzWing(state, ctx)]).toEqual([]);
  });
});

describe('Aligned Pair Exclusion', () => {
  it('killer : cage 4 de deux cases {1,2,3} ⇒ seule la paire 1 + 3 convient, le 2 tombe', () => {
    const cageCtx = contextWith([{ sum: 4, cells: [L(1, 1), L(1, 2)] }]);
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 3]);
    setCands(state, L(1, 2), [1, 2, 3]);
    const steps = [...alignedPairExclusion(state, cageCtx)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual({ [L(1, 1)]: [2], [L(1, 2)]: [2] });
  });

  it('des cases voisines n’ayant plus que deux chiffres excluent des paires', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 3]);
    setCands(state, L(1, 2), [1, 4]);
    setCands(state, L(2, 3), [3, 4]);
    setCands(state, L(3, 3), [1, 3]);
    // Si L1C1 valait 3, L1C2 devrait valoir 1 (paire 3-4 exclue par L2C3) : exclu par L3C3.
    expect(removes([...alignedPairExclusion(state, ctx)], L(1, 1), 3)).toBe(true);
  });

  it('ne trouve rien sans case voisine contraignante', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 3]);
    setCands(state, L(1, 2), [1, 4]);
    expect([...alignedPairExclusion(state, ctx)]).toEqual([]);
  });
});

/** Chaîne de 3D Medusa : L1C1 {1,2} = (2, col 1) L5C1 {2,3} = (3, ligne 5) L5C5 {3,1} = (1, col 5) L1C5. */
function medusaState(): LogicState {
  const state = blankState();
  setCands(state, L(1, 1), [1, 2]);
  setCands(state, L(5, 1), [2, 3]);
  setCands(state, L(5, 5), [3, 1]);
  removeCand(state, colCells(1, [L(1, 1), L(5, 1)]), 2);
  removeCand(state, rowCells(5, [L(5, 1), L(5, 5)]), 3);
  removeCand(state, colCells(5, [L(5, 5), L(1, 5)]), 1);
  return state;
}

describe('3D Medusa', () => {
  it('contradiction : L1C1 et L1C5 auraient tous deux le 1 (même couleur), cette couleur tombe', () => {
    const steps = [...medusa3d(medusaState(), ctx)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual({
      [L(1, 1)]: [1],
      [L(1, 5)]: [1],
      [L(5, 1)]: [2],
      [L(5, 5)]: [3],
    });
  });

  it('deux couleurs dans une case : ses autres candidats tombent', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2]);
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 1);
    removeCand(state, rowCells(1, [L(1, 1), L(1, 5)]), 2);
    const steps = [...medusa3d(state, ctx)];
    expect(steps.length).toBeGreaterThan(0);
    expect(elimMap(steps[0])).toEqual({ [L(1, 5)]: [3, 4, 5, 6, 7, 8, 9] });
  });

  it('laisse au coloriage simple les groupes d’un seul chiffre', () => {
    expect([...medusa3d(coloringState(), ctx)]).toEqual([]);
  });
});

describe('Chaînes d’inférences alternées (AIC)', () => {
  it('chaîne sur plusieurs chiffres : L1C5 perd le 1', () => {
    expect(removes([...aic(medusaState(), ctx)], L(1, 5), 1)).toBe(true);
  });

  it('liens de somme : dans une cage 10 de deux cases, 4 d’un côté exclut tout sauf 6 de l’autre', () => {
    const cageCtx = contextWith([{ sum: 10, cells: [L(5, 5), L(5, 6)] }]);
    const state = blankState();
    setCands(state, L(5, 5), [3, 4]);
    setCands(state, L(5, 6), [6, 7]);
    const graph = linkGraph(state, cageCtx, { strongBetweenCells: true, strongInCell: true });
    const weak = graph.weak[node(L(5, 5), 4)];
    expect(weak).toContain(node(L(5, 6), 7));
    expect(weak).not.toContain(node(L(5, 6), 6));
    expect(conflictChecker(state, cageCtx)(node(L(5, 5), 3), node(L(5, 6), 6))).toBe(true);
    expect(sorted(cageCombos(state, cageCtx, 0))).toEqual(
      sorted([digitBit(3) | digitBit(7), digitBit(4) | digitBit(6)]),
    );
  });

  it('ne trouve rien sans lien fort', () => {
    expect([...aic(blankState(), ctx)]).toEqual([]);
  });
});

describe('X-Cycles groupés', () => {
  /** Le 6 du bloc 1 est en ligne 1 (groupe L1C1-L1C2) ou en L3C3 ; en ligne 7, seulement en L7C3 et L7C8. */
  function groupedState(): LogicState {
    const state = blankState();
    removeCand(state, boxCells(1, 1, [L(1, 1), L(1, 2), L(3, 3)]), 6);
    removeCand(state, rowCells(7, [L(7, 3), L(7, 8)]), 6);
    return state;
  }

  it('groupe L1C1-L1C2 = L3C3 − L7C3 = L7C8 : L1C8 perd le 6', () => {
    expect(removes([...groupedXCycles(groupedState(), ctx)], L(1, 8), 6)).toBe(true);
  });

  it('la chaîne passe par le groupe de deux cases', () => {
    const steps = [...groupedXCycles(groupedState(), ctx)].filter((s) => removes([s], L(1, 8), 6));
    expect(steps[0].cells).toEqual(expect.arrayContaining([L(1, 1), L(1, 2), L(3, 3), L(7, 3), L(7, 8)]));
  });

  it('ne trouve rien sans lien fort', () => {
    expect([...groupedXCycles(blankState(), ctx)]).toEqual([]);
  });
});

describe('Ensembles presque verrouillés (ALS-XZ)', () => {
  it('deux cases {1,2} d’une même ligne : le 2 (ou le 1) quitte le reste de la ligne', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2]);
    setCands(state, L(1, 5), [1, 2]);
    const steps = [...alsXz(state, ctx)];
    expect(removes(steps, L(1, 9), 2) || removes(steps, L(1, 9), 1)).toBe(true);
  });

  it('ALS de deux cases {1,2,3} et ALS {1,3} reliés par le 3 : le 1 quitte le bloc 1', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2, 3]);
    setCands(state, L(1, 2), [1, 2, 3]);
    setCands(state, L(2, 3), [1, 3]);
    const steps = [...alsXz(state, ctx)];
    expect(removes(steps, L(3, 1), 1)).toBe(true);
    expect(removes(steps, L(2, 2), 1)).toBe(true);
  });

  it('ne trouve rien sans chiffre commun restreint', () => {
    const state = blankState();
    setCands(state, L(1, 1), [1, 2]);
    setCands(state, L(9, 9), [3, 4]);
    expect([...alsXz(state, ctx)]).toEqual([]);
  });
});
