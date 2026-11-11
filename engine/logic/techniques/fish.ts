import { digitBit, popcount } from '../../bits';
import { cellAt } from '../../model';
import { EliminationSet, kCombinations, makeStep, unitPlacedMask } from '../state';
import type { LogicState, Step, TechniqueId } from '../types';

/**
 * Poissons (X-Wing pour 2 lignes, Swordfish pour 3) : si, dans n lignes, un chiffre n'est possible
 * que dans les mêmes n colonnes, il occupera ces colonnes dans ces lignes. On le retire donc des
 * autres cases de ces colonnes. Même raisonnement en échangeant lignes et colonnes.
 */
function* fish(state: LogicState, size: number, technique: TechniqueId): Generator<Step> {
  for (let d = 1; d <= 9; d++) {
    const bit = digitBit(d);
    for (const byRows of [true, false]) {
      const at = (line: number, i: number): number => (byRows ? cellAt(line, i) : cellAt(i, line));
      const bases: { line: number; positions: number }[] = [];
      for (let line = 0; line < 9; line++) {
        if (unitPlacedMask(state, byRows ? line : 9 + line) & bit) continue;
        let positions = 0;
        for (let i = 0; i < 9; i++) {
          const cell = at(line, i);
          if (!state.value[cell] && state.cand[cell] & bit) positions |= 1 << i;
        }
        const count = popcount(positions);
        if (count >= 2 && count <= size) bases.push({ line, positions });
      }
      for (const group of kCombinations(bases, size)) {
        let cover = 0;
        for (const g of group) cover |= g.positions;
        if (popcount(cover) !== size) continue;
        const baseLines = new Set(group.map((g) => g.line));
        const elims = new EliminationSet(state);
        const coverLines: number[] = [];
        for (let i = 0; i < 9; i++) {
          if (!(cover & (1 << i))) continue;
          coverLines.push(i);
          for (let line = 0; line < 9; line++) if (!baseLines.has(line)) elims.add(at(line, i), bit);
        }
        if (elims.isEmpty) continue;
        const cells = group.flatMap((g) =>
          coverLines.filter((i) => g.positions & (1 << i)).map((i) => at(g.line, i)),
        );
        const units = [
          ...group.map((g) => (byRows ? g.line : 9 + g.line)),
          ...coverLines.map((i) => (byRows ? 9 + i : i)),
        ];
        yield makeStep(technique, { eliminations: elims.list(), cells, digits: bit, units });
      }
    }
  }
}

export const xWing = (state: LogicState): Generator<Step> => fish(state, 2, 'x_wing');
export const swordfish = (state: LogicState): Generator<Step> => fish(state, 3, 'swordfish');
export const jellyfish = (state: LogicState): Generator<Step> => fish(state, 4, 'jellyfish');

/**
 * Poissons à aileron : n lignes où le chiffre tient dans n colonnes, sauf quelques places en trop
 * (l'aileron), toutes dans un même bloc. Soit le poisson tient (le chiffre est dans ces colonnes, sur
 * ces lignes), soit l'aileron est vrai. Les cases des colonnes du poisson qui sont dans le bloc de
 * l'aileron (hors des lignes de base) perdent donc le chiffre dans les deux cas.
 */
function* finnedFish(state: LogicState, size: number, technique: TechniqueId): Generator<Step> {
  const boxOfAt = (r: number, c: number): number => Math.floor(r / 3) * 3 + Math.floor(c / 3);
  for (let d = 1; d <= 9; d++) {
    const bit = digitBit(d);
    for (const byRows of [true, false]) {
      const at = (line: number, i: number): number => (byRows ? cellAt(line, i) : cellAt(i, line));
      const rowCol = (line: number, i: number): [number, number] => (byRows ? [line, i] : [i, line]);
      const bases: { line: number; positions: number }[] = [];
      for (let line = 0; line < 9; line++) {
        if (unitPlacedMask(state, byRows ? line : 9 + line) & bit) continue;
        let positions = 0;
        for (let i = 0; i < 9; i++) {
          const cell = at(line, i);
          if (!state.value[cell] && state.cand[cell] & bit) positions |= 1 << i;
        }
        const count = popcount(positions);
        if (count >= 2 && count <= size + 2) bases.push({ line, positions });
      }
      for (const group of kCombinations(bases, size)) {
        let union = 0;
        for (const g of group) union |= g.positions;
        const unionCount = popcount(union);
        if (unionCount <= size || unionCount > size + 2) continue;
        const columns = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => union & (1 << i));
        for (const cover of kCombinations(columns, size)) {
          const coverMask = cover.reduce((m, i) => m | (1 << i), 0);
          // Chaque ligne de base doit avoir au moins une place dans les colonnes du poisson.
          if (group.some((g) => (g.positions & coverMask) === 0)) continue;
          const fins = group.flatMap((g) =>
            columns
              .filter((i) => g.positions & (1 << i) && !(coverMask & (1 << i)))
              .map((i) => rowCol(g.line, i)),
          );
          const finBoxes = new Set(fins.map(([r, c]) => boxOfAt(r, c)));
          if (fins.length === 0 || finBoxes.size !== 1) continue;
          const finBox = [...finBoxes][0];
          const baseLines = new Set(group.map((g) => g.line));
          const elims = new EliminationSet(state);
          for (const i of cover) {
            for (let line = 0; line < 9; line++) {
              if (baseLines.has(line)) continue;
              const [r, c] = rowCol(line, i);
              if (boxOfAt(r, c) === finBox) elims.add(at(line, i), bit);
            }
          }
          if (elims.isEmpty) continue;
          const cells = group.flatMap((g) =>
            columns.filter((i) => g.positions & (1 << i)).map((i) => at(g.line, i)),
          );
          const units = [
            ...group.map((g) => (byRows ? g.line : 9 + g.line)),
            ...cover.map((i) => (byRows ? 9 + i : i)),
          ];
          yield makeStep(technique, { eliminations: elims.list(), cells, digits: bit, units });
        }
      }
    }
  }
}

export const finnedXWing = (state: LogicState): Generator<Step> => finnedFish(state, 2, 'finned_x_wing');
export const finnedSwordfish = (state: LogicState): Generator<Step> =>
  finnedFish(state, 3, 'finned_swordfish');
