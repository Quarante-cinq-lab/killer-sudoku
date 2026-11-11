import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../engine/model';
import { cageSegments, cellAtPoint, cellNearPoint } from './geometry';

/** Une grille où la case 0 est seule et le reste ne compte pas (une seule grande cage). */
const withCages = (...cages: number[][]): Puzzle => ({
  cages: cages.map((cells) => ({ sum: 0, cells })),
});

describe('contour des cages', () => {
  it('une cage d’une case donne un carré en retrait', () => {
    const segs = cageSegments(withCages([0]), 0, 5);
    expect(segs).toHaveLength(4);
    expect(segs).toContainEqual({ x1: 5, y1: 5, x2: 95, y2: 5 });
    expect(segs).toContainEqual({ x1: 95, y1: 5, x2: 95, y2: 95 });
  });

  it('deux cases côte à côte : les bords se prolongent sans trait au milieu', () => {
    const segs = cageSegments(withCages([0, 1]), 0, 5);
    expect(segs).toContainEqual({ x1: 5, y1: 5, x2: 100, y2: 5 });
    expect(segs).toContainEqual({ x1: 100, y1: 5, x2: 195, y2: 5 });
    expect(segs.some((s) => s.x1 === 95 && s.x2 === 95)).toBe(false);
  });

  it('une cage en L : le coin rentrant se referme', () => {
    // Cases 0, 9 et 10 : le coin rentrant est en haut à gauche de la case 10.
    const segs = cageSegments(withCages([0, 9, 10]), 0, 5);
    // Bord droit de la case 0, descendu jusqu'au retrait du haut de la case 10.
    expect(segs).toContainEqual({ x1: 95, y1: 5, x2: 95, y2: 105 });
    // Bord haut de la case 10, parti du retrait du bord droit de la case 0.
    expect(segs).toContainEqual({ x1: 95, y1: 105, x2: 195, y2: 105 });
  });
});

describe('repérage des cases', () => {
  it('trouve la case sous un point', () => {
    expect(cellAtPoint(50, 50)).toBe(0);
    expect(cellAtPoint(899, 899)).toBe(80);
    expect(cellAtPoint(-1, 50)).toBe(-1);
  });

  it('pendant un glissé, ignore les bords des cases', () => {
    expect(cellNearPoint(150, 150)).toBe(10);
    expect(cellNearPoint(198, 150)).toBe(-1);
  });
});
