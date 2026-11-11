/**
 * Bibliothèque (section 8.2) : toutes les grilles, regroupées par niveau, avec miniature, numéro et statut.
 * Filtres (niveau, statut, favoris), tris, et pour chaque grille : jouer ou reprendre, recommencer,
 * favori, historique des parties. Aucune grille ne disparaît jamais de la bibliothèque.
 */
import { memo, useMemo, useState } from 'react';
import { LEVELS, type Level, type PuzzleRecord } from '../../engine/model';
import { TEXTS } from '../../texts/fr';
import {
  filterAndSort,
  type HistoryEntry,
  type LibraryFilter,
  type LibraryItem,
  type LibrarySort,
  type PuzzleStatus,
} from '../data/history';
import { formatTime } from '../game/clock';
import { cageSegments, GRID, segmentsPath } from '../grid/geometry';
import { Icon } from '../icons';

const L = TEXTS.library;
const G = TEXTS.game;

/** Petite image de la grille : les cages seulement. */
export const Miniature = memo(function Miniature({ record }: { record: PuzzleRecord }) {
  const path = useMemo(
    () => record.cages.map((_, i) => segmentsPath(cageSegments(record, i, 10))).join(''),
    [record],
  );
  return (
    <svg className="miniature" viewBox={`0 0 ${GRID} ${GRID}`} aria-hidden="true">
      <rect width={GRID} height={GRID} className="grid-bg" />
      <path d={path} className="miniature-cages" />
      <path d="M300 0V900M600 0V900M0 300H900M0 600H900" className="miniature-boxes" />
      <rect width={GRID} height={GRID} className="miniature-frame" />
    </svg>
  );
});

interface Props {
  items: readonly LibraryItem[];
  history: readonly HistoryEntry[];
  onBack: () => void;
  onPlay: (item: LibraryItem) => void;
  onRestart: (item: LibraryItem) => void;
  onToggleFavorite: (puzzleId: string) => void;
}

function statusText(item: LibraryItem): string {
  if (item.status === 'en_cours' && item.elapsedMs !== null) return L.inProgress(formatTime(item.elapsedMs));
  if (item.status === 'terminee' && item.bestMs !== null) return L.best(formatTime(item.bestMs));
  return L.status[item.status];
}

