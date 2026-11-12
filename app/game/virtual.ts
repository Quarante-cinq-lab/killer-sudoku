/**
 * Cages virtuelles (évolution E5) : notes du joueur du type « ces cases font X au total ».
 * - Somme proposée à la création, quand elle se déduit des cages de la grille.
 * - Conflits : une cage virtuelle dont les chiffres posés rendent la somme impossible est signalée.
 *   Une cage virtuelle n'est jamais comparée à la solution : c'est une note du joueur.
 */
import { digitBit } from '../../engine/bits';
import { combinationsFor } from '../../engine/combinations';
import { cageIndexByCell, UNITS, type Puzzle } from '../../engine/model';
import { allDistinct } from './aids';
import type { VirtualCage } from './state';

/** Nombre de couleurs différentes pour les cages virtuelles (ensuite, on reprend la première). */
export const VIRTUAL_COLORS = 6;

/** Couleur d'une cage virtuelle (1 à VIRTUAL_COLORS), toujours la même pour une cage donnée. */
export const virtualColor = (id: number): number => ((id - 1) % VIRTUAL_COLORS) + 1;

export type SumSuggestion =
  | { sum: number; reason: 'cages'; cages: number }
  | { sum: number; reason: 'unit'; unit: number; cages: number };

/**
 * Somme proposée pour une sélection de cases :
 * - si elle est faite de cages entières : la somme de ces cages ;
 * - si c'est une ligne, une colonne ou un bloc moins des cages entières : 45 moins ces cages ;
 * - sinon : rien (le joueur tape la somme).
 */
export function suggestSum(puzzle: Puzzle, cells: readonly number[]): SumSuggestion | null {
  if (cells.length === 0) return null;
  const owner = cageIndexByCell(puzzle);
  const selected = new Set(cells);
  const touched = [...new Set(cells.map((c) => owner[c]))];
  if (touched.every((k) => puzzle.cages[k].cells.every((c) => selected.has(c)))) {
    return {
      sum: touched.reduce((s, k) => s + puzzle.cages[k].sum, 0),
      reason: 'cages',
      cages: touched.length,
    };
  }
  for (let unit = 0; unit < UNITS.length; unit++) {
    const zone = UNITS[unit];
    if (!cells.every((c) => zone.includes(c))) continue;
    const rest = zone.filter((c) => !selected.has(c));
    const restCages = [...new Set(rest.map((c) => owner[c]))];
    const restSet = new Set(rest);
    if (!restCages.every((k) => puzzle.cages[k].cells.every((c) => restSet.has(c)))) continue;
    const sum = 45 - restCages.reduce((s, k) => s + puzzle.cages[k].sum, 0);
    return { sum, reason: 'unit', unit, cages: restCages.length };
  }
  return null;
}

/**
 * Cases en conflit à cause d'une cage virtuelle visible : les chiffres déjà posés dépassent la somme, ou
 * ne permettent plus de l'atteindre (et, si ses cases se voient toutes, plus aucune combinaison possible).
 */
export function virtualConflictCells(
  puzzle: Puzzle,
  values: readonly number[],
  cages: readonly VirtualCage[],
): Set<number> {
  const result = new Set<number>();
  for (const cage of cages) {
    if (cage.hidden) continue;
    const placed = cage.cells.filter((c) => values[c]);
    if (placed.length === 0) continue;
    const placedSum = placed.reduce((s, c) => s + values[c], 0);
    const free = cage.cells.length - placed.length;
    const rest = cage.sum - placedSum;
    let possible: boolean;
    if (allDistinct(puzzle, cage.cells)) {
      const used = placed.reduce((m, c) => m | digitBit(values[c]), 0);
      possible = free === 0 ? rest === 0 : combinationsFor(free, rest).some((combo) => (combo & used) === 0);
    } else {
      // Des chiffres peuvent se répéter : chaque case libre vaut de 1 à 9.
      possible = rest >= free && rest <= 9 * free;
    }
    if (!possible) placed.forEach((c) => result.add(c));
  }
  return result;
}
