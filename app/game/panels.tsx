/**
 * Fenêtres des outils killer (section 7.4) et des aides (section 9) : combinaisons, calculatrice,
 * cages virtuelles (fenêtres flottantes déplaçables) et réglage des aides de la partie.
 */
import { useRef, useState, type ReactNode } from 'react';
import { TEXTS } from '../../texts/fr';
import { Icon } from '../icons';
import type { ComboLine, ComboSource } from './aids';
import type { Aids, VirtualCage } from './state';
import { display, pressKey, type CalcKey, type CalcState } from './calculator';

const T = TEXTS.game;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Fenêtre flottante : on la déplace en faisant glisser sa barre de titre, on la ferme par « x ». */
export function FloatingPanel({
  title,
  start,
  onClose,
  children,
  compact = false,
}: {
  title: string;
  /** Fenêtre étroite (calculatrice), pour masquer la grille le moins possible. */
  compact?: boolean;
  /** Position de départ, en pixels depuis le coin haut gauche de l'écran. */
  start: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
}) {
  const [pos, setPos] = useState(start);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <section
      className={compact ? 'floating compact' : 'floating'}
      style={{ left: pos.x, top: pos.y }}
      aria-label={title}
    >
      <header
        className="floating-bar"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const x = Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120);
          const y = Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 60);
          setPos({ x, y });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <h2>{title}</h2>
        <button
          type="button"
          className="floating-close"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label={T.close}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="floating-body">{children}</div>
    </section>
  );
}

