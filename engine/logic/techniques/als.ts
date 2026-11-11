import { digitBit, popcount } from '../../bits';
import { CELL_COUNT, UNITS } from '../../model';
import { sees, type LogicContext } from '../context';
import { EliminationSet, kCombinations, makeStep } from '../state';
import type { LogicState, Step } from '../types';

/** Ensemble presque verrouillé : N cases d'un même groupe qui se partagent N + 1 candidats. */
interface Als {
  cells: number[];
  mask: number;
  /** Pour chaque chiffre (1 à 9), les cases de l'ensemble qui l'ont en candidat. */
  byDigit: number[][];
}

const MAX_SIZE = 4;

/** Tous les ALS de 1 à 4 cases, pris dans les lignes, colonnes, blocs et cages. */
function findAls(state: LogicState, ctx: LogicContext): Als[] {
  const result: Als[] = [];
  const keys = new Set<string>();
  const groups = [...UNITS, ...ctx.cages.map((c) => c.cells)];
  for (const group of groups) {
    const free = group.filter((c) => !state.value[c]);
    for (let size = 1; size <= Math.min(MAX_SIZE, free.length - 1); size++) {
      for (const cells of kCombinations(free, size)) {
        const mask = cells.reduce((m, c) => m | state.cand[c], 0);
        if (popcount(mask) !== size + 1) continue;
        const key = [...cells].sort((a, b) => a - b).join(',');
        if (keys.has(key)) continue;
        keys.add(key);
        const byDigit = Array.from({ length: 10 }, (_, d) =>
          d === 0 ? [] : cells.filter((c) => state.cand[c] & digitBit(d)),
        );
        result.push({ cells, mask, byDigit });
      }
    }
  }
  return result;
}

/**
 * ALS-XZ : deux ALS A et B sans case commune. Un chiffre commun X est « restreint » si chaque place de X
 * dans A voit chaque place de X dans B : X est alors au plus dans l'un des deux. L'autre devient verrouillé
 * (N cases, N chiffres). Pour un second chiffre commun Z, l'un des deux ensembles contient donc Z : toute
 * case qui voit toutes les places de Z dans A et dans B ne peut pas valoir Z.
 */
export function* alsXz(state: LogicState, ctx: LogicContext): Generator<Step> {
  const all = findAls(state, ctx);
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      const common = a.mask & b.mask;
      if (popcount(common) < 2) continue;
      if (a.cells.some((c) => b.cells.includes(c))) continue;
      for (let x = 1; x <= 9; x++) {
        if (!(common & digitBit(x))) continue;
        const restricted = a.byDigit[x].every((p) => b.byDigit[x].every((q) => sees(ctx, p, q)));
        if (!restricted) continue;
        const elims = new EliminationSet(state);
        for (let z = 1; z <= 9; z++) {
          if (z === x || !(common & digitBit(z))) continue;
          const holders = [...a.byDigit[z], ...b.byDigit[z]];
          for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (a.cells.includes(cell) || b.cells.includes(cell)) continue;
            if (holders.every((h) => sees(ctx, cell, h))) elims.add(cell, digitBit(z));
          }
        }
        if (elims.isEmpty) continue;
        yield makeStep('als_xz', {
          eliminations: elims.list(),
          cells: [...a.cells, ...b.cells],
          digits: common,
        });
      }
    }
  }
}
