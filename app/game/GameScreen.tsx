/**
 * Écran de jeu (section 7) : barre supérieure, grille, double clavier, outils killer, aides, menus,
 * pause et victoire. La partie est sauvegardée à chaque action.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cellAt, colOf, rowOf, type PuzzleRecord } from '../../engine/model';
import { TEXTS } from '../../texts/fr';
import { solutionOf } from '../bank';
import { Grid, type GridMarks } from '../grid/Grid';
import { Icon } from '../icons';
import { historyEntry, today, wasStarted, type HistoryEntry } from '../data/history';
import type { NotesLayout } from '../data/settings';
import { addHistory, saveGame, updateHistory, type SavedGame } from '../storage';
import { contradicts, finderLines, conflictCells, quickAction, unitCells, wrongCells } from './aids';
import { emptyCalc, pressKey, type CalcKey, type CalcState } from './calculator';
import { virtualConflictCells } from './virtual';
import { formatTime, now, readClock, startClock, stopClock, stoppedClock, type Clock } from './clock';
import { AidsDialog, ConfirmDialog, LostDialog, MenuDialog, OptionsDialog, VictoryDialog } from './dialogs';
import { Keypad } from './Keypad';
import {
  CalculatorContent,
  FinderContent,
  emptyFinder,
  FloatingPanel,
  typeInFinder,
  type FinderState,
} from './panels';
import {
  canRedo,
  canUndo,
  checkVictory,
  eraseAll,
  eraseCells,
  fillAllNotes,
  isFull,
  isOver,
  MAX_ERRORS,
  wrongDigits,
  newGame,
  redo,
  setAids,
  setDigit,
  toggleNote,
  undo,
  MAX_HINTS,
  revealCell,
  type GameState,
} from './state';

const T = TEXTS.game;
const EMPTY: ReadonlySet<number> = new Set();

interface Props {
  record: PuzzleRecord;
  initial: SavedGame;
  favorite: boolean;
  notesLayout: NotesLayout;
  /** Mode erreurs des nouvelles parties (réglage) : utilisé quand on recommence la grille. */
  errorMode: boolean;
  onToggleFavorite: () => void;
  onHome: () => void;
  onNext: () => void;
  onLibrary: () => void;
}

interface Confirmation {
  message: string;
  onConfirm: () => void;
}

/** Où va le pavé chiffres : dans la grille, ou dans le champ d'une fenêtre ouverte. */
type DigitTarget = 'grid' | 'finder' | 'calculator';

