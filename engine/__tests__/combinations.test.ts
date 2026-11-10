import { describe, expect, it } from 'vitest';
import { digitsOf, maskOf } from '../bits';
import { combinationsFor, combinationsWith, maxCageSum, minCageSum, possibleDigits } from '../combinations';

const asLists = (masks: readonly number[]): number[][] => masks.map(digitsOf);

describe('table des combinaisons', () => {
  it('donne les combinaisons uniques classiques', () => {
    expect(asLists(combinationsFor(2, 3))).toEqual([[1, 2]]);
    expect(asLists(combinationsFor(2, 17))).toEqual([[8, 9]]);
    expect(asLists(combinationsFor(3, 6))).toEqual([[1, 2, 3]]);
    expect(asLists(combinationsFor(3, 24))).toEqual([[7, 8, 9]]);
    expect(asLists(combinationsFor(9, 45))).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  });

  it('donne toutes les combinaisons de 10 en 2 cases', () => {
    const lists = asLists(combinationsFor(2, 10)).sort((a, b) => a[0] - b[0]);
    expect(lists).toEqual([
      [1, 9],
      [2, 8],
      [3, 7],
      [4, 6],
    ]);
  });

  it('couvre les 511 ensembles non vides de chiffres', () => {
    let total = 0;
    for (let size = 1; size <= 9; size++) {
      for (let sum = 0; sum <= 45; sum++) total += combinationsFor(size, sum).length;
    }
    expect(total).toBe(511);
  });

  it('connaît les sommes minimales et maximales', () => {
    expect([minCageSum(2), maxCageSum(2)]).toEqual([3, 17]);
    expect([minCageSum(5), maxCageSum(5)]).toEqual([15, 35]);
    expect([minCageSum(9), maxCageSum(9)]).toEqual([45, 45]);
  });

  it('ne renvoie rien pour une somme impossible', () => {
    expect(combinationsFor(2, 18)).toEqual([]);
    expect(combinationsFor(4, 9)).toEqual([]);
    expect(combinationsFor(0, 0)).toEqual([]);
    expect(combinationsFor(10, 45)).toEqual([]);
  });

  it('filtre les chiffres obligatoires et exclus (25 en 4 cases)', () => {
    const all = asLists(combinationsFor(4, 25));
    expect(all.sort()).toEqual(
      [
        [1, 7, 8, 9],
        [2, 6, 8, 9],
        [3, 5, 8, 9],
        [3, 6, 7, 9],
        [4, 5, 7, 9],
        [4, 6, 7, 8],
      ].sort(),
    );
    const with9 = asLists(combinationsWith(4, 25, maskOf([9])));
    expect(with9.every((c) => c.includes(9))).toBe(true);
    expect(asLists(combinationsWith(4, 25, 0, maskOf([9])))).toEqual([[4, 6, 7, 8]]);
    // Sans 8 ni 9, le maximum est 4 + 5 + 6 + 7 = 22 : aucune combinaison.
    expect(combinationsWith(4, 25, 0, maskOf([8, 9]))).toEqual([]);
  });

  it("calcule l'union des chiffres possibles", () => {
    expect(digitsOf(possibleDigits(2, 16))).toEqual([7, 9]);
    expect(digitsOf(possibleDigits(3, 7))).toEqual([1, 2, 4]);
  });
});
