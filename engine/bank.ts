import {
  formatSolution,
  LEVELS,
  parsePuzzleRecord,
  type Level,
  type Puzzle,
  type PuzzleRecord,
} from './model';
import { ENGINE_VERSION } from './version';
import { puzzleFingerprint } from './generator/fingerprint';
import type { Rating } from './rating';

/** Banque de grilles d'un niveau : un fichier JSON par niveau (dossier data/). */
export interface Bank {
  version: 1;
  level: Level;
  puzzles: PuzzleRecord[];
}

/** Préfixe des identifiants de chaque niveau (HRD-0001, EXP-0001…). */
export const ID_PREFIX: Record<Level, string> = {
  HARD: 'HRD',
  EXPERT: 'EXP',
  DIABOLIQUE: 'DIA',
  EXTREME: 'EXT',
  ULTIME: 'ULT',
};

export function puzzleId(level: Level, number: number): string {
  return `${ID_PREFIX[level]}-${String(number).padStart(4, '0')}`;
}

export function emptyBank(level: Level): Bank {
  return { version: 1, level, puzzles: [] };
}

/** Numéro à donner à la prochaine grille : on ne réutilise jamais un numéro, même supprimé ensuite. */
export function nextNumber(bank: Bank): number {
  return bank.puzzles.reduce((max, p) => Math.max(max, p.number), 0) + 1;
}

/** Lit et vérifie un fichier de banque : format, niveau, identifiants et numéros uniques. */
export function parseBank(data: unknown): Bank {
  const o = data as Record<string, unknown> | null;
  if (typeof o !== 'object' || o === null) throw new Error('Banque : objet attendu.');
  if (o.version !== 1) throw new Error('Banque : version de format inconnue.');
  const level = o.level as Level;
  if (!LEVELS.includes(level)) throw new Error(`Banque : niveau inconnu « ${String(o.level)} ».`);
  if (!Array.isArray(o.puzzles)) throw new Error('Banque : liste « puzzles » manquante.');
  const puzzles = o.puzzles.map(parsePuzzleRecord);
  const ids = new Set<string>();
  for (const p of puzzles) {
    if (p.level !== level) throw new Error(`Banque ${level} : la grille ${p.id} est de niveau ${p.level}.`);
    if (p.id !== puzzleId(level, p.number))
      throw new Error(`Banque ${level} : identifiant ${p.id} incohérent avec le numéro ${p.number}.`);
    if (ids.has(p.id)) throw new Error(`Banque ${level} : identifiant ${p.id} en double.`);
    ids.add(p.id);
  }
  return { version: 1, level, puzzles };
}

/** Fabrique l'enregistrement d'une grille au format de la section 6.3. */
export function makeRecord(
  level: Level,
  number: number,
  puzzle: Puzzle,
  solution: readonly number[],
  rating: Pick<Rating, 'score' | 'techniques' | 'entryPoints'>,
  createdAt: string,
): PuzzleRecord {
  return {
    id: puzzleId(level, number),
    level,
    number,
    score: rating.score,
    techniques: rating.techniques,
    entryPoints: rating.entryPoints,
    cages: puzzle.cages.map((c) => ({ sum: c.sum, cells: [...c.cells] })),
    solution: formatSolution(solution),
    engineVersion: ENGINE_VERSION,
    createdAt,
  };
}

/**
 * Ajoute une grille à la banque, sans jamais toucher aux grilles existantes. Renvoie la grille ajoutée,
 * ou null si une grille équivalente (même empreinte, à une symétrie près) y figure déjà.
 */
export function addToBank(
  bank: Bank,
  puzzle: Puzzle,
  solution: readonly number[],
  rating: Pick<Rating, 'score' | 'techniques' | 'entryPoints'>,
  createdAt: string,
  known: Set<string> = new Set(bank.puzzles.map(puzzleFingerprint)),
): PuzzleRecord | null {
  const fingerprint = puzzleFingerprint(puzzle);
  if (known.has(fingerprint)) return null;
  const record = makeRecord(bank.level, nextNumber(bank), puzzle, solution, rating, createdAt);
  bank.puzzles.push(record);
  known.add(fingerprint);
  return record;
}

/** Écrit la banque en JSON, une grille par ligne (fichier compact et facile à comparer d'une version à l'autre). */
export function serializeBank(bank: Bank): string {
  const lines = bank.puzzles.map((p) => '    ' + JSON.stringify(p));
  return `{\n  "version": ${bank.version},\n  "level": "${bank.level}",\n  "puzzles": [\n${lines.join(',\n')}\n  ]\n}\n`;
}
