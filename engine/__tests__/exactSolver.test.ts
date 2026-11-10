import { describe, expect, it } from 'vitest';
import { countSolutions, hasUniqueSolution, solve } from '../exactSolver';
import { cellAt, formatSolution, isSolutionOf, parseSolution, type Puzzle } from '../model';
import { createRng } from '../random';
import { randomSolutionGrid } from '../solutionGrid';
import data from './fixtures/killer-fixtures.json';
import { naiveCountSolutions, randomCages } from './helpers';

/** Une grille où chaque case est une cage d'une case : la solution est forcément unique. */
const singleCellPuzzle = (solution: readonly number[]): Puzzle => ({
  cages: solution.map((digit, cell) => ({ sum: digit, cells: [cell] })),
});

/**
 * Construit une grille avec exactement 2 solutions : un « rectangle mortel ». Quatre cases sur deux
 * lignes voisines et deux colonnes de blocs différents contiennent a, b / b, a. On peut échanger a et b
 * sans casser aucune règle ; chaque paire verticale est dans une cage de somme a + b, inchangée.
 */
function deadlyRectanglePuzzle(): { puzzle: Puzzle; solution: number[] } {
  for (let seed = 1; ; seed++) {
    const solution = randomSolutionGrid(createRng(seed));
    for (let r = 0; r < 8; r++) {
      if (r % 3 === 2) continue; // les deux lignes doivent être dans la même bande de blocs
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
          const [a, b] = [solution[cellAt(r, c1)], solution[cellAt(r, c2)]];
          if (solution[cellAt(r + 1, c1)] !== b || solution[cellAt(r + 1, c2)] !== a) continue;
          const pair = new Set([cellAt(r, c1), cellAt(r + 1, c1), cellAt(r, c2), cellAt(r + 1, c2)]);
          const cages = singleCellPuzzle(solution).cages.filter((cage) => !pair.has(cage.cells[0]));
          cages.push({ sum: a + b, cells: [cellAt(r, c1), cellAt(r + 1, c1)] });
          cages.push({ sum: a + b, cells: [cellAt(r, c2), cellAt(r + 1, c2)] });
          return { puzzle: { cages }, solution };
        }
      }
    }
  }
}

describe('solveur exact : grilles de test', () => {
  for (const fixture of data.fixtures) {
    it(`${fixture.name} : ${fixture.expectedCount === 1 ? 'solution unique' : 'plusieurs solutions'}`, () => {
      const result = countSolutions(fixture);
      expect(result.complete).toBe(true);
      expect(result.count).toBe(fixture.expectedCount);
      for (const s of result.solutions) expect(isSolutionOf(fixture, s)).toBe(true);
      if (fixture.expectedCount === 1) {
        expect(formatSolution(result.solutions[0])).toBe(fixture.solution);
      } else {
        expect(formatSolution(result.solutions[0])).not.toBe(formatSolution(result.solutions[1]));
      }
    });
  }
});

describe('solveur exact : cas construits', () => {
  it('résout une grille dont toutes les cages ont une seule case', () => {
    const solution = randomSolutionGrid(createRng(7));
    const result = countSolutions(singleCellPuzzle(solution));
    expect(result.count).toBe(1);
    expect(result.solutions[0]).toEqual(solution);
  });

  it('trouve exactement 2 solutions à un rectangle mortel', () => {
    const { puzzle, solution } = deadlyRectanglePuzzle();
    const result = countSolutions(puzzle, { limit: 10 });
    expect(result.complete).toBe(true);
    expect(result.count).toBe(2);
    expect(result.solutions.map(formatSolution)).toContain(formatSolution(solution));
    expect(hasUniqueSolution(puzzle)).toBe(false);
  });

  it('trouve 0 solution à une grille impossible (deux chiffres échangés dans une ligne)', () => {
    const solution = randomSolutionGrid(createRng(11));
    [solution[0], solution[5]] = [solution[5], solution[0]];
    const puzzle = singleCellPuzzle(solution);
    expect(countSolutions(puzzle).count).toBe(0);
    expect(solve(puzzle)).toBeNull();
  });

  it('respecte la limite demandée', () => {
    const multi = data.fixtures.find((f) => f.expectedCount === 2);
    expect(multi).toBeDefined();
    if (!multi) return;
    expect(countSolutions(multi, { limit: 1 }).count).toBe(1);
    expect(countSolutions(multi, { limit: 0 }).count).toBe(0);
  });

  it('signale un calcul interrompu par le garde-fou', () => {
    const solution = randomSolutionGrid(createRng(3));
    // Une seule cage par ligne : énormément de solutions, le garde-fou s'arrête avant d'en trouver 2.
    const rows: Puzzle = {
      cages: Array.from({ length: 9 }, (_, r) => ({
        sum: 45,
        cells: [...Array(9).keys()].map((c) => cellAt(r, c)),
      })),
    };
    expect(isSolutionOf(rows, solution)).toBe(true);
    const result = countSolutions(rows, { maxNodes: 1, limit: 2 });
    expect(result.complete).toBe(false);
    expect(() => hasUniqueSolution(rows, 1)).toThrow(/limite/);
  });

  it('refuse une grille mal formée', () => {
    expect(() => countSolutions({ cages: [{ sum: 3, cells: [0, 1] }] })).toThrow(/mal formée/);
  });
});

describe('solveur exact : comparaison avec le solveur témoin', () => {
  it('trouve le même nombre de solutions que le solveur naïf sur 40 grilles aléatoires', () => {
    const rng = createRng(424242);
    let unique = 0;
    for (let i = 0; i < 40; i++) {
      const solution = randomSolutionGrid(rng);
      const puzzle = randomCages(rng, solution, 2, 3);
      const exact = countSolutions(puzzle);
      expect(exact.complete).toBe(true);
      expect(exact.count).toBe(naiveCountSolutions(puzzle));
      if (exact.count === 1) {
        unique++;
        expect(exact.solutions[0]).toEqual(solution);
      }
    }
    expect(unique).toBeGreaterThan(0); // le test couvre bien les deux cas
  });
});

describe('solveur exact : rapidité', () => {
  it('conclut en moins de 2 s sur chacune de 30 grilles à grandes cages (3 à 6 cases)', () => {
    const rng = createRng(99);
    let total = 0;
    for (let i = 0; i < 30; i++) {
      const puzzle = randomCages(rng, randomSolutionGrid(rng), 3, 6);
      const start = performance.now();
      const result = countSolutions(puzzle);
      const elapsed = performance.now() - start;
      total += elapsed;
      expect(result.complete).toBe(true);
      expect(elapsed).toBeLessThan(2000);
    }
    console.info(`Temps moyen du solveur exact (grandes cages) : ${(total / 30).toFixed(1)} ms`);
  });

  it('garde la solution connue des grilles de test uniques', () => {
    for (const f of data.fixtures.filter((x) => x.expectedCount === 1)) {
      expect(solve(f)).toEqual(parseSolution(f.solution));
    }
  });
});
