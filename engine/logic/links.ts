/**
 * Liens entre candidats, base des chaînes et du coloriage (groupes C et D).
 *
 * Un candidat est un couple (case, chiffre), numéroté case × 9 + (chiffre − 1).
 * - Lien FORT entre A et B : au moins l'un des deux est vrai. Cas possibles :
 *   - un chiffre qui n'a que deux places dans une ligne, une colonne ou un bloc ;
 *   - un chiffre OBLIGATOIRE dans une cage (toutes ses combinaisons possibles le contiennent) qui n'y a
 *     plus que deux places : c'est l'apport propre au killer ;
 *   - une case qui n'a plus que deux candidats (les deux chiffres de cette case).
 * - Lien FAIBLE entre A et B : ils ne peuvent pas être vrais tous les deux. Cas possibles :
 *   - même chiffre dans deux cases qui se voient (y compris dans une même cage) ;
 *   - deux chiffres d'une même case ;
 *   - deux chiffres de deux cases d'une même cage qu'aucune combinaison possible de la cage ne réunit
 *     (« lien de somme », propre au killer : dans une cage 10 de deux cases, 3 d'un côté impose 7 de l'autre).
 */
import { digitBit, popcount } from '../bits';
import { combinationsFor } from '../combinations';
import { CELL_COUNT, UNITS } from '../model';
import { sees, type LogicContext } from './context';
import type { LogicState } from './types';

export const node = (cell: number, digit: number): number => cell * 9 + digit - 1;
export const cellOfNode = (n: number): number => Math.floor(n / 9);
export const digitOfNode = (n: number): number => (n % 9) + 1;

/**
 * Chiffres obligatoires d'une cage : ceux de toutes ses combinaisons encore possibles. Une combinaison est
 * gardée si elle n'utilise pas un chiffre déjà posé et si ses chiffres restent dans les candidats des
 * cases libres (filtre large : un chiffre déclaré obligatoire l'est forcément).
 */
export function cageRequired(state: LogicState, ctx: LogicContext, cageIndex: number): number {
  const cage = ctx.cages[cageIndex];
  let placed = 0;
  let placedSum = 0;
  let union = 0;
  let free = 0;
  for (const cell of cage.cells) {
    if (state.value[cell]) {
      placed |= digitBit(state.value[cell]);
      placedSum += state.value[cell];
    } else {
      union |= state.cand[cell];
      free++;
    }
  }
  if (free === 0) return 0;
  let required = -1;
  for (const combo of combinationsFor(free, cage.sum - placedSum)) {
    if (combo & placed || combo & ~union) continue;
    required &= combo;
  }
  return required === -1 ? 0 : required & 0x1ff;
}

/**
 * Combinaisons complètes encore possibles d'une cage (masques, chiffres déjà posés compris) : chaque
 * combinaison contient les chiffres posés, et ses autres chiffres restent dans les candidats des cases libres.
 */
export function cageCombos(state: LogicState, ctx: LogicContext, cageIndex: number): number[] {
  const cage = ctx.cages[cageIndex];
  let placed = 0;
  let union = 0;
  for (const c of cage.cells) {
    if (state.value[c]) placed |= digitBit(state.value[c]);
    else union |= state.cand[c];
  }
  return combinationsFor(cage.cells.length, cage.sum).filter(
    (m) => (placed & ~m) === 0 && (m & ~(union | placed)) === 0,
  );
}

/**
 * Prépare le test « ces deux candidats ne peuvent pas être vrais ensemble », liens de somme compris.
 */
export function conflictChecker(state: LogicState, ctx: LogicContext): (a: number, b: number) => boolean {
  const combos = ctx.cages.map((_, k) => cageCombos(state, ctx, k));
  return (a, b) => {
    if (a === b) return false;
    const ca = cellOfNode(a);
    const cb = cellOfNode(b);
    if (ca === cb) return true;
    const x = digitOfNode(a);
    const y = digitOfNode(b);
    if (x === y) return sees(ctx, ca, cb);
    const k = ctx.cageOf[ca];
    if (k !== ctx.cageOf[cb]) return false;
    const pair = digitBit(x) | digitBit(y);
    return !combos[k].some((m) => (m & pair) === pair);
  };
}

