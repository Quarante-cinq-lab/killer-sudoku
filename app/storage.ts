/**
 * Sauvegarde locale dans IndexedDB, la base de données du navigateur (section 10).
 *
 * Contenu (« magasins ») :
 * - games : une partie par grille commencée (chiffres, notes, historique d'annulation, temps…) ;
 * - history : une ligne par partie terminée ou abandonnée ;
 * - favorites : les grilles favorites ;
 * - meta : la dernière partie ouverte et les réglages ;
 * - extraPuzzles : les grilles importées en complément de la banque livrée.
 *
 * Le schéma est versionné : à l'ouverture, une base d'une version précédente est complétée
 * automatiquement, sans rien perdre (migration).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Level, PuzzleRecord } from '../engine/model';
import type { BackupData } from './data/backup';
import type { HistoryEntry } from './data/history';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from './data/settings';
import { migrateGame, type GameState } from './game/state';

export interface SavedGame extends GameState {
  level: Level;
  /** Date de début (AAAA-MM-JJ). */
  startedAt: string;
  /** Dernière modification (millisecondes depuis 1970) : sert à trouver la plus ancienne partie. */
  updatedAt: number;
}

interface Schema extends DBSchema {
  games: { key: string; value: SavedGame };
  meta: { key: string; value: unknown };
  history: { key: number; value: HistoryEntry; indexes: { puzzleId: string } };
  favorites: { key: string; value: { puzzleId: string; addedAt: number } };
  extraPuzzles: { key: string; value: PuzzleRecord };
}

const DB_NAME = 'killer-sudoku';
export const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      // Version 1 (étapes 4 et 5) : parties en cours et dernière partie ouverte.
      if (oldVersion < 1) {
        database.createObjectStore('games', { keyPath: 'puzzleId' });
        database.createObjectStore('meta');
      }
      // Version 2 (étape 6) : historique, favoris, grilles importées. Les parties existantes sont gardées.
      if (oldVersion < 2) {
        const history = database.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        history.createIndex('puzzleId', 'puzzleId');
        database.createObjectStore('favorites', { keyPath: 'puzzleId' });
        database.createObjectStore('extraPuzzles', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

/** Ferme la base (utile aux tests, qui repartent d'une base neuve). */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function loadGames(): Promise<SavedGame[]> {
  // Les parties sauvegardées par une version précédente sont converties au format actuel.
  return (await (await db()).getAll('games')).map(migrateGame);
}

export async function loadGame(puzzleId: string): Promise<SavedGame | null> {
  const game = await (await db()).get('games', puzzleId);
  return game ? migrateGame(game) : null;
}

export async function saveGame(game: SavedGame): Promise<void> {
  await (await db()).put('games', game);
}

export async function loadCurrentId(): Promise<string | null> {
  const id = await (await db()).get('meta', 'current');
  return typeof id === 'string' ? id : null;
}

export async function saveCurrentId(puzzleId: string): Promise<void> {
  await (await db()).put('meta', puzzleId, 'current');
}

export async function loadSettings(): Promise<Settings> {
  const raw = await (await db()).get('meta', 'settings');
  return raw === undefined ? { ...DEFAULT_SETTINGS } : parseSettings(raw);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('meta', settings, 'settings');
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  return (await db()).getAll('history');
}

/** Ajoute une ligne d'historique et renvoie son numéro (pour y ajouter le ressenti ensuite). */
export async function addHistory(entry: HistoryEntry): Promise<number> {
  const { id: _ignored, ...rest } = entry;
  void _ignored;
  return (await db()).add('history', rest as HistoryEntry);
}

export async function updateHistory(entry: HistoryEntry): Promise<void> {
  await (await db()).put('history', entry);
}

export async function loadFavorites(): Promise<Set<string>> {
  return new Set(await (await db()).getAllKeys('favorites'));
}

export async function setFavorite(puzzleId: string, favorite: boolean): Promise<void> {
  const database = await db();
  if (favorite) await database.put('favorites', { puzzleId, addedAt: Date.now() });
  else await database.delete('favorites', puzzleId);
}

export async function loadExtraPuzzles(): Promise<PuzzleRecord[]> {
  return (await db()).getAll('extraPuzzles');
}

export async function addExtraPuzzles(records: readonly PuzzleRecord[]): Promise<void> {
  const tx = (await db()).transaction('extraPuzzles', 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

/** Tout ce qu'il faut pour un export de la sauvegarde. */
export async function loadAll(): Promise<BackupData> {
  const [games, history, favorites, settings, currentId, extraPuzzles] = await Promise.all([
    loadGames(),
    loadHistory(),
    loadFavorites(),
    loadSettings(),
    loadCurrentId(),
    loadExtraPuzzles(),
  ]);
  return { games, history, favorites: [...favorites], settings, currentId, extraPuzzles };
}

/** Remplace toute la sauvegarde par celle d'un fichier importé, en une seule opération. */
export async function replaceAll(data: BackupData): Promise<void> {
  const database = await db();
  const stores = ['games', 'history', 'favorites', 'meta', 'extraPuzzles'] as const;
  const tx = database.transaction(stores, 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await Promise.all([
    ...data.games.map((g) => tx.objectStore('games').put(g)),
    ...data.history.map((h) => tx.objectStore('history').put(h)),
    ...data.favorites.map((puzzleId) => tx.objectStore('favorites').put({ puzzleId, addedAt: Date.now() })),
    ...data.extraPuzzles.map((p) => tx.objectStore('extraPuzzles').put(p)),
    tx.objectStore('meta').put(data.settings, 'settings'),
    ...(data.currentId ? [tx.objectStore('meta').put(data.currentId, 'current')] : []),
  ]);
  await tx.done;
}

/**
 * Demande au navigateur de ne pas effacer nos données (Safari peut vider le stockage d'un site peu
 * utilisé). Sans effet si le navigateur refuse : l'export de la sauvegarde sert alors de filet.
 */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Ignoré : la demande est facultative.
  }
}
