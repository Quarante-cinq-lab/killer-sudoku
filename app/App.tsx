/**
 * Application : accueil, écran de jeu, bibliothèque, statistiques et réglages.
 * Les données (parties, historique, favoris, réglages) sont chargées depuis IndexedDB au démarrage, puis
 * relues à chaque retour à l'accueil ou à la bibliothèque.
 */
import { useEffect, useState } from 'react';
import { LEVELS, type Level } from '../engine/model';
import { ENGINE_VERSION } from '../engine/version';
import { TEXTS } from '../texts/fr';
import { BANKS, findPuzzle, readExtraBank, registerExtraPuzzles } from './bank';
import { applyAppearance, saveFile } from './data/appearance';
import { backupFileName, buildBackup, parseBackup } from './data/backup';
import { libraryItems, type HistoryEntry, type LibraryItem } from './data/history';
import { DEFAULT_SETTINGS, type Settings } from './data/settings';
import { formatTime } from './game/clock';
import { GameScreen } from './game/GameScreen';
import { newGame } from './game/state';
import { LibraryScreen } from './library/LibraryScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { StatsScreen } from './stats/StatsScreen';
import {
  addExtraPuzzles,
  addHistory,
  loadAll,
  loadCurrentId,
  loadExtraPuzzles,
  loadFavorites,
  loadGames,
  loadHistory,
  loadSettings,
  replaceAll,
  requestPersistence,
  saveCurrentId,
  saveGame,
  saveSettings,
  setFavorite,
  type SavedGame,
} from './storage';

const H = TEXTS.home;

type Screen =
  | { kind: 'loading' }
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'stats' }
  | { kind: 'settings' }
  | { kind: 'game'; game: SavedGame; key: number };

const today = (): string => new Date().toLocaleDateString('sv-SE');

/** Identifiant d'affichage : un nouvel écran de jeu repart de zéro à chaque ouverture. */
let screenCounter = 0;
const nextScreenKey = (): number => ++screenCounter;

const pickRandom = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Nouvelle partie à zéro, avec les aides par défaut des réglages. */
function freshGame(puzzleId: string, level: Level, aids: Settings['defaultAids']): SavedGame {
  return { ...newGame(puzzleId, aids), level, startedAt: today(), updatedAt: Date.now() };
}

interface Data {
  games: SavedGame[];
  history: HistoryEntry[];
  favorites: Set<string>;
  currentId: string | null;
}

