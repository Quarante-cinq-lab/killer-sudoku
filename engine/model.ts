import { digitBit } from './bits';
import { maxCageSum, minCageSum } from './combinations';

/**
 * Modèle de la grille. Les cases sont numérotées de 0 à 80, ligne par ligne :
 * case = ligne × 9 + colonne (ligne et colonne de 0 à 8).
 */

export const CELL_COUNT = 81;
export const GRID_TOTAL = 405; // 9 lignes × 45

export const rowOf = (cell: number): number => Math.floor(cell / 9);
export const colOf = (cell: number): number => cell % 9;
export const boxOf = (cell: number): number => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);
export const cellAt = (row: number, col: number): number => row * 9 + col;

/** Les 27 unités : lignes (0 à 8), colonnes (9 à 17), blocs (18 à 26). Chacune liste ses 9 cases. */
export const UNITS: readonly (readonly number[])[] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => cellAt(r, c)));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => cellAt(r, c)));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, i) => cellAt(r0 + Math.floor(i / 3), c0 + (i % 3))));
  }
  return units;
})();

/** Pour chaque case, les 20 cases qui partagent sa ligne, sa colonne ou son bloc. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELL_COUNT }, (_, cell) => {
  const peers = new Set<number>();
  for (const unit of [UNITS[rowOf(cell)], UNITS[9 + colOf(cell)], UNITS[18 + boxOf(cell)]]) {
    for (const other of unit) if (other !== cell) peers.add(other);
  }
  return [...peers].sort((a, b) => a - b);
});

/** Cases voisines par un côté (haut, bas, gauche, droite). */
export function orthogonalNeighbours(cell: number): number[] {
  const r = rowOf(cell);
  const c = colOf(cell);
  const result: number[] = [];
  if (r > 0) result.push(cell - 9);
  if (r < 8) result.push(cell + 9);
  if (c > 0) result.push(cell - 1);
  if (c < 8) result.push(cell + 1);
  return result;
}

export interface Cage {
  sum: number;
  cells: number[];
}

/** Une grille de killer : uniquement ses cages (aucun chiffre donné). */
export interface Puzzle {
  cages: Cage[];
}

/** Niveaux de difficulté (codes internes, sans accent ; les libellés affichés sont dans l'interface). */
export const LEVELS = ['HARD', 'EXPERT', 'DIABOLIQUE', 'EXTREME', 'ULTIME'] as const;
export type Level = (typeof LEVELS)[number];

/** Une grille de la banque, au format de la section 6.3 du cahier des charges. */
export interface PuzzleRecord extends Puzzle {
  id: string;
  level: Level;
  number: number;
  score: number;
  techniques: Record<string, number>;
  entryPoints: number;
  /** 81 chiffres, de la case en haut à gauche à celle en bas à droite. */
  solution: string;
  engineVersion: string;
  createdAt: string;
}

/** Pour chaque case, l'indice de sa cage dans `puzzle.cages` (ou -1 si aucune). */
export function cageIndexByCell(puzzle: Puzzle): Int16Array {
  const index = new Int16Array(CELL_COUNT).fill(-1);
  puzzle.cages.forEach((cage, i) => {
    for (const cell of cage.cells) if (cell >= 0 && cell < CELL_COUNT) index[cell] = i;
  });
  return index;
}

/** Première case d'une cage : la plus haute, puis la plus à gauche (là où s'affiche la somme). */
export function cageAnchor(cage: Cage): number {
  return Math.min(...cage.cells);
}

export interface ValidationIssue {
  code:
    | 'cellule_invalide'
    | 'case_en_double'
    | 'case_sans_cage'
    | 'cage_vide'
    | 'cage_trop_grande'
    | 'cage_non_connexe'
    | 'somme_impossible'
    | 'total_incorrect';
  message: string;
  cage?: number;
}

/**
 * Vérifie la structure d'une grille : chaque case dans exactement une cage, cages d'un seul tenant,
 * sommes réalisables, total des sommes égal à 405. Ne dit rien sur l'unicité (rôle du solveur).
 * Renvoie la liste des problèmes (vide si la grille est bien formée).
 */
export function validatePuzzle(puzzle: Puzzle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const owner = new Int16Array(CELL_COUNT).fill(-1);
  let total = 0;

  puzzle.cages.forEach((cage, i) => {
    total += cage.sum;
    const size = cage.cells.length;
    if (size === 0) {
      issues.push({ code: 'cage_vide', message: `La cage ${i} ne contient aucune case.`, cage: i });
      return;
    }
    if (size > 9) {
      issues.push({
        code: 'cage_trop_grande',
        message: `La cage ${i} a ${size} cases (maximum 9).`,
        cage: i,
      });
    }
    for (const cell of cage.cells) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) {
        issues.push({
          code: 'cellule_invalide',
          message: `La cage ${i} contient la case invalide ${cell}.`,
          cage: i,
        });
        continue;
      }
      if (owner[cell] !== -1) {
        issues.push({
          code: 'case_en_double',
          message: `La case ${cell} appartient à la fois aux cages ${owner[cell]} et ${i}.`,
          cage: i,
        });
      }
      owner[cell] = i;
    }
    if (!Number.isInteger(cage.sum) || cage.sum < minCageSum(size) || cage.sum > maxCageSum(size)) {
      issues.push({
        code: 'somme_impossible',
        message: `La cage ${i} (${size} cases) ne peut pas valoir ${cage.sum}.`,
        cage: i,
      });
    }
    if (!isConnected(cage.cells)) {
      issues.push({ code: 'cage_non_connexe', message: `La cage ${i} n'est pas d'un seul tenant.`, cage: i });
    }
  });

  const orphans: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) if (owner[cell] === -1) orphans.push(cell);
  if (orphans.length > 0) {
    const shown = orphans.slice(0, 10).join(', ') + (orphans.length > 10 ? '…' : '');
    issues.push({
      code: 'case_sans_cage',
      message: `${orphans.length} case(s) dans aucune cage : ${shown}`,
    });
  }
  if (total !== GRID_TOTAL) {
    issues.push({
      code: 'total_incorrect',
      message: `Le total des sommes vaut ${total} au lieu de ${GRID_TOTAL}.`,
    });
  }
  return issues;
}

