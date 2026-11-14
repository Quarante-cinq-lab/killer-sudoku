/**
 * Cages virtuelles (évolution E5) : notes du joueur du type « ces cases font X au total ».
 * - Conflits : une cage virtuelle dont les chiffres posés rendent la somme impossible est signalée.
 *   Une cage virtuelle n'est jamais comparée à la solution : c'est une note du joueur.
 */
import { digitBit } from '../../engine/bits';
import { combinationsFor } from '../../engine/combinations';
import type { Puzzle } from '../../engine/model';
import { allDistinct } from './aids';
import type { VirtualCage } from './state';

/** Nombre de couleurs différentes pour les cages virtuelles (ensuite, on reprend la première). */
export const VIRTUAL_COLORS = 6;

/** Couleur d'une cage virtuelle (1 à VIRTUAL_COLORS), toujours la même pour une cage donnée. */
export const virtualColor = (id: number): number => ((id - 1) % VIRTUAL_COLORS) + 1;

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