export function GameScreen(props: Props) {
  const { record, initial, onHome, onNext } = props;
  const solution = solutionOf(record);
  const [game, setGame] = useState<SavedGame>(initial);
  const [selection, setSelection] = useState<number[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aidsOpen, setAidsOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [target, setTarget] = useState<DigitTarget>('grid');
  const [finder, setFinder] = useState<FinderState>(emptyFinder);
  // Calculatrice : son état reste tant que la partie est ouverte, même si on ferme sa fenêtre.
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcState, setCalcState] = useState<CalcState>(emptyCalc);
  /** Résultat de la dernière vérification : case → chiffre jugé faux (la marque disparaît si on le change). */
  const [checked, setChecked] = useState<ReadonlyMap<number, number>>(new Map());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  /** Somme rapide « + » : sélection pour laquelle le total est affiché (il disparaît si elle change). */
  const [quickSumFor, setQuickSumFor] = useState<string | null>(null);
  /** Ligne d'historique de la partie gagnée (pour y ajouter le ressenti). */
  const [finished, setFinished] = useState<HistoryEntry | null>(null);
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
        const entry = historyEntry(next, 'terminee', next.elapsedMs);
        void addHistory(entry).then((id) => setFinished({ ...entry, id }));
        setSelection([]);
        setFocus(null);
      } else if (next.lost && !current.lost) {
        clock.current = stopClock(clock.current, now());
        next.elapsedMs = clock.current.baseMs;
        setElapsed(next.elapsedMs);
        void addHistory(historyEntry(next, 'perdue', next.elapsedMs));
        setSelection([]);
        setFocus(null);
      } else if (isFull(next) && !isFull(current) && !next.errorMode) setToast(T.fullButWrong);
      gameRef.current = next;
      setGame(next);
      persist(next);
    },
    [persist, solution],
  );

  const pause = useCallback(() => {
    if (isOver(gameRef.current)) return;
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
    // Une partie entamée qu'on recommence avant la fin reste dans l'historique comme « abandonnée ».
    const spent = readClock(clock.current, now());
    if (!isOver(game) && wasStarted(game, spent)) {
      void addHistory(historyEntry(game, 'abandonnee', spent));
    }
    const fresh: SavedGame = {
      ...game,
      ...newGame(record.id, game.aids, props.errorMode),
      startedAt: today(),
    };
    setFinished(null);
    clock.current = startClock(stoppedClock(0), now());
    setElapsed(0);
    gameRef.current = fresh;
    setGame(fresh);
    setSelection([]);
    setFocus(null);
    setChecked(new Map());
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

  // Les messages courts disparaissent seuls.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const blocked = paused || isOver(game);
  const aids = game.aids;
  // Le pavé va à la dernière fenêtre utilisée ; si elle est fermée, à l'autre fenêtre ouverte, sinon à la grille.
  const digitTarget: DigitTarget =
    target === 'calculator' && calcOpen
      ? 'calculator'
      : finderOpen
        ? 'finder'
        : calcOpen
          ? 'calculator'
          : 'grid';

  /** Grand pavé : chiffre dans la grille, ou dans le champ de la fenêtre active. */
  const onDigit = (d: number) => {
    if (blocked) return;
    if (digitTarget === 'finder') setFinder((c) => typeInFinder(c, d));
    else if (digitTarget === 'calculator') setCalcState((c) => pressKey(c, String(d) as CalcKey));
    else update((s) => setDigit(s, record, selection, d, solution));
  };
  const onNote = (d: number) => !blocked && update((s) => toggleNote(s, selection, d));

  // Clavier physique (facultatif) : chiffres, Maj + chiffre pour une note, flèches, effacement.
  const onDigitRef = useRef(onDigit);
  useEffect(() => {
    onDigitRef.current = onDigit;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (blocked || confirmation) return;
      const digit = /^(Digit|Numpad)([1-9])$/.exec(event.code);
      if (digit) {
        const d = Number(digit[2]);
        if (event.shiftKey) update((s) => toggleNote(s, selection, d));
        else onDigitRef.current(d);
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

  /** Vérification (section 9) : marque les chiffres faux et compte la vérification. */
  const runCheck = () => {
    setMenuOpen(false);
    const wrong = wrongCells(game.values, solution);
    update((s) => ({ ...s, checks: s.checks + 1 }));
    setChecked(new Map(wrong.map((c) => [c, game.values[c]])));
    setToast(wrong.length > 0 ? T.checkFound(wrong.length) : T.checkNone);
  };

  /** Indice (section 9) : le bon chiffre de la case sélectionnée, 3 fois au plus par partie. */
  const onHint = () => {
    if (blocked || !aids.hint) return;
    if (focus === null) {
      setToast(T.hintSelectCell);
      return;
    }
    if (game.values[focus] === solution[focus]) {
      setToast(T.hintAlreadyRight);
      return;
    }
    update((s) => revealCell(s, record, solution, focus));
  };

  /** Somme et combinaisons rapides (section 7.4) : bouton « + » ou « ? » à côté de la sélection. */
  const selectionKey = selection.join(',');
  const openCombinations = (sum: number, cells: readonly number[]) => {
    setFinder({ ...emptyFinder(), sum: String(sum), count: String(cells.length), listed: true, cells });
    setFinderOpen(true);
    setTarget('finder');
  };
  const quick = blocked ? null : quickAction(record, selection, focus);
  let quickBadge: { cell: number; text: string; onPress: () => void } | undefined;
  if (quick && focus !== null) {
    quickBadge =
      quick.kind === 'sum'
        ? {
            cell: focus,
            text: quickSumFor === selectionKey ? String(quick.total) : '+',
            onPress: () => setQuickSumFor(selectionKey),
          }
        : { cell: focus, text: '?', onPress: () => openCombinations(quick.sum, quick.cells) };
  }

  // Marques des aides, recalculées seulement quand la grille ou la sélection change.
  const marks: GridMarks = useMemo(() => {
    const focusValue = focus === null ? 0 : game.values[focus];
    return {
      units: aids.highlightUnits && focus !== null ? unitCells(focus) : EMPTY,
      sameDigit:
        aids.highlightSameDigits && focusValue
          ? new Set(game.values.flatMap((v, c) => (v === focusValue ? [c] : [])))
          : EMPTY,
      conflicts: aids.conflicts
        ? new Set([
            ...conflictCells(record, game.values),
            ...virtualConflictCells(record, game.values, game.virtualCages),
          ])
        : EMPTY,
      // Chiffres faux : vérification immédiate (mode erreurs), ou dernière vérification à la demande.
      wrong: game.errorMode
        ? wrongDigits({ errorMode: game.errorMode, values: game.values }, solution)
        : aids.check
          ? new Set([...checked].filter(([c, v]) => game.values[c] === v).map(([c]) => c))
          : EMPTY,
      virtualCages: game.virtualCages,
    };
  }, [aids, checked, focus, game.errorMode, game.values, game.virtualCages, record, solution]);

  const ask = (message: string, onConfirm: () => void) => setConfirmation({ message, onConfirm });
  const title = T.title(TEXTS.levels[record.level], record.number);
  /** Position de départ des fenêtres : à gauche, ou sur la droite de la grille (sans couvrir le clavier). */
  const panelX = (side: 'left' | 'right') => {
    if (side === 'left') return 16;
    const w = window.innerWidth;
    const keypad = w > window.innerHeight ? Math.min(420, Math.max(300, 0.34 * w)) + 20 : 0;
    return Math.max(16, w - keypad - 336);
  };

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
          {game.errorMode && (
            <span className={game.errors > 0 ? 'error-count has-errors' : 'error-count'}>
              {T.errors(game.errors, MAX_ERRORS)}
            </span>
          )}
          <span className="timer">{formatTime(elapsed)}</span>
        </div>
      </header>

      <main className="board">
        <Grid
          puzzle={record}
          marks={marks}
          values={game.values}
          notes={game.notes}
          selection={selection}
          focus={focus}
          hidden={paused}
          notesLayout={props.notesLayout}
          badge={quickBadge}
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
        digitsToPanel={digitTarget !== 'grid'}
        onUndo={() => update(undo)}
        onRedo={() => update(redo)}
        onDigit={onDigit}
        onNote={onNote}
        onOptions={() => setOptionsOpen(true)}
        onHint={onHint}
        hintEnabled={aids.hint}
        hintsLeft={Math.max(0, MAX_HINTS - game.hints)}
        onCalculator={() => {
          setCalcOpen((o) => !o);
          setTarget('calculator');
        }}
        onFinder={() => {
          setFinderOpen((o) => !o);
          setTarget('finder');
        }}
        open={{
          finder: finderOpen,
          calculator: calcOpen,
        }}
      />

      {!blocked && calcOpen && (
        <FloatingPanel
          title={T.calculatorTitle}
          start={{ x: Math.max(16, panelX('right') - 10), y: 70 }}
          onClose={() => setCalcOpen(false)}
          compact
        >
          <CalculatorContent
            state={calcState}
            onKey={(key) => {
              setCalcState((c) => pressKey(c, key));
              setTarget('calculator');
            }}
          />
        </FloatingPanel>
      )}

      {!blocked && finderOpen && (
        <FloatingPanel
          title={T.finderTitle}
          start={{ x: panelX('left'), y: 70 }}
          onClose={() => setFinderOpen(false)}
        >
          <FinderContent
            calc={finder}
            lines={finderLines(Number(finder.sum), Number(finder.count), finder.required, finder.excluded)}
            isGreyed={(digits) =>
              aids.filterCombinations &&
              finder.cells !== undefined &&
              contradicts(digits, finder.cells, game.values)
            }
            onChange={(c) => {
              setFinder(c);
              setTarget('finder');
            }}
          />
        </FloatingPanel>
      )}

      {optionsOpen && (
        <OptionsDialog
          hasSelection={selection.length > 0}
          showFillNotes={aids.autoNotes}
          canUndo={canUndo(game)}
          canRedo={canRedo(game)}
          onEraseAll={() => {
            setOptionsOpen(false);
            ask(T.eraseAllConfirm, () => update(eraseAll));
          }}
          onRestart={() => {
            setOptionsOpen(false);
            ask(T.restartConfirm, restart);
          }}
          onEraseSelection={() => {
            update((s) => eraseCells(s, selection));
            setOptionsOpen(false);
          }}
          onFillNotes={() => {
            update((s) => fillAllNotes(s, record));
            setOptionsOpen(false);
          }}
          onUndo={() => update(undo)}
          onRedo={() => update(redo)}
          onClose={() => setOptionsOpen(false)}
        />
      )}

      {menuOpen && (
        <MenuDialog
          showCheck={aids.check && !game.errorMode}
          checkDisabled={game.completed}
          favorite={props.favorite}
          onCheck={runCheck}
          onAids={() => {
            setMenuOpen(false);
            setAidsOpen(true);
          }}
          onToggleFavorite={props.onToggleFavorite}
          onRestart={() => {
            setMenuOpen(false);
            ask(T.restartConfirm, restart);
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {aidsOpen && (
        <AidsDialog
          aids={aids}
          onChange={(next) => update((s) => setAids(s, next))}
          onClose={() => setAidsOpen(false)}
        />
      )}

      {confirmation && (
        <ConfirmDialog
          message={confirmation.message}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.onConfirm();
            setConfirmation(null);
          }}
        />
      )}

      {game.lost && (
        <LostDialog title={title} elapsedMs={game.elapsedMs} onRestart={restart} onHome={onHome} />
      )}

      {game.completed && (
        <VictoryDialog
          title={title}
          elapsedMs={game.elapsedMs}
          hints={game.hints}
          checks={game.checks}
          errors={game.errorMode ? game.errors : null}
          finished={finished}
          onFeeling={(feeling) => {
            if (!finished) return;
            const entry = { ...finished, feeling };
            setFinished(entry);
            void updateHistory(entry);
          }}
          onNext={onNext}
          onReplay={restart}
          onLibrary={props.onLibrary}
        />
      )}
    </div>
  );
}
