/**
 * Historique des parties, statut des grilles, statistiques et tri de la bibliothèque (sections 8 et 10).
 * Fonctions pures : elles travaillent sur des listes déjà chargées depuis la base.
 */
import type { Level, PuzzleRecord } from '../../engine/model';

/** Ressenti donné en fin de partie (section 5.4). */
export type Feeling = 'trop_facile' | 'bon_niveau' | 'trop_dur';

/** Une ligne d'historique : une partie terminée, ou abandonnée (recommencée avant la fin). */
export interface HistoryEntry {
  id?: number;
  puzzleId: string;
  level: Level;
  /** Dates AAAA-MM-JJ. */
  startedAt: string;
  endedAt: string;
  outcome: 'terminee' | 'abandonnee';
  durationMs: number;
  hints: number;
  checks: number;
  feeling: Feeling | null;
}

/** Ce qu'il faut savoir d'une partie en cours pour la bibliothèque. */
export interface GameSummary {
  puzzleId: string;
  completed: boolean;
  elapsedMs: number;
  updatedAt: number;
}

export type PuzzleStatus = 'jamais' | 'en_cours' | 'terminee';

export interface LibraryItem {
  record: PuzzleRecord;
  status: PuzzleStatus;
  favorite: boolean;
  /** Temps de la partie en cours, s'il y en a une. */
  elapsedMs: number | null;
  /** Meilleur temps parmi les parties terminées. */
  bestMs: number | null;
  /** Date de la dernière partie (millisecondes), ou 0. */
  lastPlayed: number;
}

/** Statut et informations de chaque grille, pour la bibliothèque. */
export function libraryItems(
  records: readonly PuzzleRecord[],
  games: readonly GameSummary[],
  history: readonly HistoryEntry[],
  favorites: ReadonlySet<string>,
): LibraryItem[] {
  const gameOf = new Map(games.map((g) => [g.puzzleId, g]));
  const best = new Map<string, number>();
  const last = new Map<string, number>();
  for (const h of history) {
    if (h.outcome === 'terminee') best.set(h.puzzleId, Math.min(best.get(h.puzzleId) ?? Infinity, h.durationMs));
    last.set(h.puzzleId, Math.max(last.get(h.puzzleId) ?? 0, Date.parse(h.endedAt) || 0));
  }
  return records.map((record) => {
    const game = gameOf.get(record.id);
    const finished = best.has(record.id);
    const inProgress = game !== undefined && !game.completed;
    return {
      record,
      status: inProgress ? 'en_cours' : finished || game?.completed ? 'terminee' : 'jamais',
      favorite: favorites.has(record.id),
      elapsedMs: inProgress ? game.elapsedMs : null,
      bestMs: best.get(record.id) ?? null,
      lastPlayed: Math.max(last.get(record.id) ?? 0, game?.updatedAt ?? 0),
    };
  });
}

export type LibrarySort = 'numero' | 'meilleur_temps' | 'derniere_partie' | 'score';

export interface LibraryFilter {
  level: Level | null;
  status: PuzzleStatus | null;
  favoritesOnly: boolean;
}

/** Filtre et trie la bibliothèque (section 8.2). Les grilles sans meilleur temps vont à la fin. */
export function filterAndSort(items: readonly LibraryItem[], filter: LibraryFilter, sort: LibrarySort): LibraryItem[] {
  const kept = items.filter(
    (i) =>
      (filter.level === null || i.record.level === filter.level) &&
      (filter.status === null || i.status === filter.status) &&
      (!filter.favoritesOnly || i.favorite),
  );
  const byNumber = (a: LibraryItem, b: LibraryItem): number =>
    a.record.level === b.record.level ? a.record.number - b.record.number : a.record.id.localeCompare(b.record.id);
  const compare: Record<LibrarySort, (a: LibraryItem, b: LibraryItem) => number> = {
    numero: byNumber,
    meilleur_temps: (a, b) => (a.bestMs ?? Infinity) - (b.bestMs ?? Infinity) || byNumber(a, b),
    derniere_partie: (a, b) => b.lastPlayed - a.lastPlayed || byNumber(a, b),
    score: (a, b) => a.record.score - b.record.score || byNumber(a, b),
  };
  return [...kept].sort(compare[sort]);
}

export interface LevelStats {
  level: Level;
  finished: number;
  averageMs: number | null;
  medianMs: number | null;
  bestMs: number | null;
  /** Pourcentage de parties terminées sans indice (0 à 100). */
  withoutHintPercent: number | null;
  /** Nombre de parties terminées sans indice d'affilée, en partant de la plus récente. */
  streakWithoutHint: number;
}

const finishedOf = (history: readonly HistoryEntry[], level: Level): HistoryEntry[] =>
  history
    .filter((h) => h.outcome === 'terminee' && h.level === level)
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt) || (a.id ?? 0) - (b.id ?? 0));

/** Statistiques d'un niveau (section 10). */
export function levelStats(history: readonly HistoryEntry[], level: Level): LevelStats {
  const done = finishedOf(history, level);
  const times = done.map((h) => h.durationMs).sort((a, b) => a - b);
  const n = times.length;
  let streak = 0;
  for (let i = done.length - 1; i >= 0 && done[i].hints === 0; i--) streak++;
  return {
    level,
    finished: n,
    averageMs: n ? times.reduce((s, t) => s + t, 0) / n : null,
    medianMs: n ? (n % 2 ? times[(n - 1) / 2] : (times[n / 2 - 1] + times[n / 2]) / 2) : null,
    bestMs: n ? times[0] : null,
    withoutHintPercent: n ? Math.round((100 * done.filter((h) => h.hints === 0).length) / n) : null,
    streakWithoutHint: streak,
  };
}

/** Temps moyen par mois (AAAA-MM) des parties terminées d'un niveau, dans l'ordre chronologique. */
export function monthlyAverages(
  history: readonly HistoryEntry[],
  level: Level,
): { month: string; averageMs: number; count: number }[] {
  const months = new Map<string, number[]>();
  for (const h of finishedOf(history, level)) {
    const month = h.endedAt.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), h.durationMs]);
  }
  return [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => ({ month, averageMs: list.reduce((s, t) => s + t, 0) / list.length, count: list.length }));
}
