/**
 * Relecture des grilles importées au démarrage : entrées abîmées ignorées, et grille importée qui change
 * d'identifiant (avec sa partie et son historique) quand la banque livrée a repris son numéro.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRecord } from '../engine/bank';
import fixtures from '../engine/__tests__/fixtures/killer-fixtures.json';
import { parseSolution } from '../engine/model';
import { BANKS, findPuzzle, IMPORT_PREFIX } from './bank';
import { restoreExtraPuzzles } from './extras';
import { newGame } from './game/state';
import {
  addExtraPuzzles,
  addHistory,
  closeDb,
  loadCurrentId,
  loadExtraPuzzles,
  loadFavorites,
  loadGames,
  loadHistory,
  saveCurrentId,
  saveGame,
  setFavorite,
  type SavedGame,
} from './storage';

const fixture = fixtures.fixtures.find((f) => f.expectedCount === 1);
if (!fixture) throw new Error('grille de test manquante');
const shipped = BANKS.HARD[0];
/** Grille importée autrefois sous le numéro que la banque livrée utilise maintenant pour une autre grille. */
const imported = makeRecord(
  'HARD',
  shipped.number,
  { cages: fixture.cages },
  parseSolution(fixture.solution),
  { score: 200, techniques: {}, entryPoints: 3 },
  '2026-11-15',
);
const renamed = `${IMPORT_PREFIX}${shipped.id}`;

const game = (puzzleId: string): SavedGame => ({
  ...newGame(puzzleId),
  level: 'HARD',
  startedAt: '2026-11-15',
  updatedAt: 1,
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('grilles importées au démarrage', () => {
  it('ignore une grille enregistrée abîmée au lieu de bloquer le démarrage', async () => {
    const other = { ...imported, id: 'HRD-0900', number: 900 };
    await addExtraPuzzles([other, { id: 'HRD-0901', level: 'INCONNU' } as never]);
    expect((await loadExtraPuzzles()).map((p) => p.id)).toEqual(['HRD-0900']);
    await expect(restoreExtraPuzzles()).resolves.toBeUndefined();
    expect(findPuzzle('HRD-0900')).toBeDefined();
  });

  it('déplace la grille importée et tout ce qui s’y rapporte quand la banque livrée a repris son numéro', async () => {
    expect(imported.id).toBe(shipped.id);
    await addExtraPuzzles([imported]);
    const played = { ...game(shipped.id), elapsedMs: 42_000 };
    await saveGame(played);
    await saveCurrentId(shipped.id);
    await setFavorite(shipped.id, true);
    await addHistory({
      puzzleId: shipped.id,
      level: 'HARD',
      startedAt: '2026-11-15',
      endedAt: '2026-11-15',
      outcome: 'abandonnee',
      durationMs: 1000,
      hints: 0,
      checks: 0,
      feeling: null,
    });

    await restoreExtraPuzzles();

    expect((await loadExtraPuzzles()).map((p) => p.id)).toEqual([renamed]);
    expect(await loadGames()).toEqual([{ ...played, puzzleId: renamed }]);
    expect(await loadCurrentId()).toBe(renamed);
    expect([...(await loadFavorites())]).toEqual([renamed]);
    expect((await loadHistory()).map((h) => h.puzzleId)).toEqual([renamed]);
    // La grille livrée garde son identifiant ; la grille importée reste jouable sous le nouveau.
    expect(findPuzzle(shipped.id)).toBe(shipped);
    expect(findPuzzle(renamed)?.cages).toEqual(imported.cages);

    // Au démarrage suivant, plus rien à corriger.
    await restoreExtraPuzzles();
    expect((await loadGames()).map((g) => g.puzzleId)).toEqual([renamed]);
  });
});