/** Fenêtre des combinaisons de la cage sélectionnée (et de ses cages virtuelles). */
export function CombinationsContent({
  sources,
  linesOf,
  struck,
  filter,
  mayRepeat,
  onToggle,
}: {
  sources: readonly ComboSource[];
  linesOf: (source: ComboSource) => ComboLine[];
  struck: Readonly<Record<string, number[]>>;
  filter: boolean;
  mayRepeat: (source: ComboSource) => boolean;
  onToggle: (key: string, mask: number) => void;
}) {
  if (sources.length === 0) return <p className="panel-help">{T.selectCell}</p>;
  return (
    <>
      {sources.map((source) => {
        const lines = linesOf(source);
        return (
          <div key={source.key} className="combo-group">
            <h3>
              {source.virtual
                ? T.virtualCageLabel(source.sum, source.cells.length)
                : T.cageLabel(source.sum, source.cells.length)}
            </h3>
            {mayRepeat(source) && <p className="panel-help">{T.mayRepeat}</p>}
            {lines.length === 0 && <p className="panel-help">{T.noCombination}</p>}
            <div className="combo-list">
              {lines.map((line) => {
                const isStruck = struck[source.key]?.includes(line.mask) ?? false;
                const greyed = filter && !line.compatible;
                return (
                  <button
                    key={line.mask}
                    type="button"
                    className={`combo${isStruck ? ' struck' : ''}${greyed ? ' greyed' : ''}`}
                    onClick={() => onToggle(source.key, line.mask)}
                  >
                    {line.digits.join('')}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="panel-help">{T.strikeHelp}</p>
    </>
  );
}

export interface FinderState {
  sum: string;
  count: string;
  active: 'sum' | 'count';
  /** Chiffres obligatoires et exclus (masques sur 9 bits). */
  required: number;
  excluded: number;
  listed: boolean;
}

export const emptyFinder = (): FinderState => ({
  sum: '',
  count: '',
  active: 'sum',
  required: 0,
  excluded: 0,
  listed: false,
});

/** Saisie d'un chiffre (ou de « 0 ») dans le champ actif de la calculatrice. */
export function typeInFinder(calc: FinderState, digit: number): FinderState {
  const field = calc[calc.active];
  const max = calc.active === 'sum' ? 45 : 9;
  const next = field === '0' ? String(digit) : field + String(digit);
  if (Number(next) > max) return calc;
  return { ...calc, [calc.active]: next, listed: false };
}

/** Calculatrice libre : « Somme » et « Nombre de cases », remplis avec le pavé chiffres. */
export function FinderContent({
  calc,
  lines,
  onChange,
}: {
  calc: FinderState;
  lines: number[][];
  onChange: (calc: FinderState) => void;
}) {
  const field = (name: 'sum' | 'count', label: string) => (
    <button
      type="button"
      className={`calc-field${calc.active === name ? ' active' : ''}`}
      onClick={() => onChange({ ...calc, active: name })}
    >
      <span>{label}</span>
      <strong>{calc[name] || '–'}</strong>
    </button>
  );
  const cycle = (d: number) => {
    const bit = 1 << (d - 1);
    if (calc.required & bit)
      onChange({ ...calc, required: calc.required & ~bit, excluded: calc.excluded | bit, listed: false });
    else if (calc.excluded & bit) onChange({ ...calc, excluded: calc.excluded & ~bit, listed: false });
    else onChange({ ...calc, required: calc.required | bit, listed: false });
  };
  return (
    <>
      <div className="calc-fields">
        {field('sum', T.calcSum)}
        {field('count', T.calcCount)}
      </div>
      <div className="calc-keys">
        <button type="button" onClick={() => onChange(typeInFinder(calc, 0))}>
          0
        </button>
        <button type="button" onClick={() => onChange({ ...calc, [calc.active]: '', listed: false })}>
          {T.calcClear}
        </button>
      </div>
      <p className="panel-help">{T.calcTyping}</p>
      <p className="panel-help">{T.calcDigits}</p>
      <div className="calc-digits">
        {DIGITS.map((d) => {
          const bit = 1 << (d - 1);
          const state = calc.required & bit ? 'required' : calc.excluded & bit ? 'excluded' : '';
          return (
            <button key={d} type="button" className={state} onClick={() => cycle(d)}>
              {d}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="primary calc-list"
        disabled={!calc.sum || !calc.count}
        onClick={() => onChange({ ...calc, listed: true })}
      >
        {T.calcList}
      </button>
      {calc.listed && (
        <div className="combo-list">
          {lines.length === 0 && <p className="panel-help">{T.noCombination}</p>}
          {lines.map((digits) => (
            <span key={digits.join('')} className="combo static">
              {digits.join('')}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** Cages virtuelles : création à partir de la sélection, liste, suppression. */
export function VirtualCagesContent({
  cages,
  selectionSize,
  sum,
  onSum,
  onCreate,
  onShow,
  onRemove,
}: {
  cages: readonly VirtualCage[];
  selectionSize: number;
  sum: string;
  onSum: (sum: string) => void;
  onCreate: () => void;
  onShow: (cage: VirtualCage) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <>
      <p className="panel-help">{T.virtualHelp}</p>
      <div className="calc-fields">
        <div className="calc-field active">
          <span>{T.calcSum}</span>
          <strong>{sum || '–'}</strong>
        </div>
        <div className="calc-keys vertical">
          <button
            type="button"
            onClick={() => onSum(sum && sum !== '0' && Number(sum + '0') <= 405 ? sum + '0' : sum)}
          >
            0
          </button>
          <button type="button" onClick={() => onSum('')}>
            {T.calcClear}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="primary calc-list"
        disabled={selectionSize === 0 || !sum}
        onClick={onCreate}
      >
        {T.virtualCreate(selectionSize)}
      </button>
      {cages.length === 0 ? (
        <p className="panel-help">{T.virtualNone}</p>
      ) : (
        <ul className="virtual-list">
          {cages.map((cage) => (
            <li key={cage.id}>
              <span>{T.virtualItem(cage.sum, cage.cells.length)}</span>
              <button type="button" onClick={() => onShow(cage)}>
                {T.show}
              </button>
              <button type="button" onClick={() => onRemove(cage.id)}>
                {T.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Réglage des aides de la partie (section 9), avec le préréglage « Puriste ». */
export function AidsContent({
  aids,
  onChange,
  purist,
  defaults,
}: {
  aids: Aids;
  onChange: (aids: Aids) => void;
  purist: Aids;
  defaults: Aids;
}) {
  return (
    <div className="aids-list">
      {(Object.keys(T.aids) as (keyof Aids)[]).map((key) => (
        <label key={key} className="aid-row">
          <span>{T.aids[key]}</span>
          <input
            type="checkbox"
            role="switch"
            checked={aids[key]}
            onChange={(e) => onChange({ ...aids, [key]: e.target.checked })}
          />
        </label>
      ))}
      <div className="modal-actions">
        <button type="button" onClick={() => onChange(purist)}>
          {T.purist}
        </button>
        <button type="button" onClick={() => onChange(defaults)}>
          {T.allAids}
        </button>
      </div>
    </div>
  );
}

const CALC_KEYS: CalcKey[][] = [
  ['C', '←', '÷', '×'],
  ['7', '8', '9', '−'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '='],
  ['0'],
];

/** Calculatrice (évolution E3) : ses propres touches, l'opération en cours et le résultat. */
export function CalculatorContent({
  state,
  onChange,
}: {
  state: CalcState;
  onChange: (state: CalcState) => void;
}) {
  const { operation, value } = display(state, T.calcError);
  return (
    <div className="calculator">
      <div className="calc-screen" aria-live="polite">
        <span className="calc-operation">{operation || ' '}</span>
        <strong className="calc-value">{value || ' '}</strong>
      </div>
      <div className="calc-pad">
        {CALC_KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            className={key === '=' ? 'primary calc-equals' : /d/.test(key) ? 'calc-digit' : 'calc-op'}
            onClick={() => onChange(pressKey(state, key))}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
