/**
 * Export et import de la sauvegarde (section 10) : un fichier JSON avec la progression, l'historique, les
 * favoris et les réglages. La banque livrée avec l'application n'y figure pas ; les grilles importées en
 * complément y sont, pour que l'historique qui s'y rapporte reste utilisable.
 */
import { parsePuzzleRecord, type PuzzleRecord } from '../../engine/model';
import { migrateGame } from '../game/state';
import type { SavedGame } from '../storage';
import type { HistoryEntry } from './history';
import { parseSettings, type Settings } from './settings';

export const BACKUP_FORMAT = 'killer-sudoku-sauvegarde';
/** Version du schéma de la sauvegarde exportée. */
export const BACKUP_VERSION = 1;

export interface BackupData {
  games: SavedGame[];
  history: HistoryEntry[];
  favorites: string[];
  settings: Settings;
  currentId: string | null;
  extraPuzzles: PuzzleRecord[];
}

export interface Backup extends BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
}

export function buildBackup(data: BackupData, appVersion: string, exportedAt: string): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, appVersion, ...data };
}

/** Nom du fichier exporté (déjà exclu de Git par .gitignore). */
export const backupFileName = (date: string): string => `killer-sudoku-sauvegarde-${date}.json`;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Lit et vérifie un fichier de sauvegarde. Lève une erreur (en français) s'il n'est pas valable. */
export function parseBackup(raw: unknown): BackupData {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde de Killer Sudoku.');
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new Error('Cette sauvegarde vient d’une version plus récente de l’application.');
  }
  const list = (key: string): unknown[] => {
    const value = raw[key];
    if (!Array.isArray(value)) throw new Error(`Sauvegarde incomplète : « ${key} » manquant.`);
    return value;
  };
  const games = list('games').map((g) => {
    if (!isObject(g) || typeof g.puzzleId !== 'string' || !Array.isArray(g.values) || g.values.length !== 81) {
      throw new Error('Sauvegarde abîmée : une partie est illisible.');
    }
    return migrateGame(g as unknown as SavedGame);
  });
  const history = list('history').map((h) => {
    if (!isObject(h) || typeof h.puzzleId !== 'string' || typeof h.durationMs !== 'number') {
      throw new Error('Sauvegarde abîmée : une ligne d’historique est illisible.');
    }
    return h as unknown as HistoryEntry;
  });
  const favorites = list('favorites').filter((f): f is string => typeof f === 'string');
  const extraPuzzles = (Array.isArray(raw.extraPuzzles) ? raw.extraPuzzles : []).map(parsePuzzleRecord);
  return {
    games,
    history,
    favorites,
    settings: parseSettings(raw.settings),
    currentId: typeof raw.currentId === 'string' ? raw.currentId : null,
    extraPuzzles,
  };
}
