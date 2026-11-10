import { describe, expect, it } from 'vitest';
import {
  boxOf,
  cageAnchor,
  cellAt,
  colOf,
  isConnected,
  isSolutionOf,
  parsePuzzleRecord,
  parseSolution,
  PEERS,
  rowOf,
  UNITS,
  validatePuzzle,
  type Puzzle,
} from '../model';
import data from './fixtures/killer-fixtures.json';

const fixture = data.fixtures[0];
const clone = (p: Puzzle): Puzzle => ({ cages: p.cages.map((c) => ({ sum: c.sum, cells: [...c.cells] })) });

describe('numérotation des cases', () => {
  it('retrouve ligne, colonne et bloc', () => {
    expect([rowOf(0), colOf(0), boxOf(0)]).toEqual([0, 0, 0]);
    expect([rowOf(40), colOf(40), boxOf(40)]).toEqual([4, 4, 4]);
    expect([rowOf(80), colOf(80), boxOf(80)]).toEqual([8, 8, 8]);
    expect(boxOf(cellAt(3, 7))).toBe(5);
    expect(cellAt(8, 0)).toBe(72);
  });

  it('a 27 unités de 9 cases et 20 voisines par case', () => {
    expect(UNITS).toHaveLength(27);
    for (const unit of UNITS) expect(new Set(unit).size).toBe(9);
    for (const peers of PEERS) expect(peers).toHaveLength(20);
    expect(PEERS[0]).toContain(80 - 8); // même colonne
    expect(PEERS[0]).toContain(20); // même bloc
    expect(PEERS[0]).not.toContain(30);
  });
});

describe('validation de la structure', () => {
  it('accepte une grille bien formée', () => {
    expect(validatePuzzle(fixture)).toEqual([]);
  });

  it('détecte une case dans deux cages', () => {
    const p = clone(fixture);
    p.cages[0].cells.push(p.cages[1].cells[0]);
    expect(validatePuzzle(p).map((i) => i.code)).toContain('case_en_double');
  });

  it('détecte une case sans cage', () => {
    const p = clone(fixture);
    p.cages[0].cells.pop();
    expect(validatePuzzle(p).map((i) => i.code)).toContain('case_sans_cage');
  });

  it("détecte une cage qui n'est pas d'un seul tenant", () => {
    expect(isConnected([0, 1, 10])).toBe(true);
    expect(isConnected([0, 2])).toBe(false);
    expect(isConnected([8, 9])).toBe(false); // fin de ligne / début de la suivante : pas voisines
    const p: Puzzle = { cages: [{ sum: 3, cells: [0, 2] }] };
    expect(validatePuzzle(p).map((i) => i.code)).toContain('cage_non_connexe');
  });

  it('détecte une somme impossible et un total faux', () => {
    const p = clone(fixture);
    const two = p.cages.findIndex((c) => c.cells.length === 2);
    p.cages[two].sum = 18;
    const codes = validatePuzzle(p).map((i) => i.code);
    expect(codes).toContain('somme_impossible');
    expect(codes).toContain('total_incorrect');
  });

  it('détecte une cage vide ou trop grande et une case hors grille', () => {
    expect(validatePuzzle({ cages: [{ sum: 0, cells: [] }] }).map((i) => i.code)).toContain('cage_vide');
    const big = { sum: 45, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
    expect(validatePuzzle({ cages: [big] }).map((i) => i.code)).toContain('cage_trop_grande');
    expect(validatePuzzle({ cages: [{ sum: 5, cells: [81] }] }).map((i) => i.code)).toContain(
      'cellule_invalide',
    );
  });

  it('place la somme sur la case la plus haute puis la plus à gauche', () => {
    expect(cageAnchor({ sum: 10, cells: [11, 10, 19] })).toBe(10);
  });
});

describe('solution', () => {
  it('lit et vérifie une solution', () => {
    const digits = parseSolution(fixture.solution);
    expect(digits).toHaveLength(81);
    expect(isSolutionOf(fixture, digits)).toBe(true);
  });

  it('refuse une solution mal écrite', () => {
    expect(() => parseSolution('123')).toThrow();
    expect(() => parseSolution('0'.repeat(81))).toThrow();
  });

  it('refuse une solution qui casse une règle', () => {
    const digits = parseSolution(fixture.solution);
    [digits[0], digits[1]] = [digits[1], digits[0]]; // la ligne reste bonne, pas les colonnes
    expect(isSolutionOf(fixture, digits)).toBe(false);
  });
});

describe('format de la banque (section 6.3)', () => {
  const record = {
    id: 'TEST-0001',
    level: 'EXPERT',
    number: 1,
    score: 0,
    techniques: {},
    entryPoints: 0,
    cages: fixture.cages,
    solution: fixture.solution,
    engineVersion: '0.1.0',
    createdAt: '2026-11-11',
  };

  it('lit une grille complète', () => {
    const parsed = parsePuzzleRecord(JSON.parse(JSON.stringify(record)));
    expect(parsed.id).toBe('TEST-0001');
    expect(parsed.cages).toHaveLength(fixture.cages.length);
  });

  it('refuse un champ manquant, un niveau inconnu ou une solution fausse', () => {
    expect(() => parsePuzzleRecord({ ...record, id: undefined })).toThrow(/id/);
    expect(() => parsePuzzleRecord({ ...record, level: 'FACILE' })).toThrow(/niveau/);
    const wrong = fixture.solution.slice(1) + fixture.solution[0];
    expect(() => parsePuzzleRecord({ ...record, solution: wrong })).toThrow();
  });
});
