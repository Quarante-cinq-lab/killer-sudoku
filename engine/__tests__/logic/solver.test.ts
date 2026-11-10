import { describe, expect, it } from 'vitest';
import { digitBit, maskOf } from '../../bits';
import { countSolutions } from '../../exactSolver';
import { createContext } from '../../logic/context';
import { cellName, describeStep, regionName, unitName } from '../../logic/describe';
import { enumerateSum } from '../../logic/enumerate';
import { entryPoints, nextStep, solveLogically } from '../../logic/solver';
import { parseSolution, type Puzzle } from '../../model';
import { createRng } from '../../random';
import { randomSolutionGrid } from '../../solutionGrid';
import data from '../fixtures/killer-fixtures.json';
import { randomCages } from '../helpers';
import { blankState, contextWith, setCands, setupOnS } from './helpers';

/** Vérifie qu'aucune étape ne contredit la solution connue. Renvoie le nombre d'étapes fautives. */
function wrongSteps(puzzle: Puzzle, solution: readonly number[]): number {
  const result = solveLogically(createContext(puzzle));
  let wrong = 0;
  for (const step of result.steps) {
    for (const p of step.placements) if (solution[p.cell] !== p.digit) wrong++;
    for (const e of step.eliminations) if (e.digits & digitBit(solution[e.cell])) wrong++;
  }
  if (result.solved && result.state.value.some((v, i) => v !== solution[i])) wrong++;
  return wrong;
}

describe('énumération des sommes', () => {
  it('liste les possibilités d’une cage', () => {
    const ctx = contextWith([{ sum: 10, cells: [0, 1] }]);
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 1, [7, 8, 9]);
    const result = enumerateSum(state, ctx, [0, 1], [1, 1], 10, { allDistinct: true });
    expect(result?.possible).toEqual([maskOf([1, 2, 3]), maskOf([7, 8, 9])]);
    expect(result?.sets).toHaveLength(3);
  });

  it('gère une différence (coefficient −1) et les chiffres obligatoires', () => {
    const ctx = contextWith();
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 80, [1, 2, 3, 4, 5]);
    const diff = enumerateSum(state, ctx, [0, 80], [1, -1], -2); // L9C9 = L1C1 + 2
    expect(diff?.possible).toEqual([maskOf([1, 2, 3]), maskOf([3, 4, 5])]);
    const withThree = enumerateSum(state, ctx, [0, 80], [1, 1], 5, { required: digitBit(3) });
    expect(withThree?.possible).toEqual([maskOf([2, 3]), maskOf([2, 3])]);
  });

  it('renvoie null quand la somme est impossible', () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [1, 2]);
    expect(enumerateSum(state, contextWith(), [0, 1], [1, 1], 10)).toBeNull();
  });
});

describe('solveur logique', () => {
  it('choisit toujours la technique la plus simple', () => {
    const state = blankState();
    setCands(state, 40, [7]);
    const ctx = contextWith();
    expect(nextStep(state, ctx)?.technique).toBe('naked_single');
  });

  it('ne contredit jamais la solution des grilles de test', () => {
    for (const f of data.fixtures.filter((x) => x.expectedCount === 1)) {
      expect(wrongSteps(f, parseSolution(f.solution)), f.name).toBe(0);
    }
  });

  it('résout par déduction les grilles de test uniques, sauf une qui dépasse les groupes A et B', () => {
    // « cages-moyennes-unique-3 » demande des techniques plus avancées (groupes C/D, plus tard) :
    // le solveur doit s'y arrêter proprement, sans contradiction.
    for (const f of data.fixtures.filter((x) => x.expectedCount === 1)) {
      const result = solveLogically(createContext(f));
      expect(result.contradiction, f.name).toBe(false);
      expect(result.solved, f.name).toBe(f.name !== 'cages-moyennes-unique-3');
    }
  });

  it('ne contredit jamais la solution sur 15 grilles aléatoires sans case isolée', () => {
    const rng = createRng(2026);
    let checked = 0;
    while (checked < 15) {
      const solution = randomSolutionGrid(rng);
      const puzzle = randomCages(rng, solution, 2, 4);
      if (puzzle.cages.some((c) => c.cells.length === 1) || countSolutions(puzzle).count !== 1) continue;
      checked++;
      expect(wrongSteps(puzzle, solution)).toBe(0);
    }
  });

  it('s’arrête sans se tromper sur une grille à plusieurs solutions', () => {
    const multi = data.fixtures.find((f) => f.expectedCount === 2);
    expect(multi).toBeDefined();
    if (!multi) return;
    const result = solveLogically(createContext(multi));
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
  });

  it('compte les points d’entrée', () => {
    const { ctx } = setupOnS([
      [0, 1],
      [2, 11],
      [9, 10],
      [18, 19],
      [20, 21],
    ]);
    expect(entryPoints(ctx)).toBeGreaterThan(0);
    expect(entryPoints(ctx)).toBe(entryPoints(ctx));
  });
});

describe('trace lisible', () => {
  it('nomme les cases, les unités et les zones comme un joueur', () => {
    expect(cellName(0)).toBe('L1C1');
    expect(cellName(80)).toBe('L9C9');
    expect(unitName(4)).toBe('ligne 5');
    expect(unitName(9)).toBe('colonne 1');
    expect(unitName(26)).toBe('bloc 9');
    expect(regionName({ kind: 'rows', from: 0, to: 2 })).toBe('lignes 1 à 3');
    expect(regionName({ kind: 'box', from: 4, to: 4 })).toBe('bloc 5');
  });

  it('décrit une étape de la règle des 45', () => {
    const { ctx, state } = setupOnS([
      [0, 1],
      [2, 11],
      [9, 10],
      [18, 19],
      [20, 21],
    ]);
    const step = nextStep(state, ctx);
    expect(step).not.toBeNull();
    if (!step) return;
    const text = describeStep(step, ctx);
    expect(text.name).toBeTruthy();
    expect(text.effect).toMatch(/^L\dC\d (=|≠)/);
  });

  it('écrit chaque étape d’une grille de test en français', () => {
    const fixture = data.fixtures[5];
    const ctx = createContext(fixture);
    const result = solveLogically(ctx);
    for (const step of result.steps) {
      const { name, where, effect } = describeStep(step, ctx);
      expect(name.length).toBeGreaterThan(0);
      expect(where).not.toMatch(/undefined|NaN/);
      expect(effect).toMatch(/L\dC\d/);
    }
  });
});
