/**
 * Fabrique le jeu de grilles de test du solveur exact : engine/__tests__/fixtures/killer-fixtures.json.
 * Usage : npx tsx scripts/build-test-fixtures.ts
 *
 * Chaque grille est construite à partir d'une solution tirée au hasard (graine fixe), donc on connaît
 * la bonne réponse. Le nombre de solutions de chaque grille est aussi confirmé par le solveur témoin naïf
 * (environ 3 minutes en tout : le solveur naïf est volontairement lent).
 */
import { writeFileSync } from 'node:fs';
import { countSolutions } from '../engine/exactSolver';
import { cageIndexByCell, formatSolution, isSolutionOf, type Cage, type Puzzle } from '../engine/model';
import { createRng, type Rng } from '../engine/random';
import { randomSolutionGrid } from '../engine/solutionGrid';
import { naiveCountSolutions, randomCages } from '../engine/__tests__/helpers';

interface Fixture {
  name: string;
  description: string;
  cages: Cage[];
  solution: string;
  expectedCount: 1 | 2;
  confirmedByNaive: boolean;
}

const fixtures: Fixture[] = [];

function hasSingleCellCage(p: Puzzle): boolean {
  return p.cages.some((c) => c.cells.length === 1);
}

/** Isole dans une cage d'une case une case qui diffère entre deux solutions, jusqu'à l'unicité. */
function peelUntilUnique(rng: Rng, puzzle: Puzzle, solution: number[]): Puzzle {
  let current = puzzle;
  for (;;) {
    const result = countSolutions(current);
    if (result.count === 1) return current;
    const other = result.solutions.find((s) => s.some((d, i) => d !== solution[i])) ?? result.solutions[1];
    const diff = other.map((d, i) => (d !== solution[i] ? i : -1)).filter((i) => i >= 0);
    const cell = diff[Math.floor(rng() * diff.length)];
    const owner = cageIndexByCell(current)[cell];
    const cages = current.cages.flatMap((cage, i) => {
      if (i !== owner) return [cage];
      const rest = cage.cells.filter((c) => c !== cell);
      // Le reste de la cage peut se retrouver coupé en deux : on le redécoupe en morceaux d'un seul tenant.
      return [{ sum: solution[cell], cells: [cell] }, ...splitConnected(rest, solution)];
    });
    current = { cages };
  }
}

function splitConnected(cells: number[], solution: number[]): Cage[] {
  const left = new Set(cells);
  const parts: Cage[] = [];
  while (left.size > 0) {
    const start = left.values().next().value as number;
    const part = [start];
    left.delete(start);
    for (let i = 0; i < part.length; i++) {
      const c = part[i];
      for (const n of [c - 9, c + 9, c % 9 > 0 ? c - 1 : -1, c % 9 < 8 ? c + 1 : -1]) {
        if (left.has(n)) {
          left.delete(n);
          part.push(n);
        }
      }
    }
    part.sort((a, b) => a - b);
    parts.push({ sum: part.reduce((s, c) => s + solution[c], 0), cells: part });
  }
  return parts;
}

function add(name: string, description: string, puzzle: Puzzle, solution: number[], naive: boolean): void {
  if (!isSolutionOf(puzzle, solution)) throw new Error(`${name} : la solution ne respecte pas la grille.`);
  const exact = countSolutions(puzzle);
  if (!exact.complete) throw new Error(`${name} : calcul interrompu.`);
  const expected = exact.count === 1 ? 1 : 2;
  if (naive && naiveCountSolutions(puzzle) !== exact.count)
    throw new Error(`${name} : les deux solveurs divergent.`);
  fixtures.push({
    name,
    description,
    cages: puzzle.cages,
    solution: formatSolution(solution),
    expectedCount: expected,
    confirmedByNaive: naive,
  });
  console.log(`${name} : ${exact.count} solution(s), ${puzzle.cages.length} cages, ${exact.nodes} nœuds`);
}

const rng = createRng(20261111);

// 1. Petites cages (2 à 3 cases), solution unique, confirmées par le solveur naïf.
for (let found = 0; found < 4;) {
  const sol = randomSolutionGrid(rng);
  const p = randomCages(rng, sol, 2, 3);
  if (hasSingleCellCage(p) || countSolutions(p).count !== 1) continue;
  found++;
  add(
    `petites-cages-unique-${found}`,
    'Cages de 2 à 3 cases, aucune case isolée, solution unique.',
    p,
    sol,
    true,
  );
}

// 2. Cages de 2 à 4 cases sans case isolée, solution unique (rares au hasard : on en tire beaucoup).
for (let found = 0; found < 3;) {
  const sol = randomSolutionGrid(rng);
  const p = randomCages(rng, sol, 2, 4);
  if (hasSingleCellCage(p) || countSolutions(p).count !== 1) continue;
  found++;
  add(
    `cages-moyennes-unique-${found}`,
    'Cages de 2 à 4 cases, aucune case isolée, solution unique.',
    p,
    sol,
    true,
  );
}

// 3. Grandes cages (2 à 6 cases), rendues uniques en isolant quelques cases.
for (let i = 1; i <= 4; i++) {
  const sol = randomSolutionGrid(rng);
  const p = peelUntilUnique(rng, randomCages(rng, sol, 3, 6), sol);
  add(
    `grandes-cages-unique-${i}`,
    'Cages de 3 à 6 cases, quelques cases isolées pour obtenir l’unicité.',
    p,
    sol,
    true,
  );
}

// 4. Grilles à solutions multiples.
for (let found = 0; found < 2;) {
  const sol = randomSolutionGrid(rng);
  const p = randomCages(rng, sol, 2, 3);
  if (countSolutions(p).count < 2) continue;
  found++;
  add(`petites-cages-multiples-${found}`, 'Cages de 2 à 3 cases, plusieurs solutions.', p, sol, true);
}
for (let found = 0; found < 3;) {
  const sol = randomSolutionGrid(rng);
  const p = randomCages(rng, sol, 3, 6);
  if (hasSingleCellCage(p) || countSolutions(p).count < 2) continue;
  found++;
  add(`grandes-cages-multiples-${found}`, 'Cages de 3 à 6 cases, plusieurs solutions.', p, sol, true);
}

const target = new URL('../engine/__tests__/fixtures/killer-fixtures.json', import.meta.url);
writeFileSync(target, JSON.stringify({ seed: 20261111, fixtures }, null, 1) + '\n');
console.log(`${fixtures.length} grilles écrites.`);
