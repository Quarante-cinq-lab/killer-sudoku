import { describe, expect, it } from 'vitest';
import { addToBank, emptyBank, nextNumber, parseBank, puzzleId, serializeBank } from '../bank';
import { transformPuzzle } from '../generator/fingerprint';
import { parseSolution, type Puzzle } from '../model';
import { ENGINE_VERSION } from '../version';
import data from './fixtures/killer-fixtures.json';

const rating = { score: 250, techniques: { naked_single: 40, rule45_single: 3 }, entryPoints: 6 };
const unique = data.fixtures.filter((f) => f.expectedCount === 1);

function fill(count: number) {
  const bank = emptyBank('HARD');
  for (const f of unique.slice(0, count)) {
    addToBank(bank, { cages: f.cages }, parseSolution(f.solution), rating, '2026-11-11');
  }
  return bank;
}

describe('banque de grilles', () => {
  it('fabrique des identifiants fixes par niveau', () => {
    expect(puzzleId('HARD', 1)).toBe('HRD-0001');
    expect(puzzleId('EXPERT', 42)).toBe('EXP-0042');
    expect(puzzleId('ULTIME', 12345)).toBe('ULT-12345');
  });

  it('numérote les grilles à la suite, au format de la section 6.3', () => {
    const bank = fill(3);
    expect(bank.puzzles.map((p) => p.id)).toEqual(['HRD-0001', 'HRD-0002', 'HRD-0003']);
    const first = bank.puzzles[0];
    expect(Object.keys(first)).toEqual([
      'id',
      'level',
      'number',
      'score',
      'techniques',
      'entryPoints',
      'cages',
      'solution',
      'engineVersion',
      'createdAt',
    ]);
    expect(first.engineVersion).toBe(ENGINE_VERSION);
    expect(first.solution).toMatch(/^[1-9]{81}$/);
  });

  it('ne réutilise jamais un numéro, même après une suppression', () => {
    const bank = fill(3);
    bank.puzzles.splice(1, 1);
    expect(nextNumber(bank)).toBe(4);
  });

  it('refuse une grille déjà présente, même tournée ou retournée, sans rien modifier', () => {
    const bank = fill(2);
    const before = JSON.stringify(bank);
    const f = unique[1];
    const rotated: Puzzle = transformPuzzle({ cages: f.cages }, 1);
    expect(addToBank(bank, rotated, parseSolution(f.solution), rating, '2026-11-12')).toBeNull();
    expect(JSON.stringify(bank)).toBe(before);
  });

  it('se relit à l’identique après écriture', () => {
    const bank = fill(3);
    expect(parseBank(JSON.parse(serializeBank(bank)))).toEqual(bank);
    expect(parseBank(JSON.parse(serializeBank(emptyBank('EXPERT'))))).toEqual(emptyBank('EXPERT'));
  });

  it('détecte un fichier incohérent', () => {
    const bank = fill(2);
    const json = (): Record<string, unknown> => JSON.parse(serializeBank(bank)) as Record<string, unknown>;
    expect(() => parseBank({ ...json(), level: 'EXPERT' })).toThrow(/niveau HARD/);
    const twice = json();
    (twice.puzzles as unknown[]).push((twice.puzzles as unknown[])[0]);
    expect(() => parseBank(twice)).toThrow(/en double/);
    const badId = json();
    (badId.puzzles as { id: string }[])[0].id = 'HRD-0099';
    expect(() => parseBank(badId)).toThrow(/incohérent/);
  });
});
