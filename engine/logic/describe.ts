import { TEXTS } from '../../texts/fr';
import { digitsOf } from '../bits';
import { cageAnchor, colOf, rowOf } from '../model';
import type { LogicContext } from './context';
import type { Region, Step } from './types';

/**
 * Met une étape en phrase, par exemple :
 * « Règle des 45 — bloc 1 (somme 8) : L3C3 = 8 ».
 * Les mots viennent du fichier de textes ; ici, on ne fait que les assembler.
 */
const T = TEXTS.trace;

export function cellName(cell: number): string {
  return T.cell(rowOf(cell) + 1, colOf(cell) + 1);
}

export function unitName(unit: number): string {
  if (unit < 9) return T.row(unit + 1);
  if (unit < 18) return T.col(unit - 8);
  return T.box(unit - 17);
}

export function regionName(region: Region): string {
  if (region.kind === 'box') return T.box(region.from + 1);
  if (region.kind === 'rows') return T.rows(region.from + 1, region.to + 1);
  return T.cols(region.from + 1, region.to + 1);
}

const digitsText = (mask: number): string => digitsOf(mask).join(', ');
const comboText = (mask: number): string => digitsOf(mask).join('+');

/** Où se passe le raisonnement. */
export function describeWhere(step: Step, ctx: LogicContext): string {
  const parts: string[] = [];
  if (step.region) {
    let text = regionName(step.region);
    if (step.value !== undefined && step.technique === 'cage_splitting') {
      text += ` (${T.sum(step.value)})`;
    } else if (step.value !== undefined && step.cells.length > 1) {
      // Égalité complète, par exemple « L1C9 + L2C4 − L3C1 = -7 ».
      const minus = new Set(step.minus ?? []);
      const plus = step.cells.filter((cell) => !minus.has(cell)).map(cellName);
      text += `, ${T.equation(plus, [...minus].map(cellName), step.value)}`;
    }
    parts.push(text);
  }
  for (const k of step.cages) {
    const cage = ctx.cages[k];
    parts.push(T.cage(cage.sum, cellName(cageAnchor(cage))));
  }
  if (!step.region) for (const unit of step.units) parts.push(unitName(unit));
  if (parts.length === 0) parts.push(step.cells.map(cellName).join(', '));
  return parts.join(T.and);
}

/**
 * Zone de l'étape, sans en dévoiler le détail (1er niveau de l'indice) : par exemple « bloc 5 »,
 * « lignes 1 à 3 » ou « cage 17 en L1C1 ».
 */
export function describeZone(step: Step, ctx: LogicContext): string {
  if (step.region) return regionName(step.region);
  const parts = step.units.map(unitName);
  for (const k of step.cages) parts.push(T.cage(ctx.cages[k].sum, cellName(cageAnchor(ctx.cages[k]))));
  if (parts.length === 0) parts.push(step.cells.map(cellName).join(', '));
  return parts.join(T.and);
}

/** Ce que l'étape change (chiffres posés, candidats retirés). */
export function describeEffect(step: Step): string {
  const parts = [
    ...step.placements.map((p) => T.placement(cellName(p.cell), p.digit)),
    ...step.eliminations.map((e) => T.elimination(cellName(e.cell), digitsText(e.digits))),
  ];
  let text = parts.join(' ; ');
  if (step.combos && step.combos.length > 0) text += ` (${T.combos(step.combos.map(comboText).join(', '))})`;
  return text;
}

export function describeStep(step: Step, ctx: LogicContext): { name: string; where: string; effect: string } {
  return {
    name: TEXTS.techniques[step.technique],
    where: describeWhere(step, ctx),
    effect: describeEffect(step),
  };
}