/** Vrai si les cases forment un seul bloc relié par les côtés. */
export function isConnected(cells: readonly number[]): boolean {
  if (cells.length === 0) return false;
  const inside = new Set(cells);
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const cell = stack.pop() as number;
    for (const n of orthogonalNeighbours(cell)) {
      if (inside.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === inside.size;
}

/** Lit une solution de 81 chiffres (texte) en tableau de chiffres. Lève une erreur si le texte est mal formé. */
export function parseSolution(text: string): number[] {
  if (!/^[1-9]{81}$/.test(text))
    throw new Error('Une solution doit contenir exactement 81 chiffres de 1 à 9.');
  return Array.from(text, Number);
}

/** Écrit une solution (81 chiffres) sous forme de texte. */
export function formatSolution(digits: ArrayLike<number>): string {
  return Array.from(digits).join('');
}

/** Vrai si la grille complète respecte les règles du sudoku et toutes les cages du puzzle. */
export function isSolutionOf(puzzle: Puzzle, digits: ArrayLike<number>): boolean {
  if (digits.length !== CELL_COUNT) return false;
  for (let i = 0; i < CELL_COUNT; i++) if (!(digits[i] >= 1 && digits[i] <= 9)) return false;
  for (const unit of UNITS) {
    let seen = 0;
    for (const cell of unit) seen |= digitBit(digits[cell]);
    if (seen !== 0x1ff) return false;
  }
  for (const cage of puzzle.cages) {
    let seen = 0;
    let sum = 0;
    for (const cell of cage.cells) {
      const bit = digitBit(digits[cell]);
      if (seen & bit) return false;
      seen |= bit;
      sum += digits[cell];
    }
    if (sum !== cage.sum) return false;
  }
  return true;
}

/**
 * Lit une grille de la banque depuis du JSON déjà décodé, en vérifiant les champs.
 * Lève une erreur explicite si un champ manque ou si la grille est mal formée.
 */
export function parsePuzzleRecord(data: unknown): PuzzleRecord {
  if (typeof data !== 'object' || data === null) throw new Error('Grille : objet attendu.');
  const o = data as Record<string, unknown>;
  const str = (k: string): string => {
    if (typeof o[k] !== 'string') throw new Error(`Grille : le champ « ${k} » doit être un texte.`);
    return o[k];
  };
  const num = (k: string): number => {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) {
      throw new Error(`Grille : le champ « ${k} » doit être un nombre.`);
    }
    return o[k];
  };
  const level = str('level');
  if (!(LEVELS as readonly string[]).includes(level))
    throw new Error(`Grille : niveau inconnu « ${level} ».`);
  if (typeof o.techniques !== 'object' || o.techniques === null) {
    throw new Error('Grille : le champ « techniques » doit être un objet.');
  }
  const techniques: Record<string, number> = {};
  for (const [name, count] of Object.entries(o.techniques)) {
    if (typeof count !== 'number') throw new Error(`Grille : technique « ${name} » sans nombre.`);
    techniques[name] = count;
  }
  const record: PuzzleRecord = {
    id: str('id'),
    level: level as Level,
    number: num('number'),
    score: num('score'),
    techniques,
    entryPoints: num('entryPoints'),
    cages: parseCages(o.cages),
    solution: str('solution'),
    engineVersion: str('engineVersion'),
    createdAt: str('createdAt'),
  };
  const issues = validatePuzzle(record);
  if (issues.length > 0) throw new Error(`Grille ${record.id} mal formée : ${issues[0].message}`);
  if (!isSolutionOf(record, parseSolution(record.solution))) {
    throw new Error(`Grille ${record.id} : la solution enregistrée ne respecte pas les règles.`);
  }
  return record;
}

/** Lit une liste de cages depuis du JSON déjà décodé. */
export function parseCages(data: unknown): Cage[] {
  if (!Array.isArray(data)) throw new Error('Le champ « cages » doit être une liste.');
  return data.map((item: unknown, i) => {
    const c = item as { sum?: unknown; cells?: unknown };
    if (
      typeof c.sum !== 'number' ||
      !Array.isArray(c.cells) ||
      !c.cells.every((x) => typeof x === 'number')
    ) {
      throw new Error(`Cage ${i} : il faut une somme (nombre) et une liste de cases.`);
    }
    return { sum: c.sum, cells: [...(c.cells as number[])] };
  });
}
