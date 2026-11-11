import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import { parseSolution } from '../../engine/model';
import hardBank from '../../data/bank-hard.json';
import {
  canRedo,
  canUndo,
  candidates,
  checkVictory,
  eraseAll,
  eraseCells,
  fillAllNotes,
  isFull,
  newGame,
  redo,
  setDigit,
  toggleNote,
  undo,
} from './state';
import { formatTime, readClock, startClock, stopClock, stoppedClock } from './clock';

const record = parseBank(hardBank).puzzles[0];
const solution = parseSolution(record.solution);
const fresh = () => newGame(record.id);

describe('saisie', () => {
  it('un chiffre définitif remplace les notes de la case', () => {
    let s = toggleNote(fresh(), [0], 3);
    s = toggleNote(s, [0], 5);
    s = setDigit(s, [0], 7);
    expect(s.values[0]).toBe(7);
    expect(s.notes[0]).toEqual([]);
  });

  it('un chiffre s’inscrit dans toutes les cases sélectionnées ; un second appui l’efface', () => {
    let s = setDigit(fresh(), [0, 1], 4);
    expect([s.values[0], s.values[1]]).toEqual([4, 4]);
    s = setDigit(s, [0, 1], 4);
    expect([s.values[0], s.values[1]]).toEqual([0, 0]);
  });

  it('les notes gardent leur ordre de saisie', () => {
    let s = fresh();
    for (const d of [8, 2, 5]) s = toggleNote(s, [10], d);
    expect(s.notes[10]).toEqual([8, 2, 5]);
  });

  it('une note s’ajoute là où elle manque, ou se retire si toutes les cases l’ont', () => {
    let s = toggleNote(fresh(), [0], 6);
    s = toggleNote(s, [0, 1], 6);
    expect([s.notes[0], s.notes[1]]).toEqual([[6], [6]]);
    s = toggleNote(s, [0, 1], 6);
    expect([s.notes[0], s.notes[1]]).toEqual([[], []]);
  });

  it('une note ne touche pas une case qui a un chiffre définitif', () => {
    let s = setDigit(fresh(), [0], 2);
    s = toggleNote(s, [0, 1], 9);
    expect(s.notes[0]).toEqual([]);
    expect(s.notes[1]).toEqual([9]);
  });

  it('efface la sélection ou toute la grille', () => {
    let s = setDigit(fresh(), [0], 1);
    s = toggleNote(s, [5], 3);
    expect(eraseCells(s, [0]).values[0]).toBe(0);
    const cleared = eraseAll(s);
    expect(cleared.values.every((v) => v === 0)).toBe(true);
    expect(cleared.notes.every((n) => n.length === 0)).toBe(true);
    expect(undo(cleared)).toEqual({ ...s, redo: [cleared.undo[cleared.undo.length - 1]] });
  });

  it('une action sans effet n’entre pas dans l’historique', () => {
    expect(eraseCells(fresh(), [0, 1, 2]).undo).toHaveLength(0);
  });
});

describe('annuler et rétablir', () => {
  it('annule et rétablit chaque action, dans l’ordre', () => {
    const s0 = fresh();
    const s1 = setDigit(s0, [0], 5);
    const s2 = toggleNote(s1, [1, 2], 3);
    const back1 = undo(s2);
    expect(back1.values).toEqual(s1.values);
    expect(back1.notes).toEqual(s1.notes);
    const back0 = undo(back1);
    expect(back0.values).toEqual(s0.values);
    expect(canUndo(back0)).toBe(false);
    const again = redo(redo(back0));
    expect(again.values).toEqual(s2.values);
    expect(again.notes).toEqual(s2.notes);
    expect(canRedo(again)).toBe(false);
  });

  it('une nouvelle action efface ce qu’on pouvait rétablir', () => {
    const s = undo(setDigit(fresh(), [0], 5));
    expect(canRedo(s)).toBe(true);
    expect(canRedo(setDigit(s, [1], 2))).toBe(false);
  });
});

describe('notes automatiques et victoire', () => {
  it('les candidats respectent la cage et les chiffres déjà posés', () => {
    const empty = new Array<number>(81).fill(0);
    for (let cell = 0; cell < 81; cell++) {
      expect(candidates(record, empty, cell)).toContain(solution[cell]);
    }
    const values = [...empty];
    values[1] = solution[1];
    // Une case vue par une case remplie ne peut plus avoir son chiffre.
    expect(candidates(record, values, 0)).not.toContain(solution[1]);
  });

  it('« Remplir toutes les notes » ne remplit que les cases vides, et s’annule d’un coup', () => {
    const s = fillAllNotes(setDigit(fresh(), [0], solution[0]), record);
    expect(s.notes[0]).toEqual([]);
    expect(s.notes[1].length).toBeGreaterThan(0);
    expect(s.notes[1]).toEqual([...s.notes[1]].sort((a, b) => a - b));
    expect(undo(s).notes.every((n) => n.length === 0)).toBe(true);
  });

  it('détecte la victoire seulement si la grille est juste, puis fige la partie', () => {
    let s = fresh();
    for (let cell = 0; cell < 80; cell++) s = setDigit(s, [cell], solution[cell]);
    const wrong = setDigit(s, [80], (solution[80] % 9) + 1);
    expect(isFull(wrong)).toBe(true);
    expect(checkVictory(wrong, solution).completed).toBe(false);
    const won = checkVictory(setDigit(s, [80], solution[80]), solution);
    expect(won.completed).toBe(true);
    expect(setDigit(won, [0], 1)).toBe(won);
    expect(canUndo(won)).toBe(false);
  });
});

describe('chronomètre', () => {
  it('cumule le temps seulement quand il tourne', () => {
    let clock = startClock(stoppedClock(1000), 10_000);
    expect(readClock(clock, 15_000)).toBe(6000);
    clock = stopClock(clock, 15_000);
    expect(readClock(clock, 99_000)).toBe(6000);
    clock = startClock(clock, 100_000);
    expect(readClock(clock, 101_500)).toBe(7500);
  });

  it('affiche hh:mm:ss', () => {
    expect(formatTime(0)).toBe('00:00:00');
    expect(formatTime(3_725_999)).toBe('01:02:05');
  });
});
