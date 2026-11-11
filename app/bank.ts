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

/** Intègre des grilles importées en complément (déjà vérifiées) à la banque en mémoire. */
export function registerExtraPuzzles(records: readonly PuzzleRecord[]): void {
  for (const record of records) {
    if (byId.has(record.id)) continue;
    BANKS[record.level].push(record);
    byId.set(record.id, record);
  }
}

/**
 * Lit un fichier de banque complémentaire (section 6.4) : il est vérifié grille par grille, et une grille
 * dont l'identifiant existe déjà est écartée (jamais remplacée). Renvoie les grilles nouvelles.
 */
export function readExtraBank(raw: unknown, knownIds: ReadonlySet<string> = new Set(byId.keys())) {
  const bank = parseBank(raw);
  const added = bank.puzzles.filter((p) => !knownIds.has(p.id));
  return { level: bank.level, added, skipped: bank.puzzles.length - added.length };
}
