import { digitBit, digitsOf } from '../../bits';
import { CELL_COUNT } from '../../model';
import { sees, type LogicContext } from '../context';
import { cageCombos } from '../links';
import { makeStep } from '../state';
import type { LogicState, Step } from '../types';

/**
 * Aligned Pair Exclusion : pour deux cases A et B qui se voient, on essaie chaque paire (a, b) de leurs
 * candidats. Une paire est impossible si une case qui voit A et B n'a plus que les chiffres a et b (elle
 * serait vide), ou si A et B sont dans la même cage et qu'aucune combinaison de la cage ne contient a et b.
 * Un candidat de A (ou de B) qui ne figure dans aucune paire possible est éliminé.
 */
export function* alignedPairExclusion(state: LogicState, ctx: LogicContext): Generator<Step> {
  const free = (c: number): boolean => !state.value[c];
  for (let a = 0; a < CELL_COUNT; a++) {
    if (!free(a)) continue;
    for (const b of ctx.seen[a]) {
      if (b <= a || !free(b)) continue;
      const blockers = ctx.seen[a].filter(
        (c) => c !== b && free(c) && sees(ctx, c, b) && digitsOf(state.cand[c]).length <= 2,
      );
      const sameCage = ctx.cageOf[a] === ctx.cageOf[b];
      const combos = sameCage ? cageCombos(state, ctx, ctx.cageOf[a]) : [];
      let okA = 0;
      let okB = 0;
      for (const x of digitsOf(state.cand[a])) {
        for (const y of digitsOf(state.cand[b])) {
          if (x === y) continue;
          const pair = digitBit(x) | digitBit(y);
          if (blockers.some((c) => (state.cand[c] & ~pair) === 0)) continue;
          if (sameCage && !combos.some((m) => (m & pair) === pair)) continue;
          okA |= digitBit(x);
          okB |= digitBit(y);
        }
      }
      const elimsA = state.cand[a] & ~okA;
      const elimsB = state.cand[b] & ~okB;
      if (!elimsA && !elimsB) continue;
      // Éliminations dans l’ordre des cases (a < b), comme les autres techniques.
      const list = [
        { cell: a, digits: elimsA },
        { cell: b, digits: elimsB },
      ].filter((e) => e.digits);
      yield makeStep('aligned_pair_exclusion', {
        eliminations: list,
        cells: [a, b, ...blockers.filter((c) => (state.cand[c] & ~(state.cand[a] | state.cand[b])) === 0)],
        digits: state.cand[a] | state.cand[b],
        cages: sameCage ? [ctx.cageOf[a]] : [],
      });
    }
  }
}
