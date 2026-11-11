/**
 * Contrôle de la banque livrée (dossier data/) : chaque grille doit avoir une solution unique, se résoudre
 * entièrement par déduction et retrouver le niveau qui lui est attribué (critère de recette de l'étape 3).
 */
import { describe, expect, it } from 'vitest';
import { countSolutions } from '../engine/exactSolver';
import { puzzleFingerprint } from '../engine/generator/fingerprint';
import { LEVELS, parseSolution } from '../engine/model';
import { ratePuzzle } from '../engine/rating';
import { loadBank } from './bank-store';

const banks = LEVELS.map(loadBank);
const all = banks.flatMap((b) => b.puzzles);

describe('banque livrée', () => {
  it('contient des grilles HARD et EXPERT', () => {
    expect(banks.find((b) => b.level === 'HARD')?.puzzles.length).toBeGreaterThanOrEqual(50);
    expect(banks.find((b) => b.level === 'EXPERT')?.puzzles.length).toBeGreaterThanOrEqual(50);
  });

  it('n’a pas de doublon (à une symétrie près)', () => {
    expect(new Set(all.map(puzzleFingerprint)).size).toBe(all.length);
  });

  it.each(all.map((p) => [p.id, p] as const))('%s : unique, résolue par déduction, bien classée', (_, p) => {
    const exact = countSolutions(p);
    expect(exact.complete).toBe(true);
    expect(exact.count).toBe(1);
    expect(exact.solutions[0]).toEqual(parseSolution(p.solution));
    const rating = ratePuzzle(p);
    expect(rating.solved).toBe(true);
    expect(rating.level).toBe(p.level);
    expect(rating.score).toBe(p.score);
    expect(rating.techniques).toEqual(p.techniques);
    expect(rating.entryPoints).toBe(p.entryPoints);
  });
});
