import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import hardBank from '../../data/bank-hard.json';
import { makeRecord, serializeBank } from '../../engine/bank';
import { parseSolution } from '../../engine/model';
import fixtures from '../../engine/__tests__/fixtures/killer-fixtures.json';
import { conflictingIds, IMPORT_PREFIX, readExtraBank } from '../bank';
import { GAME_FORMAT, newGame } from '../game/state';
import type { SavedGame } from '../storage';
import { backupFileName, buildBackup, parseBackup, type BackupData } from './backup';
import {
  filterAndSort,
  historyEntry,
  levelStats,
  libraryItems,
  monthlyAverages,
  STARTED_AFTER_MS,
  today,
  wasStarted,
  type HistoryEntry,
} from './history';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

const records = parseBank(hardBank).puzzles.slice(0, 4);
const MIN = 60_000;

const entry = (puzzleId: string, endedAt: string, minutes: number, hints = 0, id?: number): HistoryEntry => ({
  ...(id === undefined ? {} : { id }),
  puzzleId,
  level: 'HARD',
  startedAt: endedAt,
  endedAt,
  outcome: 'terminee',
  durationMs: minutes * MIN,
  hints,
  checks: 0,
  feeling: null,
});

const game = (puzzleId: string, completed = false): SavedGame => ({
  ...newGame(puzzleId),
  completed,
  elapsedMs: 5 * MIN,
  level: 'HARD',
  startedAt: '2026-11-12',
  updatedAt: Date.parse('2026-11-12'),
});

describe('bibliothèque', () => {
  const history = [entry(records[0].id, '2026-10-01', 30), entry(records[0].id, '2026-11-01', 22), entry(records[1].id, '2026-11-05', 40)];
  const items = libraryItems(records, [game(records[2].id)], history, new Set([records[1].id]));

  it('donne le statut de chaque grille et son meilleur temps', () => {
    expect(items.map((i) => i.status)).toEqual(['terminee', 'terminee', 'en_cours', 'jamais']);
    expect(items[0].bestMs).toBe(22 * MIN);
    expect(items[2].elapsedMs).toBe(5 * MIN);
    expect(items[1].favorite).toBe(true);
  });

  it('une grille terminée qu’on rejoue est « en cours »', () => {
    const replay = libraryItems(records, [game(records[0].id)], history, new Set());
    expect(replay[0].status).toBe('en_cours');
    expect(replay[0].bestMs).toBe(22 * MIN);
  });

  it('filtre par statut et favoris, trie par meilleur temps ou dernière partie', () => {
    const none = { level: null, status: null, favoritesOnly: false };
    expect(filterAndSort(items, { ...none, status: 'terminee' }, 'numero')).toHaveLength(2);
    expect(filterAndSort(items, { ...none, favoritesOnly: true }, 'numero').map((i) => i.record.id)).toEqual([records[1].id]);
    expect(filterAndSort(items, none, 'meilleur_temps')[0].record.id).toBe(records[0].id);
    expect(filterAndSort(items, none, 'meilleur_temps').at(-1)?.bestMs).toBeNull();
    expect(filterAndSort(items, none, 'derniere_partie')[0].record.id).toBe(records[2].id);
    expect(filterAndSort(items, { ...none, level: 'EXPERT' }, 'numero')).toHaveLength(0);
  });
});

