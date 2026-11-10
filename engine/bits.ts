/**
 * Ensembles de chiffres codés sur 9 bits : le bit 0 vaut le chiffre 1, le bit 8 le chiffre 9.
 * Exemple : {2, 5} = 0b000010010. C'est compact et très rapide à combiner (ET, OU).
 */

/** Tous les chiffres de 1 à 9. */
export const ALL_DIGITS = 0x1ff;

/** Masque d'un seul chiffre (1 à 9). */
export function digitBit(digit: number): number {
  return 1 << (digit - 1);
}

const POPCOUNT_TABLE = new Uint8Array(512);
const SINGLE_DIGIT_TABLE = new Uint8Array(512);
for (let mask = 1; mask < 512; mask++) {
  POPCOUNT_TABLE[mask] = POPCOUNT_TABLE[mask >> 1] + (mask & 1);
}
for (let d = 1; d <= 9; d++) SINGLE_DIGIT_TABLE[digitBit(d)] = d;

/** Nombre de chiffres dans le masque. */
export function popcount(mask: number): number {
  return POPCOUNT_TABLE[mask];
}

/** Le chiffre si le masque n'en contient qu'un, sinon 0. */
export function singleDigit(mask: number): number {
  return SINGLE_DIGIT_TABLE[mask];
}

/** Liste croissante des chiffres du masque. */
export function digitsOf(mask: number): number[] {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & digitBit(d)) digits.push(d);
  return digits;
}

/** Masque à partir d'une liste de chiffres. */
export function maskOf(digits: readonly number[]): number {
  let mask = 0;
  for (const d of digits) mask |= digitBit(d);
  return mask;
}

/** Somme des chiffres du masque. */
export function sumOfMask(mask: number): number {
  let sum = 0;
  for (let d = 1; d <= 9; d++) if (mask & digitBit(d)) sum += d;
  return sum;
}

/** Plus petit chiffre du masque (0 si le masque est vide). */
export function lowestDigit(mask: number): number {
  return mask === 0 ? 0 : 32 - Math.clz32(mask & -mask);
}

/** Plus grand chiffre du masque (0 si le masque est vide). */
export function highestDigit(mask: number): number {
  return 32 - Math.clz32(mask);
}

/** Chiffres impairs et pairs. */
export const ODD_DIGITS = 0b101010101;
export const EVEN_DIGITS = 0b010101010;