async function loadData(): Promise<Data> {
  const [games, history, favorites, currentId] = await Promise.all([
    loadGames(),
    loadHistory(),
    loadFavorites(),
    loadCurrentId(),
  ]);
  return { games, history, favorites, currentId };
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [data, setData] = useState<Data>({ games: [], history: [], favorites: new Set(), currentId: null });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void requestPersistence();
    void (async () => {
      registerExtraPuzzles(await loadExtraPuzzles());
      const loaded = await loadSettings();
      applyAppearance(loaded);
      setSettings(loaded);
      setData(await loadData());
      setScreen({ kind: 'home' });
    })();
  }, []);

  const open = (game: SavedGame) => {
    void saveCurrentId(game.puzzleId);
    setNotice(null);
    setScreen({ kind: 'game', game, key: nextScreenKey() });
  };

  const goTo = (kind: 'home' | 'library' | 'stats' | 'settings') => {
    void loadData().then((d) => {
      setData(d);
      setScreen({ kind });
    });
  };

  /** Ouvre une nouvelle partie à zéro sur une grille et l'enregistre. */
  const startFresh = async (puzzleId: string, level: Level) => {
    const game = freshGame(puzzleId, level, settings.defaultAids);
    await saveGame(game);
    open(game);
  };

  /** Tire une grille jamais jouée du niveau ; sinon, rejoue la grille terminée il y a le plus longtemps. */
  const newGrid = async (level: Level) => {
    const d = await loadData();
    const started = new Set([...d.games.map((g) => g.puzzleId), ...d.history.map((h) => h.puzzleId)]);
    const unplayed = BANKS[level].filter((p) => !started.has(p.id));
    if (unplayed.length > 0) return startFresh(pickRandom(unplayed).id, level);
    const items = libraryItems(BANKS[level], d.games, d.history, d.favorites)
      .filter((i) => i.status !== 'en_cours')
      .sort((a, b) => a.lastPlayed - b.lastPlayed);
    if (items.length === 0) return;
    await startFresh(items[0].record.id, level);
    setNotice(H.allPlayed(TEXTS.levels[level]));
  };

  /** Bibliothèque : reprendre une partie en cours, sinon en commencer une (grille jamais jouée ou rejouée). */
  const play = (item: LibraryItem) => {
    const game = data.games.find((g) => g.puzzleId === item.record.id && !g.completed);
    if (game) open(game);
    else void startFresh(item.record.id, item.record.level);
  };

  /** Bibliothèque : recommencer une partie en cours, qui reste dans l'historique comme abandonnée. */
  const restart = async (item: LibraryItem) => {
    const game = data.games.find((g) => g.puzzleId === item.record.id && !g.completed);
    if (game && (game.undo.length > 0 || game.elapsedMs > 60_000)) {
      await addHistory({
        puzzleId: game.puzzleId,
        level: game.level,
        startedAt: game.startedAt,
        endedAt: today(),
        outcome: 'abandonnee',
        durationMs: game.elapsedMs,
        hints: game.hints,
        checks: game.checks,
        feeling: null,
      });
    }
    await startFresh(item.record.id, item.record.level);
  };

  const toggleFavorite = (puzzleId: string) => {
    const favorite = !data.favorites.has(puzzleId);
    void setFavorite(puzzleId, favorite);
    const favorites = new Set(data.favorites);
    if (favorite) favorites.add(puzzleId);
    else favorites.delete(puzzleId);
    setData({ ...data, favorites });
  };

  const changeSettings = (next: Settings) => {
    setSettings(next);
    applyAppearance(next);
    void saveSettings(next);
  };

  /** Export de la sauvegarde : feuille de partage de l'iPad (Enregistrer dans Fichiers). */
  const exportBackup = async () => {
    const backup = buildBackup(await loadAll(), __APP_VERSION__, new Date().toISOString());
    await saveFile(backupFileName(today()), JSON.stringify(backup));
  };

  /** Import : vérifie le fichier, puis (après confirmation) remplace toute la sauvegarde. */
  const readBackup = (text: string) => {
    const backup = parseBackup(JSON.parse(text));
    return {
      games: backup.games.length,
      history: backup.history.length,
      apply: async () => {
        await replaceAll(backup);
        registerExtraPuzzles(backup.extraPuzzles);
        const restored = await loadSettings();
        changeSettings(restored);
        setData(await loadData());
      },
    };
  };

  const importBank = async (text: string) => {
    const { added, skipped } = readExtraBank(JSON.parse(text));
    await addExtraPuzzles(added);
    registerExtraPuzzles(added);
    return { added: added.length, skipped };
  };

  if (screen.kind === 'loading') return <p className="loading">{H.loading}</p>;

  if (screen.kind === 'stats') {
    return (
      <StatsScreen
        history={data.history}
        levels={LEVELS.filter((l) => BANKS[l].length > 0)}
        onBack={() => goTo('home')}
      />
    );
  }

  if (screen.kind === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        gridsPerLevel={Object.fromEntries(LEVELS.map((l) => [l, BANKS[l].length])) as Record<Level, number>}
        onChange={changeSettings}
        onExport={exportBackup}
        onReadBackup={readBackup}
        onImportBank={importBank}
        onBack={() => goTo('home')}
      />
    );
  }

  if (screen.kind === 'game') {
    const record = findPuzzle(screen.game.puzzleId);
    if (record) {
      return (
        <GameScreen
          key={screen.key}
          record={record}
          initial={screen.game}
          favorite={data.favorites.has(record.id)}
          notesLayout={settings.notesLayout}
          onToggleFavorite={() => toggleFavorite(record.id)}
          onHome={() => goTo('home')}
          onNext={() => void newGrid(record.level)}
          onLibrary={() => goTo('library')}
        />
      );
    }
  }

  if (screen.kind === 'library') {
    const all = LEVELS.flatMap((level) => BANKS[level]);
    return (
      <LibraryScreen
        items={libraryItems(all, data.games, data.history, data.favorites)}
        history={data.history}
        onBack={() => goTo('home')}
        onPlay={play}
        onRestart={(item) => void restart(item)}
        onToggleFavorite={toggleFavorite}
      />
    );
  }

  const started = new Set([...data.games.map((g) => g.puzzleId), ...data.history.map((h) => h.puzzleId)]);
  const current = data.games.find((g) => g.puzzleId === data.currentId && !g.completed);
  const currentRecord = current && findPuzzle(current.puzzleId);

  return (
    <div className="home">
      <h1>{TEXTS.appName}</h1>
      {notice && <p className="notice">{notice}</p>}
      {current && currentRecord && (
        <button type="button" className="resume primary" onClick={() => open(current)}>
          <strong>{H.resume}</strong>
          <span>
            {H.resumeDetail(
              TEXTS.game.title(TEXTS.levels[currentRecord.level], currentRecord.number),
              formatTime(current.elapsedMs),
            )}
          </span>
        </button>
      )}
      <h2>{H.newGrid}</h2>
      <div className="level-tiles">
        {LEVELS.map((level) => {
          const total = BANKS[level].length;
          const unplayed = BANKS[level].filter((p) => !started.has(p.id)).length;
          return (
            <button
              key={level}
              type="button"
              className="level-tile"
              disabled={total === 0}
              onClick={() => void newGrid(level)}
            >
              <strong>{TEXTS.levels[level]}</strong>
              <span>{total === 0 ? H.unavailable : H.unplayed(unplayed)}</span>
            </button>
          );
        })}
      </div>
      <div className="home-links">
        <button type="button" onClick={() => goTo('library')}>
          {H.library}
        </button>
        <button type="button" onClick={() => goTo('stats')}>
          {H.stats}
        </button>
        <button type="button" onClick={() => goTo('settings')}>
          {H.settings}
        </button>
      </div>
      <footer className="legal">
        <p>{H.legal}</p>
        <p>{H.version(__APP_VERSION__, ENGINE_VERSION)}</p>
      </footer>
    </div>
  );
}
