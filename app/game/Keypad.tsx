/**
 * Double clavier (section 7.3) : outils à gauche, grand pavé des chiffres, petit pavé des notes,
 * outils killer à droite. Un outil dont la fenêtre est ouverte apparaît enfoncé.
 *
 * Toutes les touches réagissent dès que le doigt se pose (retours d'essai du 15 novembre 2026) : attendre
 * que le doigt se relève faisait perdre des appuis brefs ou un peu glissés sur l'iPad.
 */
import type { PointerEvent, ReactNode } from 'react';
import { TEXTS } from '../../texts/fr';
import { Icon, type IconName } from '../icons';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const T = TEXTS.game;

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  /** Le grand pavé écrit dans une fenêtre (Combinaisons) : il change de teinte. */
  digitsToPanel: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDigit: (digit: number) => void;
  onNote: (digit: number) => void;
  onOptions: () => void;
  onHint: () => void;
  hintEnabled: boolean;
  /** Indices encore disponibles dans la partie. */
  hintsLeft: number;
  onCombinations: () => void;
  onFinder: () => void;
  onCalculator: () => void;
  /** Fenêtres ouvertes (boutons affichés enfoncés). */
  open: { combinations: boolean; finder: boolean; calculator: boolean };
}

/**
 * Bouton qui agit dès que le doigt (ou le stylet, ou la souris) se pose. Un appui au clavier physique
 * (Entrée, Espace) passe toujours par le « clic » habituel.
 */
export function PressButton({
  onPress,
  disabled = false,
  className,
  children,
  label,
  pressed,
}: {
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  label?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        e.preventDefault(); // évite le « clic » qui suivrait, et tout zoom ou sélection de texte
        onPress();
      }}
      onClick={(e) => {
        // detail = 0 : activation au clavier physique (pas de pointeur).
        if (e.detail === 0) onPress();
      }}
    >
      {children}
    </button>
  );
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
  onClick: () => void;
  enabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <PressButton
      className={pressed ? 'tool pressed' : 'tool'}
      disabled={!enabled}
      onPress={onClick}
      pressed={pressed}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </PressButton>
  );
}

export function Keypad(props: Props) {
  const { canUndo, canRedo, disabled, onUndo, onRedo, onDigit, onNote, onOptions, open } = props;
  return (
    <div className="keypad">
      <div className="tools tools-left">
        <Tool icon="undo" label={T.undo} onClick={onUndo} enabled={canUndo && !disabled} />
        <Tool icon="redo" label={T.redo} onClick={onRedo} enabled={canRedo && !disabled} />
        <Tool
          icon="hint"
          label={T.hintLeft(props.hintsLeft)}
          onClick={props.onHint}
          enabled={props.hintEnabled && props.hintsLeft > 0 && !disabled}
        />
      </div>
      <div
        className={props.digitsToPanel ? 'pad pad-digits to-panel' : 'pad pad-digits'}
        aria-label={T.digits}
      >
        {DIGITS.map((d) => (
          <PressButton key={d} disabled={disabled} onPress={() => onDigit(d)}>
            {d}
          </PressButton>
        ))}
      </div>
      <div className="pad pad-notes" aria-label={T.notes}>
        {DIGITS.map((d) => (
          <PressButton key={d} disabled={disabled} onPress={() => onNote(d)}>
            {d}
          </PressButton>
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
      </div>
    </div>
  );
}
