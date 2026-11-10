import { describe, expect, it } from 'vitest';
import { isSolutionOf } from '../model';
import { createRng, shuffle } from '../random';
import { randomSolutionGrid } from '../solutionGrid';

describe('tirage de grilles complètes', () => {
  it('produit des grilles de sudoku valides', () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      // Sans cage, isSolutionOf ne vérifie que les lignes, colonnes et blocs.
      expect(isSolutionOf({ cages: [] }, randomSolutionGrid(rng))).toBe(true);
    }
  });

  it('donne toujours la même grille avec la même graine, et des grilles différentes sinon', () => {
    expect(randomSolutionGrid(createRng(42))).toEqual(randomSolutionGrid(createRng(42)));
    expect(randomSolutionGrid(createRng(42))).not.toEqual(randomSolutionGrid(createRng(43)));
  });

  it('mélange sans perdre ni dupliquer d’élément', () => {
    const items = shuffle(createRng(1), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...items].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
