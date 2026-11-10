import { digitBit, EVEN_DIGITS, ODD_DIGITS, popcount } from '../../bits';
import { UNITS } from '../../model';
import type { LogicContext } from '../context';
import { enumerateSum, type Enumeration } from '../enumerate';
import {
  commonUnits,
  EliminationSet,
  freeCells,
  kCombinations,
  makeStep,
  placedInfo,
  positionsInUnit,
  unitPlacedMask,
} from '../state';
import type { LogicState, Step } from '../types';

/** Au-delà de cette taille, l'énumération d'une cage serait trop coûteuse (les cages font au plus 6 cases). */
const MAX_ENUMERATED_CELLS = 7;

interface CageView {
  free: number[];
  placedMask: number;
  remaining: number;
}

function cageView(state: LogicState, ctx: LogicContext, index: number): CageView {
  const cage = ctx.cages[index];
  const placed = placedInfo(state, cage.cells);
  return { free: freeCells(state, cage.cells), placedMask: placed.mask, remaining: cage.sum - placed.sum };
}

function enumerateCage(
  state: LogicState,
  ctx: LogicContext,
  view: CageView,
  options: { required?: number; collect?: boolean } = {},
): Enumeration | null {
  if (view.free.length === 0 || view.free.length > MAX_ENUMERATED_CELLS) return null;
  const result = enumerateSum(
    state,
    ctx,
    view.free,
    view.free.map(() => 1),
    view.remaining,
    { allDistinct: true, ...options },
  );
  return result && !result.truncated ? result : null;
}

/**
 * Combinaisons de cage : on garde, dans chaque case de la cage, seulement les chiffres qui
 * apparaissent dans une combinaison encore réalisable avec les candidats actuels.
 */
export function* cageCombination(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (let k = 0; k < ctx.cages.length; k++) {
    const view = cageView(state, ctx, k);
    const result = enumerateCage(state, ctx, view);
    if (!result) continue;
    const elims = new EliminationSet(state);
    view.free.forEach((cell, i) => elims.add(cell, ~result.possible[i]));
    if (elims.isEmpty) continue;
    yield makeStep('cage_combination', {
      eliminations: elims.list(),
      cells: [...ctx.cages[k].cells],
      cages: [k],
      combos: result.sets.map((set) => set | view.placedMask),
    });
  }
}

/**
 * Chevauchement cage/unité, dans les deux sens :
 * - un chiffre obligatoire dans une cage, dont toutes les places possibles sont dans une même unité,
 *   est retiré du reste de cette unité ;
 * - un chiffre dont toutes les places possibles dans une unité sont dans une même cage appartient à
 *   cette cage : on le retire des cases de la cage hors de l'unité, et on ne garde que les combinaisons
 *   qui le contiennent.
 */
export function* cageUnitOverlap(state: LogicState, ctx: LogicContext): Generator<Step> {
  // Sens cage → unité.
  for (let k = 0; k < ctx.cages.length; k++) {
    const view = cageView(state, ctx, k);
    if (view.free.length < 2) continue;
    const result = enumerateCage(state, ctx, view);
    if (!result) continue;
    let required = result.sets.reduce((acc, set) => acc & set, 0x1ff);
    const byUnit = new Map<number, { digits: number; holders: Set<number> }>();
    while (required !== 0) {
      const bit = required & -required;
      required ^= bit;
      const holders = view.free.filter((cell) => state.cand[cell] & bit);
      if (holders.length < 2) continue;
      for (const unit of commonUnits(holders)) {
        const entry = byUnit.get(unit) ?? { digits: 0, holders: new Set<number>() };
        entry.digits |= bit;
        for (const cell of holders) entry.holders.add(cell);
        byUnit.set(unit, entry);
      }
    }
    const cageCells = new Set(ctx.cages[k].cells);
    for (const [unit, { digits, holders }] of byUnit) {
      const elims = new EliminationSet(state);
      for (const cell of UNITS[unit]) if (!cageCells.has(cell)) elims.add(cell, digits);
      if (elims.isEmpty) continue;
      yield makeStep('cage_unit_overlap', {
        eliminations: elims.list(),
        cells: [...holders].sort((a, b) => a - b),
        digits,
        units: [unit],
        cages: [k],
      });
    }
  }

  // Sens unité → cage.
  for (let unit = 0; unit < UNITS.length; unit++) {
    const placed = unitPlacedMask(state, unit);
    const unitCells = new Set(UNITS[unit]);
    for (let d = 1; d <= 9; d++) {
      const bit = digitBit(d);
      if (placed & bit) continue;
      const positions = positionsInUnit(state, unit, bit);
      if (positions.length < 2) continue;
      const k = ctx.cageOf[positions[0]];
      if (!positions.every((cell) => ctx.cageOf[cell] === k)) continue;
      const view = cageView(state, ctx, k);
      const elims = new EliminationSet(state);
      for (const cell of view.free) if (!unitCells.has(cell)) elims.add(cell, bit);
      const result = enumerateCage(state, ctx, view, { required: bit });
      if (result) view.free.forEach((cell, i) => elims.add(cell, ~result.possible[i]));
      if (elims.isEmpty) continue;
      yield makeStep('cage_unit_overlap', {
        eliminations: elims.list(),
        cells: positions,
        digits: bit,
        units: [unit],
        cages: [k],
      });
    }
  }
}

