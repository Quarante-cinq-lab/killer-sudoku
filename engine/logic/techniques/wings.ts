import { popcount } from '../../bits';
import { CELL_COUNT } from '../../model';
import { sees, type LogicContext } from '../context';
import { EliminationSet, makeStep } from '../state';
import type { LogicState, Step } from '../types';

/**
 * Y-Wing : une case pivot {x, y} voit deux « ailes » {x, z} et {y, z}. Quel que soit le chiffre du
 * pivot, l'une des ailes vaudra z : toute case qui voit les deux ailes ne peut pas valoir z.
 * (« Voir » = même ligne, colonne, bloc ou cage.)
 */
export function* yWing(state: LogicState, ctx: LogicContext): Generator<Step> {
  const bivalue = cellsWithCount(state, 2);
  for (const pivot of bivalue) {
    const p = state.cand[pivot];
    const wings = bivalue.filter((w) => w !== pivot && sees(ctx, pivot, w));
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = state.cand[wings[i]];
        const b = state.cand[wings[j]];
        const z = a & b & ~p;
        // Chaque aile partage un chiffre différent avec le pivot, et les deux ailes partagent z.
        if (popcount(z) !== 1 || popcount(a & p) !== 1 || popcount(b & p) !== 1 || (a & p) === (b & p))
          continue;
        const elims = new EliminationSet(state);
        for (let cell = 0; cell < CELL_COUNT; cell++) {
          if (cell === pivot || cell === wings[i] || cell === wings[j]) continue;
          if (sees(ctx, cell, wings[i]) && sees(ctx, cell, wings[j])) elims.add(cell, z);
        }
        if (elims.isEmpty) continue;
        yield makeStep('y_wing', {
          eliminations: elims.list(),
          cells: [pivot, wings[i], wings[j]],
          digits: z,
        });
      }
    }
  }
}

/**
 * XYZ-Wing : comme le Y-Wing, mais le pivot a trois candidats {x, y, z}. Les cases qui voient le pivot
 * et les deux ailes ne peuvent pas valoir z.
 */
export function* xyzWing(state: LogicState, ctx: LogicContext): Generator<Step> {
  const bivalue = cellsWithCount(state, 2);
  for (const pivot of cellsWithCount(state, 3)) {
    const p = state.cand[pivot];
    const wings = bivalue.filter((w) => sees(ctx, pivot, w) && (state.cand[w] & ~p) === 0);
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = state.cand[wings[i]];
        const b = state.cand[wings[j]];
        const z = a & b;
        if (popcount(z) !== 1 || (a | b) !== p) continue;
        const elims = new EliminationSet(state);
        for (let cell = 0; cell < CELL_COUNT; cell++) {
          if (cell === pivot || cell === wings[i] || cell === wings[j]) continue;
          if (sees(ctx, cell, pivot) && sees(ctx, cell, wings[i]) && sees(ctx, cell, wings[j]))
            elims.add(cell, z);
        }
        if (elims.isEmpty) continue;
        yield makeStep('xyz_wing', {
          eliminations: elims.list(),
          cells: [pivot, wings[i], wings[j]],
          digits: z,
        });
      }
    }
  }
}

function cellsWithCount(state: LogicState, count: number): number[] {
  const list: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (!state.value[cell] && popcount(state.cand[cell]) === count) list.push(cell);
  }
  return list;
}

/**
 * WXYZ-Wing : un pivot et trois ailes qu'il voit, quatre cases qui se partagent exactement quatre chiffres.
 * Un chiffre est « restreint » si toutes les cases qui le contiennent se voient deux à deux (il y est au
 * plus une fois). Si un seul chiffre Z n'est pas restreint, il est forcément dans l'une de ses cases : les
 * cases qui voient toutes ces positions de Z ne peuvent pas valoir Z.
 */
export function* wxyzWing(state: LogicState, ctx: LogicContext): Generator<Step> {
  const free = (c: number): boolean =>
    !state.value[c] && popcount(state.cand[c]) >= 2 && popcount(state.cand[c]) <= 4;
  for (let pivot = 0; pivot < CELL_COUNT; pivot++) {
    if (!free(pivot)) continue;
    const wings = ctx.seen[pivot].filter((c) => free(c) && popcount(state.cand[c] | state.cand[pivot]) <= 4);
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        for (let k = j + 1; k < wings.length; k++) {
          const cells = [pivot, wings[i], wings[j], wings[k]];
          const union = cells.reduce((m, c) => m | state.cand[c], 0);
          if (popcount(union) !== 4) continue;
          let loose = 0;
          for (let d = 1; d <= 9; d++) {
            const bit = 1 << (d - 1);
            if (!(union & bit)) continue;
            const holders = cells.filter((c) => state.cand[c] & bit);
            const restricted = holders.every((a, x) => holders.slice(x + 1).every((b) => sees(ctx, a, b)));
            if (!restricted) loose |= bit;
          }
          if (popcount(loose) !== 1) continue;
          const holders = cells.filter((c) => state.cand[c] & loose);
          const elims = new EliminationSet(state);
          for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (cells.includes(cell)) continue;
            if (holders.every((h) => sees(ctx, cell, h))) elims.add(cell, loose);
          }
          if (elims.isEmpty) continue;
          yield makeStep('wxyz_wing', { eliminations: elims.list(), cells, digits: loose });
        }
      }
    }
  }
}
