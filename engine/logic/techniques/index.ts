import type { LogicContext } from '../context';
import type { LogicState, Step, TechniqueId } from '../types';
import { cageCombination, cageUnitOverlap, crossCageCombinations, parity } from './cages';
import { swordfish, xWing } from './fish';
import { boxLine, pointing } from './intersections';
import { cageComparison, cageSplitting, inniesOutiesMulti, rule45Single } from './rule45';
import { hiddenSingle, nakedSingle } from './singles';
import { hiddenPair, hiddenQuad, hiddenTriple, nakedPair, nakedQuad, nakedTriple } from './subsets';
import { xyzWing, yWing } from './wings';

/** Une technique parcourt l'état et propose toutes les étapes qu'elle sait trouver. */
export type TechniqueFinder = (state: LogicState, ctx: LogicContext) => Iterable<Step>;

/** Registre des techniques programmées. Leur ordre d'essai et leurs points sont dans la configuration. */
export const TECHNIQUES: Record<TechniqueId, TechniqueFinder> = {
  naked_single: nakedSingle,
  hidden_single: hiddenSingle,
  cage_combination: cageCombination,
  rule45_single: rule45Single,
  pointing,
  box_line: boxLine,
  cage_unit_overlap: cageUnitOverlap,
  naked_pair: nakedPair,
  hidden_pair: hiddenPair,
  naked_triple: nakedTriple,
  hidden_triple: hiddenTriple,
  innies_outies_multi: inniesOutiesMulti,
  cage_splitting: cageSplitting,
  cage_comparison: cageComparison,
  parity,
  cross_cage_combinations: crossCageCombinations,
  naked_quad: nakedQuad,
  hidden_quad: hiddenQuad,
  x_wing: xWing,
  y_wing: yWing,
  xyz_wing: xyzWing,
  swordfish,
};
