/**
 * Écran de jeu (section 7) : barre supérieure, grille, double clavier, outils killer, aides, menus,
 * pause et victoire. La partie est sauvegardée à chaque action.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DIFFICULTY_CONFIG } from '../../engine/difficulty';
import { findHint, hintEffect, type Hint } from '../../engine/hint';
import { createContext } from '../../engine/logic/context';
import { cellName, describeStep, describeZone } from '../../engine/logic/describe';
import { cellAt, colOf, rowOf, type PuzzleRecord } from '../../engine/model';
import { TEXTS } from '../../texts/fr';
import { solutionOf } from '../bank';
import { Grid, type GridMarks } from '../grid/Grid';
import { Icon } from '../icons';
import type { Feeling, HistoryEntry } from '../data/history';
import type { NotesLayout } from '../data/settings';
import { addHistory, saveGame, updateHistory, type SavedGame } from '../storage';
import {
  allDistinct,
  finderLines,
  combinationLines,
  comboSources,
  conflictCells,
  unitCells,
  wrongCells,
} from './aids';
import { emptyCalc, type CalcState } from './calculator';
import { suggestSum, virtualConflictCells } from './virtual';
import { emptySelection, sumInfo, toggleInSelection, type SumSelection } from './sumMode';
import { regionName, unitName } from '../../engine/logic/describe';
import { formatTime, now, readClock, startClock, stopClock, stoppedClock, type Clock } from './clock';
import { Keypad } from './Keypad';
import {
  AidsContent,
  CalculatorContent,
  SumContent,
  FinderContent,
  CombinationsContent,
  emptyFinder,
  FloatingPanel,
  typeInFinder,
  VirtualCagesContent,
  type FinderState,
} from './panels';
import {
  addVirtualCage,
  canRedo,
  canUndo,
  checkVictory,
  DEFAULT_AIDS,
  eraseAll,
  eraseCells,
  fillAllNotes,
  isFull,
  isOver,
  MAX_ERRORS,
  wrongDigits,
  newGame,
  PURIST_AIDS,
  redo,
  removeVirtualCage,
  toggleVirtualHidden,
  setAids,
  setDigit,
  toggleCombination,
  toggleNote,
  undo,
  writeCells,
  type CellContent,
  type GameState,
} from './state';

const T = TEXTS.game;
const H = TEXTS.hint;
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

const today = (): string => new Date().toLocaleDateString('sv-SE');

/** Ligne d'historique d'une partie qui se termine (gagnée ou abandonnée). */
function historyEntry(game: SavedGame, outcome: HistoryEntry['outcome'], durationMs: number): HistoryEntry {
  return {
    puzzleId: game.puzzleId,
    level: game.level,
    startedAt: game.startedAt,
    endedAt: today(),
    outcome,
    durationMs,
    hints: game.hints,
    checks: game.checks,
    errors: game.errors,
    feeling: null,
  };
}

interface Confirmation {
  message: string;
  onConfirm: () => void;
}

/** Où va le pavé chiffres : dans la grille, ou dans le champ d'une fenêtre ouverte. */
type DigitTarget = 'grid' | 'finder' | 'virtual';

