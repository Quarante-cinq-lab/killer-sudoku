/** Mode erreurs (évolution E1, section 7.6) et « Recommencer la grille » (évolution E2, section 7.7). */
import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import { parseSolution } from '../../engine/model';
import hardBank from '../../data/bank-hard.json';
import { levelStats, libraryItems, type HistoryEntry } from '../data/history';
import {
  addVirtualCage,
  canRedo,
  canUndo,
  eraseCells,
  isOver,
  MAX_ERRORS,
  migrateGame,
  newGame,
  redo,
  setDigit,
  toggleCombination,
  toggleNote,
  undo,
  wrongDigits,
  type GameState,
} from './state';

const record = parseBank(hardBank).puzzles[0];
const solution = parseSolution(record.solution);
const fresh = (errorMode = true): GameState => newGame(record.id, undefined, errorMode);
/** Un chiffre faux pour une case. */
const wrong = (cell: number): number => (solution[cell] % 9) + 1;
const put = (s: GameState, cells: number[], digit: number): GameState =>
  setDigit(s, record, cells, digit, solution);

describe('vérification immédiate', () => {
  it('un chiffre juste ne compte pas ; un chiffre faux compte une erreur et reste en rouge', () => {
    let s = put(fresh(), [0], solution[0]);
    expect(s.errors).toBe(0);
    s = put(s, [1], wrong(1));
    expect(s.errors).toBe(1);
    expect([...wrongDigits(s, solution)]).toEqual([1]);
  });

  it('effacer ou annuler un chiffre faux ne retire pas l’erreur, et rétablir ne la recompte pas', () => {
    let s = put(fresh(), [1], wrong(1));
    expect(eraseCells(s, [1]).errors).toBe(1);
    expect(wrongDigits(eraseCells(s, [1]), solution).size).toBe(0);
    s = undo(s);
    expect(s.errors).toBe(1);
    s = redo(s);
    expect(s.errors).toBe(1);
    expect(s.values[1]).toBe(wrong(1));
  });

  it('les notes ne sont jamais vérifiées', () => {
    const s = toggleNote(fresh(), [1], wrong(1));
    expect(s.errors).toBe(0);
  });

  it('un même chiffre faux posé dans plusieurs cases compte une erreur par case', () => {
    const cells = [0, 1].filter((c) => solution[c] !== 5);
    const s = put(fresh(), cells, 5);
    expect(s.errors).toBe(cells.length);
  });

  it('sans mode erreurs, rien n’est compté ni signalé', () => {
    const s = put(fresh(false), [1], wrong(1));
    expect(s.errors).toBe(0);
    expect(wrongDigits(s, solution).size).toBe(0);
  });
});

describe('limite de 3 erreurs', () => {
  const lostGame = (): GameState => {
    let s = fresh();
    for (const cell of [1, 2, 3]) s = put(s, [cell], wrong(cell));
    return s;
  };

  it('à la 3e erreur, la partie est perdue et la grille bloquée', () => {
    const s = lostGame();
    expect(s.errors).toBe(MAX_ERRORS);
    expect(s.lost).toBe(true);
    expect(isOver(s)).toBe(true);
    expect(put(s, [4], solution[4])).toBe(s);
    expect(toggleNote(s, [4], 1)).toBe(s);
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  it('le compteur ne dépasse jamais 3, même avec plusieurs cases d’un coup', () => {
    let s = put(fresh(), [1], wrong(1));
    const many = [10, 11, 12, 13].filter((c) => solution[c] !== 9);
    s = put(s, many, 9);
    expect(s.errors).toBe(MAX_ERRORS);
    expect(s.lost).toBe(true);
  });
});

describe('recommencer la grille', () => {
  it('une nouvelle partie repart de zéro : chiffres, notes, cages virtuelles, combinaisons, erreurs', () => {
    let s = put(fresh(), [1], wrong(1));
    s = toggleNote(s, [2], 4);
    s = addVirtualCage(s, [3, 4], 9);
    s = toggleCombination(s, 'c0', 3);
    const restarted = newGame(s.puzzleId, s.aids, true);
    expect(restarted.values.every((v) => v === 0)).toBe(true);
    expect(restarted.notes.every((n) => n.length === 0)).toBe(true);
    expect(restarted.virtualCages).toEqual([]);
    expect(restarted.struck).toEqual({});
    expect(restarted.undo).toEqual([]);
    expect(restarted.errors).toBe(0);
    expect(restarted.lost).toBe(false);
  });

  it('une partie commencée avant le mode erreurs le garde désactivé', () => {
    const old = { ...newGame(record.id), version: 2 } as unknown as Partial<GameState>;
    delete old.errorMode;
    delete old.errors;
    delete old.lost;
    const game = migrateGame(old as GameState);
    expect(game.errorMode).toBe(false);
    expect(game.errors).toBe(0);
    expect(game.lost).toBe(false);
  });
});

describe('historique, statistiques et bibliothèque', () => {
  const entry = (outcome: HistoryEntry['outcome'], errors?: number): HistoryEntry => ({
    puzzleId: record.id,
    level: 'HARD',
    startedAt: '2026-11-12',
    endedAt: '2026-11-12',
    outcome,
    durationMs: 60_000,
    hints: 0,
    checks: 0,
    ...(errors === undefined ? {} : { errors }),
    feeling: null,
  });

  it('compte les parties perdues et les erreurs moyennes des parties terminées', () => {
    const stats = levelStats(
      [entry('terminee', 2), entry('terminee'), entry('perdue', 3), entry('abandonnee')],
      'HARD',
    );
    expect(stats.finished).toBe(2);
    expect(stats.lost).toBe(1);
    expect(stats.averageErrors).toBe(1);
  });

  it('une grille dont la dernière partie est perdue a le statut « perdue »', () => {
    const lost = { puzzleId: record.id, completed: false, lost: true, elapsedMs: 1000, updatedAt: 1 };
    expect(libraryItems([record], [lost], [entry('perdue', 3)], new Set())[0].status).toBe('perdue');
  });
});
