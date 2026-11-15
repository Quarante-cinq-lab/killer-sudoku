/**
 * Banque de grilles embarquée dans l'application : tous les fichiers data/bank-*.json sont inclus au
 * moment de la construction (aucun téléchargement pendant le jeu).
 */
import { parseBank } from '../engine/bank';
import { hasUniqueSolution } from '../engine/exactSolver';
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
/** Grilles livrées avec l'application, sans les grilles importées (qui s'ajoutent ensuite à byId). */
const official: readonly PuzzleRecord[] = [...byId.values()];
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

/** Début de l'identifiant d'une grille importée dont le numéro était déjà pris (« IMP-HRD-0051 »). */
export const IMPORT_PREFIX = 'IMP-';

/** Premier identifiant libre pour une grille importée dont le numéro est déjà pris par une autre grille. */
function freeId(id: string, taken: ReadonlySet<string>): string {
  let candidate = `${IMPORT_PREFIX}${id}`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${IMPORT_PREFIX}${n}-${id}`;
  return candidate;
}

/** Même grille, case pour case : mêmes cages et même solution. */
const sameGrid = (a: PuzzleRecord, b: PuzzleRecord): boolean =>
  a.solution === b.solution && JSON.stringify(a.cages) === JSON.stringify(b.cages);

/**
 * Grilles importées dont l'identifiant est maintenant pris par une autre grille livrée avec l'application
 * (une mise à jour de la banque a pu réutiliser le même numéro). Sans correction, la partie et l'historique
 * de la grille importée se retrouveraient rattachés à la grille livrée. Renvoie, pour chacune, l'ancien
 * identifiant et un nouvel identifiant libre (« IMP-HRD-0051 ») : la grille importée et tout ce qui s'y
 * rapporte changent d'identifiant, la grille livrée garde le sien.
 */
export function conflictingIds(
  extras: readonly PuzzleRecord[],
  shipped: readonly PuzzleRecord[] = official,
): Map<string, string> {
  const shippedById = new Map(shipped.map((p) => [p.id, p] as const));
  const taken = new Set([...shippedById.keys(), ...extras.map((p) => p.id)]);
  const renames = new Map<string, string>();
  for (const p of extras) {
    const other = shippedById.get(p.id);
    if (!other || sameGrid(other, p)) continue;
    const id = freeId(p.id, taken);
    taken.add(id);
    renames.set(p.id, id);
  }
  return renames;
}

/** Vrai si la grille n'a qu'une solution. Une grille trop longue à vérifier est refusée par prudence. */
function isUnique(record: PuzzleRecord): boolean {
  try {
    return hasUniqueSolution(record);
  } catch {
    return false;
  }
}

/**
 * Lit un fichier de banque complémentaire (section 6.4) : il est vérifié grille par grille.
 * - Une grille identique à une grille connue (à une symétrie près) est écartée : rien n'est jamais remplacé.
 * - Une grille qui a plusieurs solutions est refusée : en mode erreurs, un chiffre juste pour une autre
 *   solution serait compté comme une erreur.
 * - Une grille nouvelle dont le numéro est déjà pris par une autre grille reçoit un identifiant libre
 *   (« IMP-HRD-0051 »), au lieu d'être perdue.
 * Renvoie les grilles nouvelles.
 */
export function readExtraBank(raw: unknown, known: readonly PuzzleRecord[] = [...byId.values()]) {
  const bank = parseBank(raw);
  const ids = new Set(known.map((p) => p.id));
  const prints = new Set(known.map(puzzleFingerprint));
  const added: PuzzleRecord[] = [];
  let skipped = 0;
  let rejected = 0;
  for (const p of bank.puzzles) {
    const print = puzzleFingerprint(p);
    if (prints.has(print)) {
      skipped++;
      continue;
    }
    if (!isUnique(p)) {
      rejected++;
      continue;
    }
    const id = ids.has(p.id) ? freeId(p.id, ids) : p.id;
    ids.add(id);
    prints.add(print);
    added.push(id === p.id ? p : { ...p, id });
  }
  return { level: bank.level, added, skipped, rejected };
}
