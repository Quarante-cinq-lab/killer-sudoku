/**
 * Application : accueil minimal (Reprendre, Nouvelle grille par niveau) et écran de jeu.
 * La bibliothèque, l'historique et les statistiques viendront à l'étape 6.
 */
import { useEffect, useState } from 'react';
import { LEVELS, type Level } from '../engine/model';
import { ENGINE_VERSION } from '../engine/version';
import { TEXTS } from '../texts/fr';
import { BANKS, findPuzzle } from './bank';
import { formatTime } from './game/clock';
import { GameScreen } from './game/GameScreen';
import { newGame } from './game/state';
import {
  loadCurrentId,
  loadGames,
  requestPersistence,
  saveCurrentId,
  saveGame,
  type SavedGame,
} from './storage';

const H = TEXTS.home;

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'game'; game: SavedGame; key: number };

const today = (): string => new Date().toLocaleDateString('sv-SE');

/** Identifiant d'affichage : un nouvel écran de jeu repart de zéro à chaque ouverture. */
let screenCounter = 0;
const nextScreenKey = (): number => ++screenCounter;

const pickRandom = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

function freshGame(puzzleId: string, level: Level): SavedGame {
  return { ...newGame(puzzleId), level, startedAt: today(), updatedAt: Date.now() };
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [games, setGames] = useState<SavedGame[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async (): Promise<SavedGame[]> => {
    const [list, id] = await Promise.all([loadGames(), loadCurrentId()]);
    setGames(list);
    setCurrentId(id);
    return list;
  };

  useEffect(() => {
    void requestPersistence();
    void Promise.all([loadGames(), loadCurrentId()]).then(([list, id]) => {
      setGames(list);
      setCurrentId(id);
      setScreen({ kind: 'home' });
    });
  }, []);

  const open = (game: SavedGame) => {
    void saveCurrentId(game.puzzleId);
    setNotice(null);
    setScreen({ kind: 'game', game, key: nextScreenKey() });
  };

  const goHome = () => {
    void refresh().then(() => setScreen({ kind: 'home' }));
  };

  /** Tire une grille jamais jouée du niveau ; sinon, reprend à zéro la plus anciennement jouée. */
  const newGrid = async (level: Level) => {
    const list = await loadGames();
    const started = new Set(list.map((g) => g.puzzleId));
    const unplayed = BANKS[level].filter((p) => !started.has(p.id));
    let game: SavedGame;
    if (unplayed.length > 0) {
      game = freshGame(pickRandom(unplayed).id, level);
    } else {
      const oldest = list
        .filter((g) => g.level === level)
        .sort((a, b) => Number(b.completed) - Number(a.completed) || a.updatedAt - b.updatedAt)[0];
      if (!oldest) return;
      game = freshGame(oldest.puzzleId, level);
      setNotice(H.allPlayed(TEXTS.levels[level]));
    }
    await saveGame(game);
    open(game);
  };

  if (screen.kind === 'loading') return <p className="loading">{H.loading}</p>;

  if (screen.kind === 'game') {
    const record = findPuzzle(screen.game.puzzleId);
    if (record) {
      return (
        <GameScreen
          key={screen.key}
          record={record}
          initial={screen.game}
          onHome={goHome}
          onNext={() => void newGrid(record.level)}
        />
      );
    }
  }

  const started = new Set(games.map((g) => g.puzzleId));
  const current = games.find((g) => g.puzzleId === currentId && !g.completed);
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
      <footer className="legal">
        <p>{H.legal}</p>
        <p>{H.version(__APP_VERSION__, ENGINE_VERSION)}</p>
      </footer>
    </div>
  );
}
