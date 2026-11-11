/**
 * Écran de jeu (section 7) : barre supérieure, grille, double clavier, menu Options, pause et victoire.
 * La partie est sauvegardée à chaque action.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cellAt, colOf, rowOf, type PuzzleRecord } from '../../engine/model';
import { TEXTS } from '../../texts/fr';
import { solutionOf } from '../bank';
import { Grid } from '../grid/Grid';
import { Icon } from '../icons';
import { saveGame, type SavedGame } from '../storage';
import { formatTime, now, readClock, startClock, stopClock, stoppedClock, type Clock } from './clock';
import { Keypad } from './Keypad';
import {
  canRedo,
  canUndo,
  checkVictory,
  eraseAll,
  eraseCells,
  fillAllNotes,
  isFull,
  newGame,
  redo,
  setDigit,
  toggleNote,
  undo,
  type GameState,
} from './state';

const T = TEXTS.game;

interface Props {
  record: PuzzleRecord;
  initial: SavedGame;
  onHome: () => void;
  onNext: () => void;
}

interface Confirmation {
  message: string;
  onConfirm: () => void;
}

function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal">{children}</div>
    </div>
  );
}

export function GameScreen({ record, initial, onHome, onNext }: Props) {
  const solution = solutionOf(record);
  const [game, setGame] = useState<SavedGame>(initial);
  const [selection, setSelection] = useState<number[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Le chronomètre vit dans une « ref » (il change sans redessiner l'écran) ; `elapsed` est sa valeur
  // affichée, rafraîchie chaque seconde.
  const clock = useRef<Clock>(stoppedClock(initial.elapsedMs));
  const [elapsed, setElapsed] = useState(initial.elapsedMs);
  const gameRef = useRef(initial);

  /** Enregistre la partie avec le temps du chronomètre. */
  const persist = useCallback((state: SavedGame) => {
    void saveGame({
      ...state,
      elapsedMs: readClock(clock.current, now()),
      updatedAt: Date.now(),
    });
  }, []);

  /** Applique une action du joueur, vérifie la victoire et sauvegarde. */
  const update = useCallback(
    (action: (state: GameState) => GameState) => {
      const current = gameRef.current;
      const changed = action(current);
      if (changed === current) return;
      const next = { ...current, ...checkVictory(changed, solution) };
      if (next.completed) {
        clock.current = stopClock(clock.current, now());
        next.elapsedMs = clock.current.baseMs;
        setElapsed(next.elapsedMs);
        setSelection([]);
        setFocus(null);
      } else if (isFull(next)) setToast(T.fullButWrong);
      gameRef.current = next;
      setGame(next);
      persist(next);
    },
    [persist, solution],
  );

  const pause = useCallback(() => {
    if (gameRef.current.completed) return;
    clock.current = stopClock(clock.current, now());
    setElapsed(clock.current.baseMs);
    setPaused(true);
    persist(gameRef.current);
  }, [persist]);

  const resume = () => {
    clock.current = startClock(clock.current, now());
    setPaused(false);
  };

  const restart = () => {
    const fresh: SavedGame = {
      ...game,
      ...newGame(record.id),
      startedAt: new Date().toLocaleDateString('sv-SE'),
    };
    clock.current = startClock(stoppedClock(0), now());
    setElapsed(0);
    gameRef.current = fresh;
    setGame(fresh);
    setSelection([]);
    setFocus(null);
    setPaused(false);
    persist(fresh);
  };

  // Le chronomètre démarre à l'ouverture de la partie (sauf si elle est déjà gagnée).
  useEffect(() => {
    if (!gameRef.current.completed) clock.current = startClock(clock.current, now());
  }, []);

  // Rafraîchit l'affichage du chronomètre chaque seconde, et sauvegarde le temps toutes les 15 s.
  useEffect(() => {
    let seconds = 0;
    const timer = window.setInterval(() => {
      setElapsed(readClock(clock.current, now()));
      if (++seconds % 15 === 0 && clock.current.since !== null) persist(gameRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [persist]);

  // L'application passe en arrière-plan : le chronomètre s'arrête (section 7.5).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pause);
    };
  }, [pause]);

  // Le message « grille remplie mais fausse » disparaît seul.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const blocked = paused || game.completed;
  const onDigit = (d: number) => !blocked && update((s) => setDigit(s, selection, d));
  const onNote = (d: number) => !blocked && update((s) => toggleNote(s, selection, d));

  // Clavier physique (facultatif) : chiffres, Maj + chiffre pour une note, flèches, effacement.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (blocked || confirmation) return;
      const digit = /^(Digit|Numpad)([1-9])$/.exec(event.code);
      if (digit) {
        const d = Number(digit[2]);
        update((s) => (event.shiftKey ? toggleNote(s, selection, d) : setDigit(s, selection, d)));
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        update((s) => eraseCells(s, selection));
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        update(event.shiftKey ? redo : undo);
      } else if (event.key.startsWith('Arrow')) {
        const from = focus ?? 0;
        const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[
          event.key
        ] ?? [0, 0];
        const cell = cellAt((rowOf(from) + dr + 9) % 9, (colOf(from) + dc + 9) % 9);
        setSelection([cell]);
        setFocus(cell);
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked, confirmation, focus, selection, update]);

  const ask = (message: string, onConfirm: () => void) => setConfirmation({ message, onConfirm });
  const title = T.title(TEXTS.levels[record.level], record.number);

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="bar-button" onClick={onHome}>
          <Icon name="back" />
          <span>{T.home}</span>
        </button>
        <h1>{title}</h1>
        <div className="topbar-right">
          <button type="button" className="bar-button" onClick={() => setMenuOpen(true)} aria-label={T.menu}>
            <Icon name="more" />
          </button>
          <button
            type="button"
            className="bar-button"
            onClick={paused ? resume : pause}
            disabled={game.completed}
            aria-label={paused ? T.resume : T.pause}
          >
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <span className="timer">{formatTime(elapsed)}</span>
        </div>
      </header>

      <main className="board">
        <Grid
          puzzle={record}
          values={game.values}
          notes={game.notes}
          selection={selection}
          focus={focus}
          hidden={paused}
          onSelect={(cells, f) => {
            setSelection(cells);
            setFocus(f);
          }}
        />
        {paused && (
          <div className="pause-cover">
            <p>{T.paused}</p>
            <button type="button" className="primary" onClick={resume}>
              {T.resume}
            </button>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </main>

      <Keypad
        canUndo={canUndo(game)}
        canRedo={canRedo(game)}
        disabled={blocked}
        onUndo={() => update(undo)}
        onRedo={() => update(redo)}
        onDigit={onDigit}
        onNote={onNote}
        onOptions={() => setOptionsOpen(true)}
      />

      {optionsOpen && (
        <Modal onClose={() => setOptionsOpen(false)}>
          <h2>{T.options}</h2>
          <div className="menu-list">
            <button
              type="button"
              onClick={() => {
                setOptionsOpen(false);
                ask(T.eraseAllConfirm, () => update(eraseAll));
              }}
            >
              {T.eraseAll}
            </button>
            <button
              type="button"
              disabled={selection.length === 0}
              onClick={() => {
                update((s) => eraseCells(s, selection));
                setOptionsOpen(false);
              }}
            >
              {T.eraseSelection}
            </button>
            <button
              type="button"
              onClick={() => {
                update((s) => fillAllNotes(s, record));
                setOptionsOpen(false);
              }}
            >
              {T.fillNotes}
            </button>
            <button type="button" disabled={!canUndo(game)} onClick={() => update(undo)}>
              {T.undo}
            </button>
            <button type="button" disabled={!canRedo(game)} onClick={() => update(redo)}>
              {T.redo}
            </button>
            <button type="button" className="secondary" onClick={() => setOptionsOpen(false)}>
              {T.close}
            </button>
          </div>
        </Modal>
      )}

      {menuOpen && (
        <Modal onClose={() => setMenuOpen(false)}>
          <h2>{T.menu}</h2>
          <div className="menu-list">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                ask(T.restartConfirm, restart);
              }}
            >
              {T.restart}
            </button>
            <button type="button" className="secondary" onClick={() => setMenuOpen(false)}>
              {T.close}
            </button>
          </div>
        </Modal>
      )}

      {confirmation && (
        <Modal onClose={() => setConfirmation(null)}>
          <p>{confirmation.message}</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setConfirmation(null)}>
              {T.cancel}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                confirmation.onConfirm();
                setConfirmation(null);
              }}
            >
              {T.confirm}
            </button>
          </div>
        </Modal>
      )}

      {game.completed && (
        <Modal>
          <h2>{T.victoryTitle}</h2>
          <p>{title}</p>
          <p className="victory-time">{T.victoryTime(formatTime(game.elapsedMs))}</p>
          <div className="modal-actions vertical">
            <button type="button" className="primary" onClick={onNext}>
              {T.nextGrid}
            </button>
            <button type="button" onClick={restart}>
              {T.replay}
            </button>
            <button type="button" className="secondary" onClick={onHome}>
              {T.home}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
