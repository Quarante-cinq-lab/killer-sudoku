import { describe, expect, it } from 'vitest';
import { digitBit } from '../bits';
import { DIFFICULTY_CONFIG, parseDifficultyConfig } from '../difficulty';
import { countSolutions } from '../exactSolver';
import { growCages, partitionCells, pickSize, respectsLimits } from '../generator/cages';
import { puzzleFingerprint, transformPuzzle } from '../generator/fingerprint';
import { cageLimits, generateCandidate, isLevelReachable } from '../generator/generate';
import { connectedParts, makeUnique, resplit } from '../generator/repair';
import { isConnected, isSolutionOf, parseSolution, validatePuzzle, type Puzzle } from '../model';
import { createRng } from '../random';
import { randomSolutionGrid } from '../solutionGrid';
import rawConfig from '../difficulty.config.json';
import data from './fixtures/killer-fixtures.json';

const ALL = Array.from({ length: 81 }, (_, i) => i);
const expertProfile = DIFFICULTY_CONFIG.generation.EXPERT;
const expertLimits = cageLimits('EXPERT');

function noRepeatedDigit(cells: readonly number[], solution: readonly number[]): boolean {
  let used = 0;
  for (const c of cells) {
    if (used & digitBit(solution[c])) return false;
    used |= digitBit(solution[c]);
  }
  return true;
}

