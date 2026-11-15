/**
 * Fenêtres de l'écran de jeu : Options (icône crayon), Menu (barre du haut), Aides de la partie,
 * confirmation, partie perdue et victoire. Elles ne font qu'afficher : toutes les actions sont reçues de
 * l'écran de jeu.
 */
import type { ReactNode } from 'react';
import { TEXTS } from '../../texts/fr';
import type { Feeling, HistoryEntry } from '../data/history';
import { formatTime } from './clock';
import { AidsContent } from './panels';
import { DEFAULT_AIDS, MAX_ERRORS, PURIST_AIDS, type Aids } from './state';

const T = TEXTS.game;

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal">{children}</div>
    </div>
  );
}

/** Menu Options (section 7.4) : effacer, recommencer, remplir les notes, annuler, rétablir. */
export function OptionsDialog(props: {
  hasSelection: boolean;
  showFillNotes: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onEraseAll: () => void;
  onRestart: () => void;
  onEraseSelection: () => void;
  onFillNotes: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={props.onClose}>
      <h2>{T.options}</h2>
      <div className="menu-list">
        <button type="button" onClick={props.onEraseAll}>
          {T.eraseAll}
        </button>
        <button type="button" onClick={props.onRestart}>
          {T.restart}
        </button>
        <button type="button" disabled={!props.hasSelection} onClick={props.onEraseSelection}>
          {T.eraseSelection}
        </button>
        {props.showFillNotes && (
          <button type="button" onClick={props.onFillNotes}>
            {T.fillNotes}
          </button>
        )}
        <button type="button" disabled={!props.canUndo} onClick={props.onUndo}>
          {T.undo}
        </button>
        <button type="button" disabled={!props.canRedo} onClick={props.onRedo}>
          {T.redo}
        </button>
        <button type="button" className="secondary" onClick={props.onClose}>
          {T.close}
        </button>
      </div>
    </Modal>
  );
}

/** Menu de la barre du haut : vérification, aides, favori, recommencer. */
export function MenuDialog(props: {
  showCheck: boolean;
  checkDisabled: boolean;
  favorite: boolean;
  onCheck: () => void;
  onAids: () => void;
  onToggleFavorite: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={props.onClose}>
      <h2>{T.menu}</h2>
      <div className="menu-list">
        {props.showCheck && (
          <button type="button" disabled={props.checkDisabled} onClick={props.onCheck}>
            {T.check}
          </button>
        )}
        <button type="button" onClick={props.onAids}>
          {T.aidsTitle}
        </button>
        <button type="button" onClick={props.onToggleFavorite}>
          {props.favorite ? T.favoriteRemove : T.favoriteAdd}
        </button>
        <button type="button" onClick={props.onRestart}>
          {T.restart}
        </button>
        <button type="button" className="secondary" onClick={props.onClose}>
          {T.close}
        </button>
      </div>
    </Modal>
  );
}

/** Aides de la partie en cours (section 9). */
export function AidsDialog(props: { aids: Aids; onChange: (aids: Aids) => void; onClose: () => void }) {
  return (
    <Modal onClose={props.onClose}>
      <h2>{T.aidsTitle}</h2>
      <AidsContent aids={props.aids} onChange={props.onChange} purist={PURIST_AIDS} defaults={DEFAULT_AIDS} />
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={props.onClose}>
          {T.close}
        </button>
      </div>
    </Modal>
  );
}

/** Demande de confirmation (tout effacer, recommencer la grille). */
export function ConfirmDialog(props: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={props.onCancel}>
      <p>{props.message}</p>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={props.onCancel}>
          {T.cancel}
        </button>
        <button type="button" className="primary" onClick={props.onConfirm}>
          {T.confirm}
        </button>
      </div>
    </Modal>
  );
}

/** Partie perdue à 3 erreurs (section 7.6). */
export function LostDialog(props: {
  title: string;
  elapsedMs: number;
  onRestart: () => void;
  onHome: () => void;
}) {
  return (
    <Modal>
      <h2>{T.lostTitle}</h2>
      <p>{props.title}</p>
      <p>{T.lostText(MAX_ERRORS)}</p>
      <p className="victory-time">{T.lostTime(formatTime(props.elapsedMs))}</p>
      <div className="modal-actions vertical">
        <button type="button" className="primary" onClick={props.onRestart}>
          {T.restart}
        </button>
        <button type="button" className="secondary" onClick={props.onHome}>
          {T.backHome}
        </button>
      </div>
    </Modal>
  );
}

/** Victoire (section 7.5) : temps, indices, vérifications, erreurs, puis ressenti. */
export function VictoryDialog(props: {
  title: string;
  elapsedMs: number;
  hints: number;
  checks: number;
  /** Erreurs commises, ou null si la partie n'était pas en mode erreurs. */
  errors: number | null;
  /** Ligne d'historique de la partie gagnée (absente tant qu'elle n'est pas enregistrée). */
  finished: HistoryEntry | null;
  onFeeling: (feeling: Feeling) => void;
  onNext: () => void;
  onReplay: () => void;
  onLibrary: () => void;
}) {
  const { finished } = props;
  return (
    <Modal>
      <h2>{T.victoryTitle}</h2>
      <p>{props.title}</p>
      <p className="victory-time">{T.victoryTime(formatTime(props.elapsedMs))}</p>
      <p>{T.victoryStats(props.hints, props.checks, props.errors)}</p>
      <p className="panel-help">{T.feelingQuestion}</p>
      <div className="feelings">
        {(Object.keys(T.feelings) as Feeling[]).map((f) => (
          <button
            key={f}
            type="button"
            className={finished?.feeling === f ? 'chosen' : ''}
            disabled={!finished}
            onClick={() => props.onFeeling(f)}
          >
            {T.feelings[f]}
          </button>
        ))}
      </div>
      <div className="modal-actions vertical">
        <button type="button" className="primary" onClick={props.onNext}>
          {T.nextGrid}
        </button>
        <button type="button" onClick={props.onReplay}>
          {T.replay}
        </button>
        <button type="button" className="secondary" onClick={props.onLibrary}>
          {T.library}
        </button>
      </div>
    </Modal>
  );
}
