import { digitBit, highestDigit, lowestDigit, popcount, singleDigit } from '../bits';
import { sees, type LogicContext } from './context';
import type { LogicState } from './types';

export interface EnumerateOptions {
  /** Tous les chiffres différents (cage) ; sinon, seules les cases qui se voient doivent différer. */
  allDistinct?: boolean;
  /** Chiffres qui doivent obligatoirement apparaître (masque). */
  required?: number;
  /** Conserver la liste complète des affectations trouvées. */
  collect?: boolean;
  /** Garde-fou sur le nombre d'affectations explorées. */
  maxLeaves?: number;
}

export interface Enumeration {
  /** Pour chaque case (dans l'ordre donné), les chiffres qui apparaissent dans au moins une affectation. */
  possible: number[];
  /** Les ensembles de chiffres utilisés (combinaisons), sous forme de masques. */
  sets: number[];
  /** Les affectations complètes, si `collect` est demandé. */
  assignments: { digits: number[]; mask: number }[];
  /** Vrai si le garde-fou a interrompu l'énumération : le résultat n'apporte alors aucune information. */
  truncated: boolean;
}

/**
 * Essaie toutes les façons de remplir `cells` avec leurs candidats, de sorte que
 * Σ coefs[i] × chiffre[i] = target, sans répéter un chiffre entre deux cases qui se voient.
 * C'est la « liste des combinaisons » d'un joueur, appliquée à une cage ou à une somme déduite.
 * Renvoie null si aucune affectation n'est possible (contradiction).
 */
export function enumerateSum(
  state: LogicState,
  ctx: LogicContext,
  cells: readonly number[],
  coefs: readonly number[],
  target: number,
  options: EnumerateOptions = {},
): Enumeration | null {
  const n = cells.length;
  const allDistinct = options.allDistinct ?? false;
  const required = options.required ?? 0;
  const maxLeaves = options.maxLeaves ?? 100_000;

  // On commence par les cases qui ont le moins de candidats : moins de pistes inutiles.
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => popcount(state.cand[cells[a]]) - popcount(state.cand[cells[b]]),
  );
  const oc = order.map((i) => cells[i]);
  const ok = order.map((i) => coefs[i]);

  // Bornes de ce que peuvent encore apporter les cases restantes, pour couper tôt.
  const sufMin = new Array<number>(n + 1).fill(0);
  const sufMax = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const m = state.cand[oc[i]];
    if (m === 0) return null;
    const lo = lowestDigit(m);
    const hi = highestDigit(m);
    sufMin[i] = sufMin[i + 1] + (ok[i] > 0 ? ok[i] * lo : ok[i] * hi);
    sufMax[i] = sufMax[i + 1] + (ok[i] > 0 ? ok[i] * hi : ok[i] * lo);
  }
  const conflicts = oc.map((a, i) =>
    allDistinct ? [] : oc.slice(0, i).flatMap((b, j) => (sees(ctx, a, b) ? [j] : [])),
  );

  const assigned = new Array<number>(n).fill(0);
  const possible = new Array<number>(n).fill(0);
  const sets = new Set<number>();
  const assignments: { digits: number[]; mask: number }[] = [];
  let leaves = 0;
  let truncated = false;

  const dfs = (i: number, partial: number, used: number): void => {
    if (truncated) return;
    if (i === n) {
      if (partial !== target || (used & required) !== required) return;
      leaves++;
      if (leaves > maxLeaves) {
        truncated = true;
        return;
      }
      for (let k = 0; k < n; k++) possible[k] |= digitBit(assigned[k]);
      sets.add(used);
      if (options.collect) {
        const digits = new Array<number>(n);
        for (let k = 0; k < n; k++) digits[order[k]] = assigned[k];
        assignments.push({ digits, mask: used });
      }
      return;
    }
    let m = state.cand[oc[i]];
    while (m !== 0) {
      const bit = m & -m;
      m ^= bit;
      if (allDistinct && used & bit) continue;
      const d = singleDigit(bit);
      if (!allDistinct && conflicts[i].some((j) => assigned[j] === d)) continue;
      const next = partial + ok[i] * d;
      if (next + sufMin[i + 1] > target || next + sufMax[i + 1] < target) continue;
      assigned[i] = d;
      dfs(i + 1, next, used | bit);
    }
    assigned[i] = 0;
  };
  dfs(0, 0, 0);

  if (truncated) {
    return { possible: cells.map((cell) => state.cand[cell]), sets: [], assignments: [], truncated: true };
  }
  if (leaves === 0) return null;
  const byInput = new Array<number>(n);
  for (let k = 0; k < n; k++) byInput[order[k]] = possible[k];
  return { possible: byInput, sets: [...sets].sort((a, b) => a - b), assignments, truncated: false };
}
