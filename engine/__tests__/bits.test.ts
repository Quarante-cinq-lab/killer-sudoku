import { describe, expect, it } from 'vitest';
import { ALL_DIGITS, digitBit, digitsOf, maskOf, popcount, singleDigit, sumOfMask } from '../bits';

describe('ensembles de chiffres sur 9 bits', () => {
  it('code chaque chiffre sur son bit', () => {
    expect(digitBit(1)).toBe(0b1);
    expect(digitBit(9)).toBe(0b100000000);
    expect(maskOf([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(ALL_DIGITS);
  });

  it('compte, liste et additionne les chiffres', () => {
    const mask = maskOf([2, 5, 9]);
    expect(popcount(mask)).toBe(3);
    expect(digitsOf(mask)).toEqual([2, 5, 9]);
    expect(sumOfMask(mask)).toBe(16);
    expect(popcount(0)).toBe(0);
    expect(popcount(ALL_DIGITS)).toBe(9);
  });

  it("reconnaît un ensemble d'un seul chiffre", () => {
    for (let d = 1; d <= 9; d++) expect(singleDigit(digitBit(d))).toBe(d);
    expect(singleDigit(0)).toBe(0);
    expect(singleDigit(maskOf([3, 4]))).toBe(0);
  });
});