export function LibraryScreen({ items, history, onBack, onPlay, onRestart, onToggleFavorite }: Props) {
  const [filter, setFilter] = useState<LibraryFilter>({ level: null, status: null, favoritesOnly: false });
  const [sort, setSort] = useState<LibrarySort>('numero');
  const [chosen, setChosen] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const shown = filterAndSort(items, filter, sort);
  const levels = LEVELS.filter((level) => items.some((i) => i.record.level === level));
  const item = items.find((i) => i.record.id === chosen) ?? null;
  const close = () => {
    setChosen(null);
    setShowHistory(false);
    setConfirmRestart(false);
  };

  const groups: { level: Level; list: LibraryItem[] }[] =
    sort === 'numero'
      ? levels
          .map((level) => ({ level, list: shown.filter((i) => i.record.level === level) }))
          .filter((g) => g.list.length)
      : [];

  const card = (i: LibraryItem) => (
    <button
      key={i.record.id}
      type="button"
      className={`library-card ${i.status}`}
      onClick={() => setChosen(i.record.id)}
    >
      <Miniature record={i.record} />
      <span className="library-name">
        {G.title(TEXTS.levels[i.record.level], i.record.number)}
        {i.favorite && <span className="star"> ★</span>}
      </span>
      <span className="library-status">{statusText(i)}</span>
    </button>
  );

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="bar-button" onClick={onBack}>
          <Icon name="back" />
          <span>{L.back}</span>
        </button>
        <h1>{L.title}</h1>
        <span className="topbar-spacer" />
      </header>

      <div className="filters">
        <div className="chips">
          <button
            type="button"
            className={filter.level === null ? 'chip on' : 'chip'}
            onClick={() => setFilter({ ...filter, level: null })}
          >
            {L.all}
          </button>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              className={filter.level === level ? 'chip on' : 'chip'}
              onClick={() => setFilter({ ...filter, level })}
            >
              {TEXTS.levels[level]}
            </button>
          ))}
          <button
            type="button"
            className={filter.favoritesOnly ? 'chip on' : 'chip'}
            onClick={() => setFilter({ ...filter, favoritesOnly: !filter.favoritesOnly })}
          >
            ★ {L.favoritesOnly}
          </button>
        </div>
        <div className="selects">
          <label>
            {L.statusLabel}
            <select
              value={filter.status ?? ''}
              onChange={(e) =>
                setFilter({ ...filter, status: (e.target.value || null) as PuzzleStatus | null })
              }
            >
              <option value="">{L.all}</option>
              {(Object.keys(L.status) as PuzzleStatus[]).map((s) => (
                <option key={s} value={s}>
                  {L.status[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {L.sortLabel}
            <select value={sort} onChange={(e) => setSort(e.target.value as LibrarySort)}>
              {(Object.keys(L.sorts) as LibrarySort[]).map((s) => (
                <option key={s} value={s}>
                  {L.sorts[s]}
                </option>
              ))}
            </select>
          </label>
          <span className="library-count">{L.count(shown.length)}</span>
        </div>
      </div>

      <div className="library-scroll">
        {shown.length === 0 && <p className="panel-help">{L.empty}</p>}
        {sort === 'numero' ? (
          groups.map((g) => (
            <section key={g.level}>
              <h2 className="library-level">{TEXTS.levels[g.level]}</h2>
              <div className="library-grid">{g.list.map(card)}</div>
            </section>
          ))
        ) : (
          <div className="library-grid">{shown.map(card)}</div>
        )}
      </div>

      {item && (
        <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2>
              {G.title(TEXTS.levels[item.record.level], item.record.number)}
              {item.favorite && ' ★'}
            </h2>
            <p className="panel-help">
              {statusText(item)} · {L.score(item.record.score)}
            </p>
            {confirmRestart ? (
              <>
                <p>{L.restartConfirm}</p>
                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={() => setConfirmRestart(false)}>
                    {G.cancel}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      onRestart(item);
                      close();
                    }}
                  >
                    {G.confirm}
                  </button>
                </div>
              </>
            ) : showHistory ? (
              <>
                <h3>{L.history}</h3>
                <HistoryList entries={history.filter((h) => h.puzzleId === item.record.id)} />
                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={() => setShowHistory(false)}>
                    {G.close}
                  </button>
                </div>
              </>
            ) : (
              <div className="menu-list">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    onPlay(item);
                    close();
                  }}
                >
                  {item.status === 'en_cours' ? L.resume : L.play}
                </button>
                {item.status === 'en_cours' && (
                  <button type="button" onClick={() => setConfirmRestart(true)}>
                    {L.restart}
                  </button>
                )}
                <button type="button" onClick={() => onToggleFavorite(item.record.id)}>
                  {item.favorite ? G.favoriteRemove : G.favoriteAdd}
                </button>
                <button type="button" onClick={() => setShowHistory(true)}>
                  {L.history}
                </button>
                <button type="button" className="secondary" onClick={close}>
                  {G.close}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryList({ entries }: { entries: readonly HistoryEntry[] }) {
  if (entries.length === 0) return <p className="panel-help">{L.noHistory}</p>;
  const sorted = [...entries].sort((a, b) => b.endedAt.localeCompare(a.endedAt) || (b.id ?? 0) - (a.id ?? 0));
  return (
    <ul className="history-list">
      {sorted.map((h, i) => (
        <li key={h.id ?? i}>
          {L.historyLine(
            new Date(h.endedAt).toLocaleDateString('fr-FR'),
            formatTime(h.durationMs),
            L.outcomes[h.outcome],
            [h.outcome === 'terminee' ? L.hintsUsed(h.hints) : '', h.feeling ? G.feelings[h.feeling] : '']
              .filter(Boolean)
              .join(' · '),
          )}
        </li>
      ))}
    </ul>
  );
}
