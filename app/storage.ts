/**
 * Sauvegarde locale dans IndexedDB, la base de données du navigateur (section 10).
 * Version minimale de l'étape 4 : une sauvegarde par grille commencée, et le souvenir de la dernière
 * partie ouverte. Le schéma est versionné : l'étape 6 ajoutera l'historique et les statistiques.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Level } from '../engine/model';
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
  meta: { key: string; value: string };
}

const DB_NAME = 'killer-sudoku';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('games', { keyPath: 'puzzleId' });
      database.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadGames(): Promise<SavedGame[]> {
  // Les parties sauvegardées par une version précédente sont converties au format actuel.
  return (await (await db()).getAll('games')).map(migrateGame);
}

export async function saveGame(game: SavedGame): Promise<void> {
  await (await db()).put('games', game);
}

export async function loadCurrentId(): Promise<string | null> {
  return (await (await db()).get('meta', 'current')) ?? null;
}

export async function saveCurrentId(puzzleId: string): Promise<void> {
  await (await db()).put('meta', puzzleId, 'current');
}

/**
 * Demande au navigateur de ne pas effacer nos données (Safari peut vider le stockage d'un site peu
 * utilisé). Sans effet si le navigateur refuse : l'export de la sauvegarde viendra à l'étape 6.
 */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Ignoré : la demande est facultative.
  }
}
