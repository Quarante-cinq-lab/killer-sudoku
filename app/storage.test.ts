/**
 * Tests de la base de données. IndexedDB n'existe pas dans Node : « fake-indexeddb » la simule fidèlement
 * (bibliothèque de développement uniquement, jamais livrée dans l'application).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './data/settings';
import { newGame } from './game/state';
import {
  addHistory,
  closeDb,
  loadAll,
  loadCurrentId,
  loadFavorites,
  loadGame,
  loadGames,
  loadHistory,
  loadSettings,
  replaceAll,
  saveCurrentId,
  saveGame,
  saveSettings,
  setFavorite,
  updateHistory,
  type SavedGame,
} from './storage';

const game = (puzzleId: string): SavedGame => ({
  ...newGame(puzzleId),
  level: 'HARD',
  startedAt: '2026-11-12',
  updatedAt: 1,
});

beforeEach(() => {
  // Chaque test part d'une base vide.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('base de données', () => {
  it('restitue exactement une partie après fermeture et réouverture', async () => {
    const g = { ...game('HRD-0001'), elapsedMs: 123_456 };
    g.values[0] = 4;
    g.notes[1] = [3, 1, 2];
    await saveGame(g);
    await saveCurrentId('HRD-0001');
    await closeDb();
    expect(await loadGame('HRD-0001')).toEqual(g);
    expect(await loadCurrentId()).toBe('HRD-0001');
  });

  it('convertit une base de la version 1 sans perdre les parties', async () => {
    const old = await openDB('killer-sudoku', 1, {
      upgrade(d) {
        d.createObjectStore('games', { keyPath: 'puzzleId' });
        d.createObjectStore('meta');
      },
    });
    const v1 = { ...game('HRD-0002'), version: undefined, undo: [[]] };
    await old.put('games', v1);
    await old.put('meta', 'HRD-0002', 'current');
    old.close();
    const games = await loadGames();
    expect(games).toHaveLength(1);
    expect(games[0].version).toBe(2);
    expect(await loadCurrentId()).toBe('HRD-0002');
    expect(await loadHistory()).toEqual([]);
  });

  it('enregistre l’historique, le ressenti, les favoris et les réglages', async () => {
    const id = await addHistory({
      puzzleId: 'HRD-0001',
      level: 'HARD',
      startedAt: '2026-11-12',
      endedAt: '2026-11-12',
      outcome: 'terminee',
      durationMs: 1000,
      hints: 0,
      checks: 0,
      feeling: null,
    });
    const [saved] = await loadHistory();
    await updateHistory({ ...saved, feeling: 'bon_niveau' });
    expect((await loadHistory())[0]).toMatchObject({ id, feeling: 'bon_niveau' });
    await setFavorite('HRD-0003', true);
    await setFavorite('HRD-0004', true);
    await setFavorite('HRD-0003', false);
    expect([...(await loadFavorites())]).toEqual(['HRD-0004']);
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ ...DEFAULT_SETTINGS, notesLayout: 'grid' });
    expect((await loadSettings()).notesLayout).toBe('grid');
  });

  it('l’import remplace toute la sauvegarde, et l’export la relit à l’identique', async () => {
    await saveGame(game('HRD-0009'));
    const data = {
      games: [game('HRD-0001')],
      history: [
        {
          id: 5,
          puzzleId: 'HRD-0001',
          level: 'HARD' as const,
          startedAt: '2026-11-01',
          endedAt: '2026-11-01',
          outcome: 'terminee' as const,
          durationMs: 99,
          hints: 1,
          checks: 2,
          feeling: 'trop_dur' as const,
        },
      ],
      favorites: ['HRD-0001'],
      settings: { ...DEFAULT_SETTINGS, theme: 'light' as const },
      currentId: 'HRD-0001',
      extraPuzzles: [],
    };
    await replaceAll(data);
    expect(await loadAll()).toEqual(data);
  });
});