/** Contenu de l'indice selon son niveau de détail. */
function HintContent({
  hint,
  level,
  describe,
}: {
  hint: Hint;
  level: 1 | 2;
  describe: (step: Extract<Hint, { kind: 'step' }>['step']) => {
    name: string;
    where: string;
    zone: string;
    cells: string;
  };
}) {
  if (hint.kind === 'solved') return <p>{H.solved}</p>;
  if (hint.kind === 'stuck') return <p>{H.stuck}</p>;
  if (hint.kind === 'error') {
    return (
      <>
        <p className="hint-main">{H.errorTitle}</p>
        {level === 2 && <p>{H.errorDetail(hint.wrongDigits.length, hint.missingNotes.length)}</p>}
      </>
    );
  }
  const text = describe(hint.step);
  return (
    <>
      <p className="hint-main">{H.zone(text.name, text.zone)}</p>
      {level === 2 && (
        <>
          <p>{TEXTS.explanations[hint.step.technique]}</p>
          <p className="panel-help">
            {H.where(text.where.includes(text.cells) ? text.where : `${text.cells} (${text.where})`)}
          </p>
        </>
      )}
    </>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal">{children}</div>
    </div>
  );
}

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
  const [combosOpen, setCombosOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [virtualOpen, setVirtualOpen] = useState(false);
  const [target, setTarget] = useState<DigitTarget>('grid');
  const [finder, setFinder] = useState<FinderState>(emptyFinder);
  // Calculatrice : son état reste tant que la partie est ouverte, même si on ferme sa fenêtre.
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcState, setCalcState] = useState<CalcState>(emptyCalc);
  // Mode Somme (E4) : sélection de cages entières, effacée à la sortie du mode.
  const [sumMode, setSumMode] = useState(false);
  const [sumSel, setSumSel] = useState<SumSelection>(emptySelection);
  const [sumKind, setSumKind] = useState<'cages' | 'cases'>('cages');
  const [virtualSum, setVirtualSum] = useState('');
  /** Résultat de la dernière vérification : case → chiffre jugé faux (la marque disparaît si on le change). */
  const [checked, setChecked] = useState<ReadonlyMap<number, number>>(new Map());
  /** Indice en cours et niveau de détail affiché (1 : technique et zone ; 2 : explication). */
  const [hint, setHint] = useState<{ result: Hint; level: 1 | 2 } | null>(null);
  const ctx = useMemo(() => createContext(record, DIFFICULTY_CONFIG.rule45MaxCells), [record]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
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

  /**
   * Applique une action du joueur, vérifie la victoire et sauvegarde. Toute action sur la grille
   * périme l'indice affiché (sauf les compteurs : `keepHint`).
   */
  const update = useCallback(
    (action: (state: GameState) => GameState, keepHint = false) => {
      const current = gameRef.current;
      const changed = action(current);
      if (changed === current) return;
      if (!keepHint) setHint(null);
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
    if (!isOver(game) && (game.undo.length > 0 || spent > 60_000)) {
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
  const digitTarget: DigitTarget =
    target === 'finder' && finderOpen ? 'finder' : target === 'virtual' && virtualOpen ? 'virtual' : 'grid';

  /** Grand pavé : chiffre dans la grille, ou dans le champ de la fenêtre active. */
  const onDigit = (d: number) => {
    if (blocked) return;
    if (digitTarget === 'finder') setFinder((c) => typeInFinder(c, d));
    else if (digitTarget === 'virtual') {
      setVirtualSum((v) => {
        const next = (v === '0' ? '' : v) + String(d);
        return Number(next) <= 405 ? next : v;
      });
    } else update((s) => setDigit(s, record, selection, d, solution));
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
    update((s) => ({ ...s, checks: s.checks + 1 }), true);
    setChecked(new Map(wrong.map((c) => [c, game.values[c]])));
    setToast(wrong.length > 0 ? T.checkFound(wrong.length) : T.checkNone);
  };

  /** Bouton Indice : 1er appui, la technique et la zone ; 2e, l'explication ; 3e, la déduction appliquée. */
  const onHint = () => {
    if (blocked || !aids.hint) return;
    if (!hint) {
      const result = findHint(ctx, solution, game.values, game.notes);
      if (result.kind !== 'solved') update((s) => ({ ...s, hints: s.hints + 1 }), true);
      setHint({ result, level: 1 });
    } else if (hint.level === 1 && (hint.result.kind === 'step' || hint.result.kind === 'error')) {
      setHint({ ...hint, level: 2 });
    } else applyHint(hint.result);
  };

  /** 3e niveau : applique la déduction, efface les erreurs ou révèle une case (une seule action annulable). */
  const applyHint = (result: Hint) => {
    const contents = new Map<number, CellContent>();
    if (result.kind === 'step') {
      for (const [cell, content] of hintEffect(result, game.values, game.notes)) contents.set(cell, content);
    } else if (result.kind === 'error') {
      for (const cell of [...result.wrongDigits, ...result.missingNotes])
        contents.set(cell, { value: 0, notes: [] });
    } else if (result.kind === 'stuck') {
      const cell = focus !== null && !game.values[focus] ? focus : game.values.findIndex((v) => !v);
      if (cell >= 0) contents.set(cell, { value: solution[cell], notes: [] });
    }
    setHint(null);
    update((s) => writeCells(s, record, contents));
  };

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
      hint:
        !hint || hint.level < 2
          ? EMPTY
          : hint.result.kind === 'step'
            ? new Set(hint.result.step.cells)
            : hint.result.kind === 'error'
              ? new Set([...hint.result.wrongDigits, ...hint.result.missingNotes])
              : EMPTY,
      virtualCages: game.virtualCages,
      sum: sumMode ? new Set(sumInfo(record, game.values, sumSel).cells) : EMPTY,
    };
  }, [
    aids,
    checked,
    focus,
    game.errorMode,
    game.values,
    game.virtualCages,
    hint,
    record,
    solution,
    sumMode,
    sumSel,
  ]);

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
          onSelect={(cells, f) => {
            if (sumMode) {
              // Mode Somme : un toucher ajoute ou retire une cage (ou une case remplie) ; pas de glissé.
              if (cells.length === 1) setSumSel((s) => toggleInSelection(record, game.values, s, f, sumKind));
              return;
            }
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
        onCombinations={() => setCombosOpen((o) => !o)}
        onCalculator={() => setCalcOpen((o) => !o)}
        onSum={() => {
          setSumMode((on) => !on);
          setSumSel(emptySelection());
        }}
        padsDisabled={sumMode}
        onFinder={() => {
          setFinderOpen((o) => !o);
          setTarget('finder');
        }}
        onVirtualCages={() => {
          setVirtualOpen((o) => !o);
          setTarget('virtual');
        }}
        open={{
          combinations: combosOpen,
          finder: finderOpen,
          calculator: calcOpen,
          virtualCages: virtualOpen,
          sum: sumMode,
        }}
      />

      {!blocked && hint && (
        <FloatingPanel
          title={H.title(hint.result.kind === 'step' || hint.result.kind === 'error' ? hint.level : 1)}
          start={{ x: 16, y: 70 }}
          onClose={() => setHint(null)}
        >
          <HintContent
            hint={hint.result}
            level={hint.level}
            describe={(step) => ({
              ...describeStep(step, ctx),
              zone: describeZone(step, ctx),
              cells: step.cells.map(cellName).join(', '),
            })}
          />
          <div className="modal-actions">
            {hint.result.kind !== 'solved' && (
              <button type="button" className="primary" onClick={onHint}>
                {hint.result.kind === 'stuck'
                  ? H.reveal
                  : hint.level === 1
                    ? H.more
                    : hint.result.kind === 'error'
                      ? H.fixErrors
                      : H.apply}
              </button>
            )}
          </div>
        </FloatingPanel>
      )}

      {!blocked && combosOpen && (
        <FloatingPanel
          title={T.combinationsTitle}
          start={{ x: panelX('right'), y: 70 }}
          onClose={() => setCombosOpen(false)}
        >
          <CombinationsContent
            sources={focus === null ? [] : comboSources(record, game.virtualCages, focus)}
            linesOf={(source) => combinationLines(source, game.values)}
            struck={game.struck}
            filter={aids.filterCombinations}
            mayRepeat={(source) => source.virtual && !allDistinct(record, source.cells)}
            onToggle={(key, mask) => update((s) => toggleCombination(s, key, mask))}
          />
        </FloatingPanel>
      )}

      {!blocked && sumMode && (
        <FloatingPanel
          title={T.sumTitle}
          start={{ x: 16, y: Math.max(70, window.innerHeight - 520) }}
          onClose={() => {
            setSumMode(false);
            setSumSel(emptySelection());
          }}
          compact
        >
          {(() => {
            const info = sumInfo(record, game.values, sumSel);
            return (
              <SumContent
                info={info}
                zoneName={info.rule45 ? regionName(info.rule45.region) : null}
                showRule45={aids.sumRule45}
                kind={sumKind}
                onKind={setSumKind}
                onCreateVirtual={() => {
                  update((s) => addVirtualCage(s, info.cells, info.total));
                  setSumMode(false);
                  setSumSel(emptySelection());
                }}
              />
            );
          })()}
        </FloatingPanel>
      )}

      {!blocked && calcOpen && (
        <FloatingPanel
          title={T.calculatorTitle}
          start={{ x: panelX('right') + 70, y: 70 }}
          onClose={() => setCalcOpen(false)}
          compact
        >
          <CalculatorContent state={calcState} onChange={setCalcState} />
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
            onChange={(c) => {
              setFinder(c);
              setTarget('finder');
            }}
          />
        </FloatingPanel>
      )}

      {!blocked && virtualOpen && (
        <FloatingPanel
          title={T.virtualTitle}
          start={{ x: panelX('left'), y: 320 }}
          onClose={() => setVirtualOpen(false)}
        >
          <VirtualCagesContent
            cages={game.virtualCages}
            selectionSize={selection.length}
            suggestion={(() => {
              const s = suggestSum(record, selection);
              if (!s) return null;
              return {
                sum: s.sum,
                text:
                  s.reason === 'cages'
                    ? T.virtualSuggestCages(s.cages)
                    : T.virtualSuggestUnit(unitName(s.unit), s.cages),
              };
            })()}
            sum={virtualSum}
            onSum={(sum) => {
              setVirtualSum(sum);
              setTarget('virtual');
            }}
            onCreate={(sum) => {
              update((s) => addVirtualCage(s, selection, sum));
              setVirtualSum('');
            }}
            onShow={(cage) => {
              setSelection(cage.cells);
              setFocus(cage.cells[0]);
            }}
            onToggleHidden={(id) => update((s) => toggleVirtualHidden(s, id))}
            onRemove={(id) => update((s) => removeVirtualCage(s, id))}
          />
        </FloatingPanel>
      )}

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
              onClick={() => {
                setOptionsOpen(false);
                ask(T.restartConfirm, restart);
              }}
            >
              {T.restart}
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
            {aids.autoNotes && (
              <button
                type="button"
                onClick={() => {
                  update((s) => fillAllNotes(s, record));
                  setOptionsOpen(false);
                }}
              >
                {T.fillNotes}
              </button>
            )}
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
            {aids.check && !game.errorMode && (
              <button type="button" disabled={game.completed} onClick={runCheck}>
                {T.check}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setAidsOpen(true);
              }}
            >
              {T.aidsTitle}
            </button>
            <button type="button" onClick={props.onToggleFavorite}>
              {props.favorite ? T.favoriteRemove : T.favoriteAdd}
            </button>
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

      {aidsOpen && (
        <Modal onClose={() => setAidsOpen(false)}>
          <h2>{T.aidsTitle}</h2>
          <AidsContent
            aids={aids}
            onChange={(next) => update((s) => setAids(s, next))}
            purist={PURIST_AIDS}
            defaults={DEFAULT_AIDS}
          />
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setAidsOpen(false)}>
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

      {game.lost && (
        <Modal>
          <h2>{T.lostTitle}</h2>
          <p>{title}</p>
          <p>{T.lostText(MAX_ERRORS)}</p>
          <p className="victory-time">{T.lostTime(formatTime(game.elapsedMs))}</p>
          <div className="modal-actions vertical">
            <button type="button" className="primary" onClick={restart}>
              {T.restart}
            </button>
            <button type="button" className="secondary" onClick={onHome}>
              {T.backHome}
            </button>
          </div>
        </Modal>
      )}

      {game.completed && (
        <Modal>
          <h2>{T.victoryTitle}</h2>
          <p>{title}</p>
          <p className="victory-time">{T.victoryTime(formatTime(game.elapsedMs))}</p>
          <p>{T.victoryStats(game.hints, game.checks, game.errorMode ? game.errors : null)}</p>
          <p className="panel-help">{T.feelingQuestion}</p>
          <div className="feelings">
            {(Object.keys(T.feelings) as Feeling[]).map((f) => (
              <button
                key={f}
                type="button"
                className={finished?.feeling === f ? 'chosen' : ''}
                disabled={!finished}
                onClick={() => {
                  if (!finished) return;
                  const entry = { ...finished, feeling: f };
                  setFinished(entry);
                  void updateHistory(entry);
                }}
              >
                {T.feelings[f]}
              </button>
            ))}
          </div>
          <div className="modal-actions vertical">
            <button type="button" className="primary" onClick={onNext}>
              {T.nextGrid}
            </button>
            <button type="button" onClick={restart}>
              {T.replay}
            </button>
            <button type="button" className="secondary" onClick={props.onLibrary}>
              {T.library}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
