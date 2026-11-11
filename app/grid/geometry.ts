/**
 * Géométrie de la grille SVG. Une case mesure CELL unités ; la grille fait donc 9 × CELL de côté
 * (le SVG est ensuite mis à l'échelle de l'écran).
 */
import { cageIndexByCell, cellAt, colOf, rowOf, type Puzzle } from '../../engine/model';

export const CELL = 100;
export const GRID = 9 * CELL;

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Contour d'une cage, tracé à l'intérieur des cases avec un retrait `inset` (style de l'application
 * de référence). Pour chaque côté d'une case qui borde une autre cage, on trace un segment décalé vers
 * l'intérieur. Ses extrémités sont ajustées pour que les segments se rejoignent :
 * - coin saillant (le côté perpendiculaire est aussi un bord) : le segment s'arrête au retrait ;
 * - coin rentrant (la case en diagonale est dans la cage) : il se prolonge jusqu'au retrait voisin ;
 * - sinon (le bord continue tout droit) : il va jusqu'au bout de la case.
 */
export function cageSegments(puzzle: Puzzle, cageIndex: number, inset: number): Segment[] {
  const owner = cageIndexByCell(puzzle);
  const inCage = (r: number, c: number): boolean =>
    r >= 0 && r < 9 && c >= 0 && c < 9 && owner[cellAt(r, c)] === cageIndex;
  /** Position d'une extrémité : `side` = le côté perpendiculaire est un bord ; `diagonal` = coin rentrant. */
  const end = (edge: number, inward: number, side: boolean, diagonal: boolean): number =>
    side ? edge + inward * inset : diagonal ? edge - inward * inset : edge;

  const segments: Segment[] = [];
  for (const cell of puzzle.cages[cageIndex].cells) {
    const r = rowOf(cell);
    const c = colOf(cell);
    const L = c * CELL;
    const R = L + CELL;
    const T = r * CELL;
    const B = T + CELL;
    const up = !inCage(r - 1, c);
    const down = !inCage(r + 1, c);
    const left = !inCage(r, c - 1);
    const right = !inCage(r, c + 1);
    if (up) {
      const y = T + inset;
      segments.push({
        x1: end(L, 1, left, inCage(r - 1, c - 1)),
        y1: y,
        x2: end(R, -1, right, inCage(r - 1, c + 1)),
        y2: y,
      });
    }
    if (down) {
      const y = B - inset;
      segments.push({
        x1: end(L, 1, left, inCage(r + 1, c - 1)),
        y1: y,
        x2: end(R, -1, right, inCage(r + 1, c + 1)),
        y2: y,
      });
    }
    if (left) {
      const x = L + inset;
      segments.push({
        x1: x,
        y1: end(T, 1, up, inCage(r - 1, c - 1)),
        x2: x,
        y2: end(B, -1, down, inCage(r + 1, c - 1)),
      });
    }
    if (right) {
      const x = R - inset;
      segments.push({
        x1: x,
        y1: end(T, 1, up, inCage(r - 1, c + 1)),
        x2: x,
        y2: end(B, -1, down, inCage(r + 1, c + 1)),
      });
    }
  }
  return segments;
}

/** Les segments d'une cage sous forme de chemin SVG. */
export function segmentsPath(segments: readonly Segment[]): string {
  return segments.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join('');
}

/** Case sous un point de la grille (coordonnées SVG), ou -1 en dehors. */
export function cellAtPoint(x: number, y: number): number {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  return r >= 0 && r < 9 && c >= 0 && c < 9 ? cellAt(r, c) : -1;
}

/**
 * Pendant un glissé, on n'ajoute une case que si le doigt passe assez près de son centre : cela évite
 * d'attraper par erreur les cases voisines quand on glisse en diagonale.
 */
export function cellNearPoint(x: number, y: number, tolerance = 0.38): number {
  const cell = cellAtPoint(x, y);
  if (cell < 0) return -1;
  const cx = (colOf(cell) + 0.5) * CELL;
  const cy = (rowOf(cell) + 0.5) * CELL;
  return Math.abs(x - cx) <= tolerance * CELL && Math.abs(y - cy) <= tolerance * CELL ? cell : -1;
}
