import { popcount, sumOfMask } from './bits';

/**
 * Table de toutes les combinaisons possibles d'une cage : pour une taille (1 à 9) et une somme,
 * la liste des ensembles de chiffres distincts qui conviennent, sous forme de masques.
 * Exemple : taille 2, somme 17 → un seul ensemble, {8, 9}.
 */
const TABLE: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let mask = 1; mask < 512; mask++) {
  TABLE[popcount(mask)][sumOfMask(mask)].push(mask);
}

const EMPTY: readonly number[] = Object.freeze([]);

/** Plus petite somme possible pour une cage de `size` cases (1 + 2 + … + size). */
export function minCageSum(size: number): number {
  return (size * (size + 1)) / 2;
}

/** Plus grande somme possible pour une cage de `size` cases (9 + 8 + …). */
export function maxCageSum(size: number): number {
  return (size * (19 - size)) / 2;
}

/** Combinaisons (masques, par ordre croissant) pour une cage de `size` cases et de somme `sum`. */
export function combinationsFor(size: number, sum: number): readonly number[] {
  if (!Number.isInteger(size) || !Number.isInteger(sum)) return EMPTY;
  if (size < 1 || size > 9 || sum < 0 || sum > 45) return EMPTY;
  return TABLE[size][sum];
}

/** Combinaisons filtrées : contenant tous les chiffres `required` et aucun des chiffres `excluded`. */
export function combinationsWith(size: number, sum: number, required = 0, excluded = 0): number[] {
  return combinationsFor(size, sum).filter((c) => (c & required) === required && (c & excluded) === 0);
}

/** Union des chiffres qui apparaissent dans au moins une combinaison possible. */
export function possibleDigits(size: number, sum: number): number {
  let union = 0;
  for (const c of combinationsFor(size, sum)) union |= c;
  return union;
}
