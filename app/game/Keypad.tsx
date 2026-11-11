/**
 * Double clavier (section 7.3) : outils à gauche, grand pavé des chiffres, petit pavé des notes,
 * outils killer à droite. Les outils de l'étape 5 sont visibles mais grisés.
 */
import { TEXTS } from '../../texts/fr';
import { Icon, type IconName } from '../icons';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const T = TEXTS.game;

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDigit: (digit: number) => void;
  onNote: (digit: number) => void;
  onOptions: () => void;
}

function Tool({
  icon,
  label,
  onClick,
  enabled = true,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  enabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="tool"
      disabled={!enabled}
      onClick={onClick}
      title={enabled ? label : `${label} — ${T.comingSoon}`}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function Keypad({ canUndo, canRedo, disabled, onUndo, onRedo, onDigit, onNote, onOptions }: Props) {
  return (
    <div className="keypad">
      <div className="tools tools-left">
        <Tool icon="undo" label={T.undo} onClick={onUndo} enabled={canUndo && !disabled} />
        <Tool icon="redo" label={T.redo} onClick={onRedo} enabled={canRedo && !disabled} />
        <Tool icon="hint" label={T.hint} enabled={false} />
      </div>
      <div className="pad pad-digits" aria-label={T.digits}>
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => onDigit(d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="pad pad-notes" aria-label={T.notes}>
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => onNote(d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="tools tools-right">
        <Tool icon="calculator" label={T.combinations} enabled={false} />
        <Tool icon="notepad" label={T.calculator} enabled={false} />
        <Tool icon="pencil" label={T.options} onClick={onOptions} enabled={!disabled} />
        <Tool icon="virtualCage" label={T.virtualCages} enabled={false} />
      </div>
    </div>
  );
}
