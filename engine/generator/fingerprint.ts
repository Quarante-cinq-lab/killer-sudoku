import { cellAt, colOf, rowOf, type Puzzle } from '../model';

/** Les 8 symétries du carré : 4 rotations, et les mêmes après un retournement. */
const SYMMETRIES: readonly ((r: number, c: number) => number)[] = [
  (r, c) => cellAt(r, c),
  (r, c) => cellAt(c, 8 - r),
  (r, c) => cellAt(8 - r, 8 - c),
  (r, c) => cellAt(8 - c, r),
  (r, c) => cellAt(r, 8 - c),
  (r, c) => cellAt(8 - r, c),
  (r, c) => cellAt(c, r),
  (r, c) => cellAt(8 - c, 8 - r),
];

/** Description texte des cages après transformation, dans un ordre fixe. */
function describe(puzzle: Puzzle, map: (r: number, c: number) => number): string {
  return puzzle.cages
    .map((cage) => ({
      sum: cage.sum,
      cells: cage.cells.map((x) => map(rowOf(x), colOf(x))).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.cells[0] - b.cells[0])
    .map((cage) => `${cage.sum}:${cage.cells.join(',')}`)
    .join(';');
}

/** Hachage 53 bits (cyrb53) : court, rapide, collisions négligeables pour quelques milliers de grilles. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Empreinte d'une grille pour le dédoublonnage (section 6.1, point 6) : deux grilles qui ne diffèrent
 * que par une rotation ou un retournement ont la même empreinte. On garde la plus petite des 8
 * descriptions possibles, puis on la résume par un hachage.
 * Les chiffres ne sont pas permutés : cela changerait les sommes, donc ce serait une autre grille.
 */
export function puzzleFingerprint(puzzle: Puzzle): string {
  let best = '';
  for (const map of SYMMETRIES) {
    const text = describe(puzzle, map);
    if (best === '' || text < best) best = text;
  }
  return hash(best);
}

/** Applique une symétrie (0 à 7) à une grille : utile pour les tests. */
export function transformPuzzle(puzzle: Puzzle, symmetry: number): Puzzle {
  const map = SYMMETRIES[symmetry];
  return {
    cages: puzzle.cages.map((cage) => ({
      sum: cage.sum,
      cells: cage.cells.map((x) => map(rowOf(x), colOf(x))).sort((a, b) => a - b),
    })),
  };
}
