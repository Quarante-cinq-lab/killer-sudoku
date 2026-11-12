/**
 * Mode Somme (évolution E4) : on sélectionne des cages entières (et, si on veut, des cases isolées déjà
 * remplies) et l'on obtient le total de leurs sommes. Si la sélection contient une ou plusieurs lignes,
 * colonnes ou blocs complets, on donne aussi la règle des 45 : la somme des cases qui dépassent.
 */
import { rule45Regions } from '../../engine/logic/context';
import type { Region } from '../../engine/logic/types';
import { cageIndexByCell, type Puzzle } from '../../engine/model';

export interface SumSelection {
  /** Indices des cages sélectionnées entièrement. */
  cages: number[];
  /** Cases isolées déjà remplies (leur chiffre s'ajoute au total). */
  cells: number[];
}

export const emptySelection = (): SumSelection => ({ cages: [], cells: [] });

export interface SumInfo {
  total: number;
  cageCount: number;
  /** Toutes les cases sélectionnées (cages et cases isolées). */
  cells: number[];
  /** Règle des 45 : la plus grande zone complète contenue dans la sélection, et ce qui dépasse. */
  rule45: { region: Region; units: number; outside: number[]; outsideSum: number } | null;
}

/**
 * Toucher une case en mode Somme : en mode « cages », sa cage entière est ajoutée ou retirée ; en mode
 * « cases », une case déjà remplie est ajoutée ou retirée seule (une case vide n'apporte rien au total).
 */
export function toggleInSelection(
  puzzle: Puzzle,
  values: readonly number[],
  selection: SumSelection,
  cell: number,
  kind: 'cages' | 'cases',
): SumSelection {
  if (kind === 'cages') {
    const cage = cageIndexByCell(puzzle)[cell];
    const cages = selection.cages.includes(cage)
      ? selection.cages.filter((c) => c !== cage)
      : [...selection.cages, cage];
    // Une case isolée qui appartient à une cage désormais entière fait double emploi : on la retire.
    const covered = new Set(cages.flatMap((k) => puzzle.cages[k].cells));
    return { cages, cells: selection.cells.filter((c) => !covered.has(c)) };
  }
  if (!values[cell]) return selection;
  const inCage = selection.cages.some((k) => puzzle.cages[k].cells.includes(cell));
  if (inCage) return selection;
  const cells = selection.cells.includes(cell)
    ? selection.cells.filter((c) => c !== cell)
    : [...selection.cells, cell];
  return { ...selection, cells };
}

export function sumInfo(puzzle: Puzzle, values: readonly number[], selection: SumSelection): SumInfo {
  const cageCells = selection.cages.flatMap((k) => puzzle.cages[k].cells);
  const cells = [...cageCells, ...selection.cells];
  const total =
    selection.cages.reduce((s, k) => s + puzzle.cages[k].sum, 0) +
    selection.cells.reduce((s, c) => s + values[c], 0);
  const inside = new Set(cells);
  let best: SumInfo['rule45'] = null;
  for (const { region, cells: zone, units } of rule45Regions()) {
    if (!zone.every((c) => inside.has(c))) continue;
    if (best && zone.length <= 9 * best.units) continue;
    const zoneSet = new Set(zone);
    const outside = cells.filter((c) => !zoneSet.has(c));
    best = { region, units, outside, outsideSum: total - 45 * units };
  }
  return { total, cageCount: selection.cages.length, cells, rule45: best };
}
