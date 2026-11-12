import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import hardBank from '../../data/bank-hard.json';
import { makeRecord, serializeBank } from '../../engine/bank';
import { parseSolution } from '../../engine/model';
import fixtures from '../../engine/__tests__/fixtures/killer-fixtures.json';
import { readExtraBank } from '../bank';
import { GAME_FORMAT, newGame } from '../game/state';
import type { SavedGame } from '../storage';
import { backupFileName, buildBackup, parseBackup, type BackupData } from './backup';
import { filterAndSort, levelStats, libraryItems, monthlyAverages, type HistoryEntry } from './history';
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
});
