/**
 * Coloriage (groupe C) : on relie les candidats par des liens forts et on les colorie en deux couleurs qui
 * alternent le long des liens. Dans chaque groupe relié, une couleur entière est vraie et l'autre fausse.
 * - Si deux candidats de même couleur se contredisent, cette couleur est fausse (« contradiction »).
 * - Un candidat incompatible avec les deux couleurs est faux (« piège »).
 * Coloriage simple : un seul chiffre. 3D Medusa : tous les chiffres, liens dans les cases compris.
 */
import { digitBit } from '../../bits';
import { CELL_COUNT } from '../../model';
import type { LogicContext } from '../context';
import { cellOfNode, conflictChecker, digitOfNode, linkGraph, node } from '../links';
import { EliminationSet, makeStep } from '../state';
import type { LogicState, Step, TechniqueId } from '../types';

/** Groupes reliés par des liens forts, avec la couleur (0 ou 1) de chaque candidat. */
function components(strong: readonly number[][]): Map<number, number>[] {
  const color = new Int8Array(strong.length).fill(-1);
  const result: Map<number, number>[] = [];
  for (let start = 0; start < strong.length; start++) {
    if (color[start] !== -1 || strong[start].length === 0) continue;
    const comp = new Map<number, number>([[start, 0]]);
    color[start] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const n = queue[head];
      for (const m of strong[n]) {
        if (color[m] !== -1) continue;
        color[m] = 1 - color[n];
        comp.set(m, color[m]);
        queue.push(m);
      }
    }
    if (comp.size >= 3) result.push(comp);
  }
  return result;
}

function* colorSteps(
  state: LogicState,
  ctx: LogicContext,
  comp: Map<number, number>,
  technique: TechniqueId,
): Generator<Step> {
  const conflicts = conflictChecker(state, ctx);
  const nodes = [...comp.keys()];
  const cells = [...new Set(nodes.map(cellOfNode))];
  const digits = nodes.reduce((m, n) => m | digitBit(digitOfNode(n)), 0);
  // Contradiction : deux candidats de même couleur incompatibles ⇒ toute cette couleur est fausse.
  for (const k of [0, 1]) {
    const same = nodes.filter((n) => comp.get(n) === k);
    const broken = same.some((a, i) => same.slice(i + 1).some((b) => conflicts(a, b)));
    if (!broken) continue;
    const elims = new EliminationSet(state);
    for (const n of same) elims.add(cellOfNode(n), digitBit(digitOfNode(n)));
    if (!elims.isEmpty) yield makeStep(technique, { eliminations: elims.list(), cells, digits });
  }
  // Piège : un candidat hors du groupe, incompatible avec les deux couleurs.
  const elims = new EliminationSet(state);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (state.value[cell]) continue;
    for (let d = 1; d <= 9; d++) {
      if (!(state.cand[cell] & digitBit(d))) continue;
      const n = node(cell, d);
      if (comp.has(n)) continue;
      let seen = 0;
      for (const m of nodes) if (conflicts(n, m)) seen |= 1 << (comp.get(m) ?? 0);
      if (seen === 3) elims.add(cell, digitBit(d));
    }
  }
  if (!elims.isEmpty) yield makeStep(technique, { eliminations: elims.list(), cells, digits });
}

/** Coloriage simple : un chiffre, liens forts entre cases (lignes, colonnes, blocs, cages). */
export function* simpleColoring(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (let d = 1; d <= 9; d++) {
    const { strong } = linkGraph(state, ctx, { digit: d, strongBetweenCells: true, strongInCell: false });
    for (const comp of components(strong)) yield* colorSteps(state, ctx, comp, 'simple_coloring');
  }
}

/** 3D Medusa : coloriage de tous les candidats, liens forts entre cases et dans les cases à deux candidats. */
export function* medusa3d(state: LogicState, ctx: LogicContext): Generator<Step> {
  const { strong } = linkGraph(state, ctx, { strongBetweenCells: true, strongInCell: true });
  for (const comp of components(strong)) {
    // Un groupe d'un seul chiffre relève du coloriage simple.
    const digits = new Set([...comp.keys()].map(digitOfNode));
    if (digits.size < 2) continue;
    yield* colorSteps(state, ctx, comp, 'medusa_3d');
  }
}