/** Cages entièrement contenues dans une unité, avec au moins une case vide. */
function cagesInsideUnit(state: LogicState, ctx: LogicContext, unit: number): number[] {
  const unitCells = new Set(UNITS[unit]);
  const indices = [...new Set(UNITS[unit].map((cell) => ctx.cageOf[cell]))];
  return indices.filter(
    (k) =>
      k >= 0 &&
      ctx.cages[k].cells.every((cell) => unitCells.has(cell)) &&
      ctx.cages[k].cells.some((cell) => !state.value[cell]),
  );
}

/**
 * Combinaisons croisées : deux cages dans la même unité ne peuvent pas partager de chiffre.
 * On écarte les combinaisons d'une cage qui entrent en conflit avec toutes celles de l'autre.
 */
export function* crossCageCombinations(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const inside = cagesInsideUnit(state, ctx, unit);
    for (const [a, b] of kCombinations(inside, 2)) {
      const viewA = cageView(state, ctx, a);
      const viewB = cageView(state, ctx, b);
      const listA = enumerateCage(state, ctx, viewA, { collect: true });
      const listB = enumerateCage(state, ctx, viewB, { collect: true });
      if (!listA || !listB) continue;
      const possibleA = new Array<number>(viewA.free.length).fill(0);
      const possibleB = new Array<number>(viewB.free.length).fill(0);
      for (const x of listA.assignments) {
        for (const y of listB.assignments) {
          if (x.mask & y.mask) continue;
          x.digits.forEach((d, i) => (possibleA[i] |= digitBit(d)));
          y.digits.forEach((d, i) => (possibleB[i] |= digitBit(d)));
        }
      }
      const elims = new EliminationSet(state);
      viewA.free.forEach((cell, i) => elims.add(cell, ~possibleA[i]));
      viewB.free.forEach((cell, i) => elims.add(cell, ~possibleB[i]));
      if (elims.isEmpty) continue;
      yield makeStep('cross_cage_combinations', {
        eliminations: elims.list(),
        cells: [...ctx.cages[a].cells, ...ctx.cages[b].cells],
        units: [unit],
        cages: [a, b],
      });
    }
  }
}

/**
 * Parité : une unité contient exactement 5 chiffres impairs (1, 3, 5, 7, 9).
 * Les cages entièrement incluses ont un nombre d'impairs limité par leurs combinaisons ;
 * on en déduit la parité des autres cases (ou on écarte des combinaisons).
 */
export function* parity(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const inside = cagesInsideUnit(state, ctx, unit);
    if (inside.length === 0) continue;
    let base = 0;
    for (const cell of UNITS[unit]) if (state.value[cell] && digitBit(state.value[cell]) & ODD_DIGITS) base++;

    // Chaque « morceau » propose des nombres d'impairs possibles ; pour une cage, on garde aussi
    // les chiffres possibles de chaque case selon ce nombre.
    interface Part {
      cells: number[];
      options: Map<number, number[]>;
    }
    const parts: Part[] = [];
    const inCage = new Set<number>();
    let valid = true;
    for (const k of inside) {
      const view = cageView(state, ctx, k);
      const result = enumerateCage(state, ctx, view, { collect: true });
      if (!result) {
        valid = false;
        break;
      }
      const options = new Map<number, number[]>();
      for (const a of result.assignments) {
        const odd = popcount(a.mask & ODD_DIGITS);
        const masks = options.get(odd) ?? view.free.map(() => 0);
        a.digits.forEach((d, i) => (masks[i] |= digitBit(d)));
        options.set(odd, masks);
      }
      parts.push({ cells: view.free, options });
      for (const cell of view.free) inCage.add(cell);
    }
    if (!valid) continue;
    for (const cell of UNITS[unit]) {
      if (state.value[cell] || inCage.has(cell)) continue;
      const options = new Map<number, number[]>();
      if (state.cand[cell] & ODD_DIGITS) options.set(1, [state.cand[cell] & ODD_DIGITS]);
      if (state.cand[cell] & EVEN_DIGITS) options.set(0, [state.cand[cell] & EVEN_DIGITS]);
      parts.push({ cells: [cell], options });
    }

    // Sommes atteignables avec les morceaux avant i (prefix) et après i (suffix), en bits.
    const target = 5 - base;
    const prefix = [1];
    for (const part of parts) {
      let next = 0;
      for (const odd of part.options.keys()) next |= prefix[prefix.length - 1] << odd;
      prefix.push(next);
    }
    const suffix = new Array<number>(parts.length + 1).fill(0);
    suffix[parts.length] = 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      for (const odd of parts[i].options.keys()) suffix[i] |= suffix[i + 1] << odd;
    }
    const feasible = (i: number, odd: number): boolean => {
      for (let s = 0; s <= target - odd; s++) {
        if (prefix[i] & (1 << s) && suffix[i + 1] & (1 << (target - odd - s))) return true;
      }
      return false;
    };

    const elims = new EliminationSet(state);
    parts.forEach((part, i) => {
      const allowed = part.cells.map(() => 0);
      for (const [odd, masks] of part.options) {
        if (feasible(i, odd)) masks.forEach((m, j) => (allowed[j] |= m));
      }
      part.cells.forEach((cell, j) => elims.add(cell, ~allowed[j]));
    });
    if (elims.isEmpty) continue;
    yield makeStep('parity', {
      eliminations: elims.list(),
      cells: freeCells(state, UNITS[unit]),
      units: [unit],
      cages: inside,
      digits: ODD_DIGITS,
    });
  }
}
