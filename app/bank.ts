/**
 * Banque de grilles embarquée dans l'application : tous les fichiers data/bank-*.json sont inclus au
 * moment de la construction (aucun téléchargement pendant le jeu).
 */
import { parseBank } from '../engine/bank';
import { puzzleFingerprint } from '../engine/generator/fingerprint';
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
 * Lit un fichier de banque complémentaire (section 6.4) : il est vérifié grille par grille. Une grille
 * dont l'identifiant existe déjà, ou identique à une grille connue (à une symétrie près), est écartée :
 * rien n'est jamais remplacé. Renvoie les grilles nouvelles.
 */
export function readExtraBank(raw: unknown, known: readonly PuzzleRecord[] = [...byId.values()]) {
  const bank = parseBank(raw);
  const ids = new Set(known.map((p) => p.id));
  const prints = new Set(known.map(puzzleFingerprint));
  const added: PuzzleRecord[] = [];
  for (const p of bank.puzzles) {
    const print = puzzleFingerprint(p);
    if (ids.has(p.id) || prints.has(print)) continue;
    ids.add(p.id);
    prints.add(print);
    added.push(p);
  }
  return { level: bank.level, added, skipped: bank.puzzles.length - added.length };
}
