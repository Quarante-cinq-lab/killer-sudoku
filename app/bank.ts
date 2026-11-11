/**
 * Banque de grilles embarquée dans l'application : tous les fichiers data/bank-*.json sont inclus au
 * moment de la construction (aucun téléchargement pendant le jeu).
 */
import { parseBank } from '../engine/bank';
import { LEVELS, parseSolution, type Level, type PuzzleRecord } from '../engine/model';

const files = import.meta.glob<unknown>('../data/bank-*.json', { eager: true, import: 'default' });

export const BANKS: Record<Level, PuzzleRecord[]> = Object.fromEntries(
  LEVELS.map((level) => [level, [] as PuzzleRecord[]]),
) as Record<Level, PuzzleRecord[]>;

for (const raw of Object.values(files)) {
  const bank = parseBank(raw);
  BANKS[bank.level].push(...bank.puzzles);
}

const byId = new Map(Object.values(BANKS).flatMap((list) => list.map((p) => [p.id, p] as const)));
const solutions = new Map<string, number[]>();

export function findPuzzle(id: string): PuzzleRecord | undefined {
  return byId.get(id);
}

export function solutionOf(record: PuzzleRecord): number[] {
  let solution = solutions.get(record.id);
  if (!solution) {
    solution = parseSolution(record.solution);
    solutions.set(record.id, solution);
  }
  return solution;
}