describe('fin de partie', () => {
  it('une partie recommencée est « entamée » après une action ou plus d’une minute de jeu', () => {
    const g = game(records[0].id);
    expect(wasStarted(g, 0)).toBe(false);
    expect(wasStarted(g, STARTED_AFTER_MS)).toBe(false);
    expect(wasStarted(g, STARTED_AFTER_MS + 1)).toBe(true);
    expect(wasStarted({ ...g, undo: [{ cells: [] }] }, 0)).toBe(true);
  });

  it('écrit la ligne d’historique de la partie', () => {
    const g = { ...game(records[0].id), hints: 2, checks: 1, errors: 1 };
    expect(historyEntry(g, 'abandonnee', 90_000, '2026-11-15')).toEqual({
      puzzleId: records[0].id,
      level: 'HARD',
      startedAt: '2026-11-12',
      endedAt: '2026-11-15',
      outcome: 'abandonnee',
      durationMs: 90_000,
      hints: 2,
      checks: 1,
      errors: 1,
      feeling: null,
    });
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('statistiques', () => {
  const history = [
    entry('a', '2026-10-01', 30, 1, 1),
    entry('b', '2026-10-20', 20, 0, 2),
    entry('c', '2026-11-02', 25, 0, 3),
    entry('d', '2026-11-08', 35, 0, 4),
    { ...entry('e', '2026-11-09', 99, 0, 5), outcome: 'abandonnee' as const },
  ];

  it('calcule moyenne, médiane, meilleur temps et parties sans indice', () => {
    const stats = levelStats(history, 'HARD');
    expect(stats.finished).toBe(4);
    expect(stats.averageMs).toBe(27.5 * MIN);
    expect(stats.medianMs).toBe(27.5 * MIN);
    expect(stats.bestMs).toBe(20 * MIN);
    expect(stats.withoutHintPercent).toBe(75);
    expect(stats.streakWithoutHint).toBe(3);
  });

  it('ne compte rien pour un niveau jamais joué', () => {
    expect(levelStats(history, 'EXPERT')).toMatchObject({ finished: 0, averageMs: null, streakWithoutHint: 0 });
  });

  it('donne le temps moyen par mois', () => {
    expect(monthlyAverages(history, 'HARD')).toEqual([
      { month: '2026-10', averageMs: 25 * MIN, count: 2 },
      { month: '2026-11', averageMs: 30 * MIN, count: 2 },
    ]);
  });
});

describe('réglages', () => {
  it('reprend la valeur par défaut de tout réglage inconnu ou abîmé', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const s = parseSettings({ theme: 'dark', cageColor: 'violet', defaultAids: { hint: false, autre: 1 } });
    expect(s.theme).toBe('dark');
    expect(s.cageColor).toBe('mauve');
    expect(s.defaultAids.hint).toBe(false);
    expect(s.defaultAids.conflicts).toBe(true);
    expect('autre' in s.defaultAids).toBe(false);
  });
});

describe('export et import de la sauvegarde', () => {
  const data: BackupData = {
    games: [game(records[0].id)],
    history: [entry(records[1].id, '2026-11-01', 21, 0, 7)],
    favorites: [records[2].id],
    settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
    currentId: records[0].id,
    extraPuzzles: [records[3]],
  };

  it('se relit à l’identique', () => {
    const file = JSON.parse(JSON.stringify(buildBackup(data, '0.8.0', '2026-11-12'))) as unknown;
    expect(parseBackup(file)).toEqual(data);
    expect(backupFileName('2026-11-12')).toBe('killer-sudoku-sauvegarde-2026-11-12.json');
  });

  it('refuse un fichier qui n’est pas une sauvegarde, ou d’une version plus récente', () => {
    expect(() => parseBackup({ hello: 1 })).toThrow(/pas une sauvegarde/);
    expect(() => parseBackup({ ...buildBackup(data, '9', 'x'), version: 99 })).toThrow(/plus récente/);
    expect(() => parseBackup({ ...buildBackup(data, '9', 'x'), games: [{ puzzleId: 'x' }] })).toThrow(/illisible/);
  });

  it('convertit les parties d’une ancienne sauvegarde', () => {
    const old = { ...game(records[0].id), version: undefined, undo: [[]] } as unknown as SavedGame;
    const parsed = parseBackup({ ...buildBackup({ ...data, games: [old] }, '0.7.0', 'x') });
    expect(parsed.games[0].version).toBe(GAME_FORMAT);
    expect(parsed.games[0].undo[0]).toEqual({ cells: [] });
  });

  it('relit une sauvegarde exportée avant le retrait des combinaisons barrées (parties au format 3)', () => {
    const cage = { id: 1, sum: 12, cells: [2, 3], hidden: true };
    const old = { ...game(records[0].id), version: 3, struck: { c0: [3] }, virtualCages: [cage] } as unknown as SavedGame;
    const parsed = parseBackup(JSON.parse(JSON.stringify(buildBackup({ ...data, games: [old] }, '0.14.0', 'x'))));
    expect(parsed.games[0].version).toBe(GAME_FORMAT);
    expect('struck' in parsed.games[0]).toBe(false);
    expect(parsed.games[0].virtualCages).toEqual([{ id: 1, sum: 12, cells: [2, 3] }]);
  });
});

describe('import d’une banque complémentaire', () => {
  const fixture = fixtures.fixtures.find((f) => f.expectedCount === 1);
  if (!fixture) throw new Error('grille de test manquante');
  const fresh = makeRecord('HARD', 900, { cages: fixture.cages }, parseSolution(fixture.solution), { score: 200, techniques: {}, entryPoints: 3 }, '2026-11-12');
  const file = (puzzles: unknown[]) => JSON.parse(serializeBank({ version: 1, level: 'HARD', puzzles: puzzles as never })) as unknown;

  it('ajoute une grille nouvelle', () => {
    const result = readExtraBank(file([fresh]), records);
    expect(result.added.map((p) => p.id)).toEqual(['HRD-0900']);
    expect(result.skipped).toBe(0);
  });

  it('écarte un identifiant déjà présent, ou une grille déjà connue sous un autre numéro', () => {
    const copy = { ...records[1], id: 'HRD-0901', number: 901 };
    const result = readExtraBank(file([records[0], copy, fresh]), records);
    expect(result.added.map((p) => p.id)).toEqual(['HRD-0900']);
    expect(result.skipped).toBe(2);
  });

  it('refuse un fichier qui n’est pas une banque', () => {
    expect(() => readExtraBank({ puzzles: 3 }, records)).toThrow();
  });

  it('refuse une grille qui a plusieurs solutions', () => {
    const multiple = fixtures.fixtures.find((f) => f.expectedCount > 1);
    if (!multiple) throw new Error('grille de test manquante');
    const ambiguous = makeRecord('HARD', 902, { cages: multiple.cages }, parseSolution(multiple.solution), { score: 200, techniques: {}, entryPoints: 3 }, '2026-11-15');
    const result = readExtraBank(file([ambiguous, fresh]), records);
    expect(result.added.map((p) => p.id)).toEqual(['HRD-0900']);
    expect(result.rejected).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('donne un identifiant libre à une grille nouvelle dont le numéro est déjà pris', () => {
    const sameNumber = { ...fresh, id: records[0].id, number: records[0].number };
    const result = readExtraBank(file([sameNumber]), records);
    expect(result.added.map((p) => p.id)).toEqual([`${IMPORT_PREFIX}${records[0].id}`]);
    expect(result.added[0].cages).toEqual(fresh.cages);
    expect(readExtraBank(file([sameNumber]), [...records, ...result.added]).skipped).toBe(1);
  });
});

describe('grilles importées dont le numéro a été repris par la banque livrée', () => {
  const fixture = fixtures.fixtures.find((f) => f.expectedCount === 1);
  if (!fixture) throw new Error('grille de test manquante');
  const imported = makeRecord('HARD', records[0].number, { cages: fixture.cages }, parseSolution(fixture.solution), { score: 200, techniques: {}, entryPoints: 3 }, '2026-11-15');

  it('change l’identifiant de la grille importée, pas celui de la grille livrée', () => {
    expect(imported.id).toBe(records[0].id);
    expect(conflictingIds([imported], records)).toEqual(new Map([[records[0].id, `${IMPORT_PREFIX}${records[0].id}`]]));
  });

  it('ne change rien si c’est exactement la même grille, ou si le numéro est libre', () => {
    expect(conflictingIds([{ ...records[0] }, { ...imported, id: 'HRD-0900', number: 900 }], records).size).toBe(0);
  });

  it('choisit un identifiant encore libre', () => {
    const already = { ...records[1], id: `${IMPORT_PREFIX}${records[0].id}` };
    expect(conflictingIds([imported, already], records).get(records[0].id)).toBe(`${IMPORT_PREFIX}2-${records[0].id}`);
  });
});