describe('découpage en cages', () => {
  it('tire les tailles selon les poids (une taille de poids nul ne sort jamais)', () => {
    const rng = createRng(1);
    const drawn = new Set(
      Array.from({ length: 500 }, () =>
        pickSize(rng, [
          [2, 1],
          [3, 0],
          [4, 3],
        ]),
      ),
    );
    expect([...drawn].sort()).toEqual([2, 4]);
  });

  it('couvre chaque case une seule fois, avec des cages d’un seul tenant sans chiffre répété', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      const solution = randomSolutionGrid(rng);
      const parts = partitionCells(rng, ALL, solution, expertProfile.cageSizes, 6);
      expect(parts.flat().sort((a, b) => a - b)).toEqual(ALL);
      for (const part of parts) {
        expect(isConnected(part)).toBe(true);
        expect(noRepeatedDigit(part, solution)).toBe(true);
        expect(part.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('respecte le profil du niveau : aucune cage d’une case en EXPERT, au plus 2 en HARD', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      const solution = randomSolutionGrid(rng);
      const expert = growCages(rng, solution, expertProfile.cageSizes, expertLimits);
      expect(expert).not.toBeNull();
      if (!expert) continue;
      expect(expert.every((c) => c.cells.length >= 2 && c.cells.length <= 6)).toBe(true);
      expect(validatePuzzle({ cages: expert })).toEqual([]);
      expect(isSolutionOf({ cages: expert }, solution)).toBe(true);
      const hard = growCages(rng, solution, DIFFICULTY_CONFIG.generation.HARD.cageSizes, cageLimits('HARD'));
      expect(hard?.filter((c) => c.cells.length === 1).length ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it('vérifie les limites de forme', () => {
    const limits = { minSize: 2, maxSize: 3, maxSingleCell: 0 };
    expect(respectsLimits([{ cells: [0, 1] }, { cells: [2, 3, 4] }], limits)).toBe(true);
    expect(respectsLimits([{ cells: [0] }], limits)).toBe(false);
    expect(respectsLimits([{ cells: [0, 1, 2, 3] }], limits)).toBe(false);
    expect(
      respectsLimits([{ cells: [0] }, { cells: [1] }], { ...limits, minSize: 1, maxSingleCell: 1 }),
    ).toBe(false);
  });
});

describe('réparation de l’unicité', () => {
  const multiples = data.fixtures.filter((f) => f.expectedCount === 2);

  it('sépare des cases en groupes d’un seul tenant', () => {
    expect(connectedParts([0, 1, 3, 12, 80]).map((p) => p.sort((a, b) => a - b))).toEqual([
      [0, 1],
      [3, 12],
      [80],
    ]);
  });

  it('un redécoupage exclut la deuxième solution trouvée', () => {
    for (const fixture of multiples) {
      const puzzle: Puzzle = { cages: fixture.cages };
      const solution = parseSolution(fixture.solution);
      const result = countSolutions(puzzle);
      const other = result.solutions.find((s) => s.some((d, i) => d !== solution[i]));
      expect(other).toBeDefined();
      if (!other) continue;
      const limits = { minSize: 1, maxSize: 6, maxSingleCell: 81 };
      const next = resplit(createRng(3), puzzle, solution, other, {
        weights: expertProfile.cageSizes,
        limits,
        maxRepairs: 1,
      });
      expect(next).not.toBeNull();
      if (!next) continue;
      expect(isSolutionOf(next, solution)).toBe(true);
      expect(isSolutionOf(next, other)).toBe(false);
    }
  });

  it('rend unique une grille à solutions multiples, en gardant la solution de départ', () => {
    for (const fixture of multiples) {
      const solution = parseSolution(fixture.solution);
      const limits = { minSize: 2, maxSize: 6, maxSingleCell: 0 };
      // Les grilles de test peuvent contenir des cages d'une case : on tolère celles qui existent déjà.
      const singles = fixture.cages.filter((c) => c.cells.length === 1).length;
      const result = makeUnique(createRng(5), { cages: fixture.cages }, solution, {
        weights: expertProfile.cageSizes,
        limits: { ...limits, minSize: singles ? 1 : 2, maxSingleCell: singles },
        maxRepairs: 40,
      });
      expect(result.failure).toBeNull();
      expect(result.repairs).toBeGreaterThan(0);
      if (!result.puzzle) continue;
      expect(countSolutions(result.puzzle).count).toBe(1);
      expect(isSolutionOf(result.puzzle, solution)).toBe(true);
      expect(validatePuzzle(result.puzzle)).toEqual([]);
    }
  });

  it('ne touche pas à une grille déjà unique', () => {
    const fixture = data.fixtures.find((f) => f.expectedCount === 1);
    if (!fixture) throw new Error('grille de test manquante');
    const puzzle = { cages: fixture.cages };
    const result = makeUnique(createRng(1), puzzle, parseSolution(fixture.solution), {
      weights: expertProfile.cageSizes,
      limits: { minSize: 1, maxSize: 6, maxSingleCell: 81 },
      maxRepairs: 10,
    });
    expect(result).toEqual({ puzzle, repairs: 0, failure: null });
  });
});

describe('empreinte de dédoublonnage', () => {
  const puzzle: Puzzle = { cages: data.fixtures[0].cages };

  it('est la même pour les 8 rotations et symétries d’une grille', () => {
    const fingerprint = puzzleFingerprint(puzzle);
    for (let s = 0; s < 8; s++) {
      const transformed = transformPuzzle(puzzle, s);
      expect(validatePuzzle(transformed)).toEqual([]);
      expect(puzzleFingerprint(transformed)).toBe(fingerprint);
    }
  });

  it('ne dépend pas de l’ordre des cages', () => {
    expect(puzzleFingerprint({ cages: [...puzzle.cages].reverse() })).toBe(puzzleFingerprint(puzzle));
  });

  it('diffère pour des grilles différentes', () => {
    const prints = new Set(data.fixtures.map((f) => puzzleFingerprint({ cages: f.cages })));
    expect(prints.size).toBe(data.fixtures.length);
  });
});

describe('grille candidate', () => {
  it('donne toujours le même résultat avec la même graine', () => {
    expect(generateCandidate(42, 'EXPERT')).toEqual(generateCandidate(42, 'EXPERT'));
  });

  it('une grille retenue est unique, résolue par déduction et classée', () => {
    let accepted = 0;
    for (let seed = 1; accepted < 3 && seed < 40; seed++) {
      const candidate = generateCandidate(seed, 'HARD');
      if (!candidate.level || !candidate.puzzle || !candidate.rating) continue;
      accepted++;
      expect(candidate.rejection).toBeNull();
      expect(candidate.rating.solved).toBe(true);
      expect(countSolutions(candidate.puzzle).count).toBe(1);
      expect(isSolutionOf(candidate.puzzle, candidate.solution)).toBe(true);
    }
    expect(accepted).toBe(3);
  });

  it('indique les niveaux que le moteur sait produire', () => {
    expect(isLevelReachable('HARD')).toBe(true);
    expect(isLevelReachable('EXPERT')).toBe(true);
    // Les groupes C et D sont programmés : tous les niveaux sont accessibles.
    expect(isLevelReachable('DIABOLIQUE')).toBe(true);
    expect(isLevelReachable('ULTIME')).toBe(true);
  });

  it('refuse un profil de génération mal formé', () => {
    const bad = structuredClone(rawConfig) as { generation: { HARD: { cageSizes: Record<string, number> } } };
    bad.generation.HARD.cageSizes = { '9': 1 };
    expect(() => parseDifficultyConfig(bad)).toThrow(/generation.HARD/);
  });
});
