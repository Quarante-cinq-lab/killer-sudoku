/**
 * Types du solveur logique : l'état des candidats et le format d'une étape de raisonnement.
 * Une étape est une donnée pure (aucun texte) : l'interface et les scripts la mettent en phrases
 * grâce au fichier de textes.
 */

/** Identifiants des techniques, dans l'esprit de la section 5.1 du cahier des charges. */
export const TECHNIQUE_IDS = [
  // Groupe A – Base
  'naked_single',
  'hidden_single',
  'cage_combination',
  'rule45_single',
  'pointing',
  'box_line',
  'cage_unit_overlap',
  'naked_pair',
  'hidden_pair',
  'naked_triple',
  'hidden_triple',
  // Groupe B – Avancé
  'innies_outies_multi',
  'cage_splitting',
  'cage_comparison',
  'parity',
  'cross_cage_combinations',
  'naked_quad',
  'hidden_quad',
  'x_wing',
  'y_wing',
  'xyz_wing',
  'swordfish',
] as const;

export type TechniqueId = (typeof TECHNIQUE_IDS)[number];
export type Group = 'A' | 'B' | 'C' | 'D';
export const GROUPS: readonly Group[] = ['A', 'B', 'C', 'D'];

export interface Placement {
  cell: number;
  digit: number;
}

/** Chiffres retirés des candidats d'une case (masque sur 9 bits). */
export interface Elimination {
  cell: number;
  digits: number;
}

/** Zone utilisée par la règle des 45 : une bande de lignes, de colonnes, ou un bloc (indices de 0 à 8). */
export interface Region {
  kind: 'rows' | 'cols' | 'box';
  from: number;
  to: number;
}

export interface Step {
  technique: TechniqueId;
  /** Chiffres posés. */
  placements: Placement[];
  /** Candidats retirés. */
  eliminations: Elimination[];
  /** Cases qui forment le raisonnement (à mettre en évidence pour un indice). */
  cells: number[];
  /** Chiffres concernés (masque). */
  digits: number;
  /** Unités concernées : lignes 0 à 8, colonnes 9 à 17, blocs 18 à 26. */
  units: number[];
  /** Cages concernées (indices dans la liste des cages). */
  cages: number[];
  /** Zone de la règle des 45. */
  region?: Region;
  /** Somme utilisée (règle des 45, découpage de cage). */
  value?: number;
  /** Règle des 45 : cases comptées en moins dans l'égalité (les autres cases de `cells` comptent en plus). */
  minus?: number[];
  /** Combinaisons encore possibles (masques), pour les techniques de cage. */
  combos?: number[];
}

/** État du solveur : candidats de chaque case et chiffres posés (0 = case vide). */
export interface LogicState {
  cand: Uint16Array;
  value: Uint8Array;
}