/** Groupes où un chiffre ne peut apparaître qu'une fois : les 27 unités et les cages. */
function groups(ctx: LogicContext): readonly (readonly number[])[] {
  return [...UNITS, ...ctx.cages.map((c) => c.cells)];
}

/**
 * Paires de cases fortement liées pour un chiffre (seules places du chiffre dans une unité, ou dans une
 * cage où il est obligatoire). Chaque paire n'est donnée qu'une fois.
 */
export function strongPairs(state: LogicState, ctx: LogicContext, digit: number): [number, number][] {
  const bit = digitBit(digit);
  const seen = new Set<number>();
  const pairs: [number, number][] = [];
  const all = groups(ctx);
  all.forEach((cells, g) => {
    const isCage = g >= UNITS.length;
    if (cells.some((c) => state.value[c] === digit)) return;
    if (isCage && !(cageRequired(state, ctx, g - UNITS.length) & bit)) return;
    const places = cells.filter((c) => !state.value[c] && state.cand[c] & bit);
    if (places.length !== 2) return;
    const [a, b] = places[0] < places[1] ? places : [places[1], places[0]];
    const key = a * CELL_COUNT + b;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([a, b]);
  });
  return pairs;
}

export interface LinkGraph {
  strong: number[][];
  weak: number[][];
}

export interface GraphOptions {
  /** Ne garder que ce chiffre (chaînes à un seul chiffre). */
  digit?: number;
  /** Ne garder que les cases à deux candidats (XY-Chain). */
  bivalueOnly?: boolean;
  /** Liens forts entre cases (même chiffre) et à l'intérieur d'une case (deux candidats). */
  strongBetweenCells: boolean;
  strongInCell: boolean;
}

/** Construit le graphe des liens forts et faibles entre les candidats de l'état. */
export function linkGraph(state: LogicState, ctx: LogicContext, options: GraphOptions): LinkGraph {
  const strong: number[][] = Array.from({ length: CELL_COUNT * 9 }, () => []);
  const weak: number[][] = Array.from({ length: CELL_COUNT * 9 }, () => []);
  const allowed = (cell: number, d: number): boolean =>
    !state.value[cell] &&
    (state.cand[cell] & digitBit(d)) !== 0 &&
    (options.digit === undefined || options.digit === d) &&
    (!options.bivalueOnly || popcount(state.cand[cell]) === 2);
  const digits = options.digit === undefined ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [options.digit];

  for (const d of digits) {
    if (options.strongBetweenCells) {
      for (const [a, b] of strongPairs(state, ctx, d)) {
        if (!allowed(a, d) || !allowed(b, d)) continue;
        strong[node(a, d)].push(node(b, d));
        strong[node(b, d)].push(node(a, d));
      }
    }
    for (let a = 0; a < CELL_COUNT; a++) {
      if (!allowed(a, d)) continue;
      for (const b of ctx.seen[a]) if (allowed(b, d)) weak[node(a, d)].push(node(b, d));
    }
  }
  // Liens de somme : deux chiffres différents, dans deux cases d'une même cage, qu'aucune combinaison ne réunit.
  if (options.digit === undefined && !options.bivalueOnly) {
    ctx.cages.forEach((cage, k) => {
      const combos = cageCombos(state, ctx, k);
      const free = cage.cells.filter((c) => !state.value[c]);
      for (const a of free) {
        for (const b of free) {
          if (a === b) continue;
          for (const x of digits) {
            if (!allowed(a, x)) continue;
            for (const y of digits) {
              if (x === y || !allowed(b, y)) continue;
              const pair = digitBit(x) | digitBit(y);
              if (!combos.some((m) => (m & pair) === pair)) weak[node(a, x)].push(node(b, y));
            }
          }
        }
      }
    });
  }
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (state.value[cell]) continue;
    const ds = digits.filter((d) => allowed(cell, d));
    for (const x of ds) {
      for (const y of ds) {
        if (x === y) continue;
        // Deux chiffres d'une même case : lien faible (pour les chaînes à plusieurs chiffres).
        if (options.digit === undefined && !options.bivalueOnly) weak[node(cell, x)].push(node(cell, y));
      }
    }
    if (options.strongInCell && popcount(state.cand[cell]) === 2 && ds.length === 2) {
      strong[node(cell, ds[0])].push(node(cell, ds[1]));
      strong[node(cell, ds[1])].push(node(cell, ds[0]));
    }
  }
  return { strong, weak };
}
