import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import { cageAnchor, parseSolution } from '../../engine/model';
import hardBank from '../../data/bank-hard.json';
import {
  allDistinct,
  calculatorLines,
  combinationLines,
  comboSources,
  conflictCells,
  unitCells,
  wrongCells,
} from './aids';
import {
  addVirtualCage,
  GAME_FORMAT,
  DEFAULT_AIDS,
  migrateGame,
  newGame,
  PURIST_AIDS,
  removeVirtualCage,
  setAids,
  setDigit,
  toggleCombination,
  toggleNote,
  undo,
  redo,
  type GameState,
} from './state';

const record = parseBank(hardBank).puzzles[0];
const solution = parseSolution(record.solution);
const fresh = (): GameState => newGame(record.id);
const empty = (): number[] => new Array<number>(81).fill(0);

describe('nettoyage automatique des notes', () => {
  it('retire le chiffre posé des notes des cases qu’il voit, dans la même action', () => {
    let s = toggleNote(fresh(), [1, 9, 80], 5);
    s = setDigit(s, record, [0], 5);
    expect(s.notes[1]).toEqual([]); // même ligne
    expect(s.notes[9]).toEqual([]); // même colonne
    expect(s.notes[80]).toEqual([5]); // ne voit pas la case 0
    const back = undo(s);
    expect(back.values[0]).toBe(0);
    expect(back.notes[1]).toEqual([5]);
    expect(back.notes[9]).toEqual([5]);
  });

  it('ne fait rien si l’aide est désactivée', () => {
    let s = setAids(toggleNote(fresh(), [1], 5), { ...DEFAULT_AIDS, autoCleanNotes: false });
    s = setDigit(s, record, [0], 5);
    expect(s.notes[1]).toEqual([5]);
  });
});

describe('conflits', () => {
  it('signale un doublon dans une ligne, une colonne ou un bloc', () => {
    const values = empty();
    values[0] = 4;
    values[8] = 4; // même ligne
    expect([...conflictCells(record, values)].sort((a, b) => a - b)).toEqual([0, 8]);
  });

  it('signale une cage dont la somme est devenue impossible', () => {
    const cage = record.cages.find((c) => c.cells.length === 2);
    if (!cage) throw new Error('cage de deux cases manquante');
    const values = empty();
    // Complément impossible : 0 (somme ≤ 9), le même chiffre (somme 10) ou plus de 9 (somme ≥ 11).
    values[cage.cells[0]] = cage.sum <= 9 ? cage.sum : cage.sum === 10 ? 5 : 1;
    expect(conflictCells(record, values).has(cage.cells[0])).toBe(true);
  });

  it('ne signale rien sur la solution', () => {
    expect(conflictCells(record, solution).size).toBe(0);
  });
});

describe('vérification et surlignage', () => {
  it('liste les chiffres faux', () => {
    const values = empty();
    values[0] = solution[0];
    values[1] = (solution[1] % 9) + 1;
    expect(wrongCells(values, solution)).toEqual([1]);
  });

  it('surligne ligne, colonne et bloc', () => {
    const cells = unitCells(40);
    expect(cells.size).toBe(21);
    expect(cells.has(36) && cells.has(4) && cells.has(30)).toBe(true);
  });
});

describe('combinaisons', () => {
  it('liste les combinaisons de la cage et grise celles qui contredisent les chiffres posés', () => {
    const [source] = comboSources(record, [], record.cages[0].cells[0]);
    expect(source.key).toBe(`c${cageAnchor(record.cages[0])}`);
    const values = empty();
    const cell = source.cells[0];
    values[cell] = solution[cell];
    const lines = combinationLines(source, values);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.compatible).toBe(line.digits.includes(solution[cell]));
  });

  it('barrer une combinaison est mémorisé par cage et s’annule', () => {
    let s = toggleCombination(fresh(), 'c0', 0b11);
    expect(s.struck).toEqual({ c0: [0b11] });
    s = toggleCombination(s, 'c0', 0b101);
    expect(undo(s).struck).toEqual({ c0: [0b11] });
    expect(redo(undo(s)).struck).toEqual({ c0: [0b11, 0b101] });
    expect(toggleCombination(toggleCombination(fresh(), 'c0', 3), 'c0', 3).struck).toEqual({});
  });

  it('calculatrice : 25 en 4 cases, avec un chiffre obligatoire et un exclu', () => {
    expect(calculatorLines(25, 4, 0, 0)).toHaveLength(6);
    expect(calculatorLines(25, 4, 1 << 8, 1 << 0)).toEqual(
      calculatorLines(25, 4, 1 << 8, 1 << 0).filter((d) => d.includes(9) && !d.includes(1)),
    );
    expect(calculatorLines(10, 0, 0, 0)).toEqual([]);
  });
});

describe('cages virtuelles', () => {
  it('s’ajoutent, alimentent les combinaisons et se suppriment, le tout annulable', () => {
    let s = addVirtualCage(fresh(), [3, 2], 12);
    expect(s.virtualCages).toEqual([{ id: 1, sum: 12, cells: [2, 3] }]);
    expect(comboSources(record, s.virtualCages, 2).map((x) => x.key)).toContain('v1');
    s = toggleCombination(s, 'v1', 0b100001);
    s = removeVirtualCage(s, 1);
    expect(s.virtualCages).toEqual([]);
    expect(s.struck.v1).toBeUndefined();
    expect(undo(s).virtualCages).toHaveLength(1);
    expect(addVirtualCage(fresh(), [], 5)).toEqual(fresh());
  });

  it('détecte si les chiffres d’un groupe de cases sont forcément différents', () => {
    expect(allDistinct(record, [0, 1, 2])).toBe(true); // même ligne
    expect(allDistinct(record, [0, 40])).toBe(false);
  });
});

describe('aides de la partie', () => {
  it('le préréglage Puriste ne garde que le surlignage', () => {
    const on = Object.entries(PURIST_AIDS)
      .filter(([, v]) => v)
      .map(([k]) => k);
    expect(on.sort()).toEqual(['highlightSameDigits', 'highlightUnits']);
  });

  it('chaque aide s’active et se désactive', () => {
    for (const key of Object.keys(DEFAULT_AIDS) as (keyof typeof DEFAULT_AIDS)[]) {
      const off = setAids(fresh(), { ...DEFAULT_AIDS, [key]: false });
      expect(off.aids[key]).toBe(false);
      expect(setAids(off, DEFAULT_AIDS).aids[key]).toBe(true);
      expect(off.undo).toHaveLength(0); // ce n'est pas une action de jeu
    }
  });

  it('convertit une partie sauvegardée au format 1', () => {
    const old = {
      puzzleId: 'HRD-0001',
      values: empty(),
      notes: Array.from({ length: 81 }, () => []),
      undo: [[{ cell: 0, before: { value: 0, notes: [] }, after: { value: 3, notes: [] } }]],
      redo: [],
      elapsedMs: 1000,
      completed: false,
      level: 'HARD',
    };
    const game = migrateGame(old);
    expect(game.version).toBe(GAME_FORMAT);
    expect(game.level).toBe('HARD');
    expect(game.undo[0].cells[0].after.value).toBe(3);
    expect(game.aids).toEqual(DEFAULT_AIDS);
    expect(game.hints).toBe(0);
    expect(migrateGame(game)).toBe(game);
  });
});
