/**
 * Double clavier (section 7.3) : outils à gauche, grand pavé des chiffres, petit pavé des notes,
 * outils killer à droite. Un outil dont la fenêtre est ouverte apparaît enfoncé.
 */
import { TEXTS } from '../../texts/fr';
import { Icon, type IconName } from '../icons';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const T = TEXTS.game;

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  /** Le grand pavé écrit dans une fenêtre (calculatrice ou cage virtuelle) : il change de teinte. */
  digitsToPanel: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDigit: (digit: number) => void;
  onNote: (digit: number) => void;
  onOptions: () => void;
  onHint: () => void;
  hintEnabled: boolean;
  onCombinations: () => void;
  onFinder: () => void;
  onCalculator: () => void;
  onVirtualCages: () => void;
  onSum: () => void;
  /** Mode Somme : les pavés de chiffres et de notes sont inactifs. */
  padsDisabled: boolean;
  /** Fenêtres ouvertes (boutons affichés enfoncés). */
  open: { combinations: boolean; finder: boolean; calculator: boolean; virtualCages: boolean; sum: boolean };
}

function Tool({
  icon,
  label,
  onClick,
  enabled = true,
  pressed = false,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  enabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className={pressed ? 'tool pressed' : 'tool'}
      disabled={!enabled}
      onClick={onClick}
      aria-pressed={pressed}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function Keypad(props: Props) {
  const { canUndo, canRedo, disabled, onUndo, onRedo, onDigit, onNote, onOptions, open } = props;
  return (
    <div className="keypad">
      <div className="tools tools-left">
        <Tool icon="undo" label={T.undo} onClick={onUndo} enabled={canUndo && !disabled} />
        <Tool icon="redo" label={T.redo} onClick={onRedo} enabled={canRedo && !disabled} />
        <Tool icon="hint" label={T.hint} onClick={props.onHint} enabled={props.hintEnabled && !disabled} />
        <Tool icon="sum" label={T.sum} onClick={props.onSum} enabled={!disabled} pressed={open.sum} />
      </div>
      <div
        className={props.digitsToPanel ? 'pad pad-digits to-panel' : 'pad pad-digits'}
        aria-label={T.digits}
      >
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={disabled || props.padsDisabled} onClick={() => onDigit(d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="pad pad-notes" aria-label={T.notes}>
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={disabled || props.padsDisabled} onClick={() => onNote(d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="tools tools-right">
        <Tool
          icon="cageList"
          label={T.combinations}
          onClick={props.onCombinations}
          enabled={!disabled}
          pressed={open.combinations}
        />
        <Tool
          icon="notepad"
          label={T.finder}
          onClick={props.onFinder}
          enabled={!disabled}
          pressed={open.finder}
        />
        <Tool
          icon="calculator"
          label={T.calculator}
          onClick={props.onCalculator}
          enabled={!disabled}
          pressed={open.calculator}
        />
        <Tool icon="pencil" label={T.options} onClick={onOptions} enabled={!disabled} />
        <Tool
          icon="virtualCage"
          label={T.virtualCages}
          onClick={props.onVirtualCages}
          enabled={!disabled}
          pressed={open.virtualCages}
        />
      </div>
    </div>
  );
}
