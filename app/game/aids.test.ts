import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import { parseSolution } from '../../engine/model';
import hardBank from '../../data/bank-hard.json';
import {
  allDistinct,
  finderLines,
  conflictCells,
  contradicts,
  quickAction,
  unitCells,
  wrongCells,
} from './aids';
import {
  GAME_FORMAT,
  DEFAULT_AIDS,
  migrateGame,
  newGame,
  PURIST_AIDS,
  setAids,
  setDigit,
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

describe('somme et combinaisons rapides (« + » et « ? »)', () => {
  const [a, b] = record.cages;
  const anchorA = Math.min(...a.cells);
  const anchorB = Math.min(...b.cells);
  const anchors = new Set(record.cages.map((c) => Math.min(...c.cells)));
  const plain = Array.from({ length: 81 }, (_, i) => i).filter((c) => !anchors.has(c));

  it('« + » : plusieurs cases portant une somme de cage donnent le total de ces sommes', () => {
    expect(quickAction(record, [anchorA, plain[0], anchorB], anchorB)).toEqual({
      kind: 'sum',
      total: a.sum + b.sum,
    });
  });

  it('« ? » : plusieurs cases mais une seule somme, sur cette somme et les cases sélectionnées', () => {
    const selection = [anchorA, plain[0], plain[1]];
    expect(quickAction(record, selection, plain[1])).toEqual({
      kind: 'combinations',
      sum: a.sum,
      cells: selection,
    });
  });

  it('« ? » : une seule case ouvre les combinaisons de toute sa cage', () => {
    const cell = plain[0];
    const cage = record.cages.find((c) => c.cells.includes(cell));
    expect(quickAction(record, [cell], cell)).toEqual({
      kind: 'combinations',
      sum: cage?.sum,
      cells: cage?.cells,
    });
  });

  it('rien sans somme de cage dans une sélection de plusieurs cases, ni sans case active', () => {
    expect(quickAction(record, [plain[0], plain[1]], plain[1])).toBeNull();
    expect(quickAction(record, [anchorA, anchorB], null)).toBeNull();
    expect(quickAction(record, [], null)).toBeNull();
  });
});

describe('combinaisons', () => {
  it('grise les combinaisons qui contredisent les chiffres posés', () => {
    const values = empty();
    values[0] = 4;
    expect(contradicts([1, 4, 8], [0, 1, 2], values)).toBe(false);
    expect(contradicts([1, 3, 9], [0, 1, 2], values)).toBe(true);
    expect(contradicts([1, 3, 9], [1, 2], values)).toBe(false); // la case 0 n'est pas concernée
  });

  it('calculatrice : 25 en 4 cases, avec un chiffre obligatoire et un exclu', () => {
    expect(finderLines(25, 4, 0, 0)).toHaveLength(6);
    expect(finderLines(25, 4, 1 << 8, 1 << 0)).toEqual(
      finderLines(25, 4, 1 << 8, 1 << 0).filter((d) => d.includes(9) && !d.includes(1)),
    );
    expect(finderLines(10, 0, 0, 0)).toEqual([]);
  });
});

describe('cages virtuelles', () => {
  it('une partie au format 3 se charge : cages gardées et visibles, combinaisons barrées oubliées', () => {
    const cage = { id: 1, sum: 12, cells: [2, 3] };
    const hidden = { id: 2, sum: 9, cells: [4, 5], hidden: true };
    const write = { cell: 0, before: { value: 0, notes: [] }, after: { value: 3, notes: [] } };
    const old = {
      ...fresh(),
      version: 3,
      level: 'HARD',
      struck: { c0: [0b11], v1: [0b100001] },
      virtualCages: [cage, hidden],
      undo: [
        {
          cells: [],
          extras: {
            before: { struck: {}, virtualCages: [cage] },
            after: { struck: {}, virtualCages: [cage, hidden] },
          },
        },
        {
          cells: [],
          extras: {
            before: { struck: {}, virtualCages: [cage, hidden] },
            after: { struck: { c0: [0b11] }, virtualCages: [cage, hidden] },
          },
        },
        { cells: [write] },
      ],
      redo: [],
    };
    const game = migrateGame(old);
    expect(game.version).toBe(GAME_FORMAT);
    expect(game.level).toBe('HARD');
    expect('struck' in game).toBe(false);
    expect(game.virtualCages).toEqual([cage, { id: 2, sum: 9, cells: [4, 5] }]);
    expect(game.undo[2]).toEqual({ cells: [write] });
    expect(JSON.stringify(game.undo)).not.toMatch(/struck|hidden/);
    // « Annuler » rejoue toujours l'historique ancien, cages virtuelles comprises.
    const back = undo(undo(undo(game)));
    expect(back.values[0]).toBe(0);
    expect(back.virtualCages).toEqual([cage]);
    expect(redo(redo(redo(back))).virtualCages).toHaveLength(2);
    expect(migrateGame(game)).toBe(game);
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
