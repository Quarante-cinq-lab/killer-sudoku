/**
 * Réglages (section 8.3) : aides par défaut, affichage (notes, thème, couleurs), export et import de la
 * sauvegarde, import d'une banque complémentaire, et « À propos ».
 */
import { useRef, useState, type ReactNode } from 'react';
import { LEVELS, type Level } from '../../engine/model';
import { ENGINE_VERSION } from '../../engine/version';
import { TEXTS } from '../../texts/fr';
import { CAGE_COLORS, HIGHLIGHT_COLORS, type Settings } from '../data/settings';
import { AidsContent } from '../game/panels';
import { DEFAULT_AIDS, PURIST_AIDS } from '../game/state';
import { Icon } from '../icons';

const S = TEXTS.settings;

interface Props {
  settings: Settings;
  gridsPerLevel: Record<Level, number>;
  onChange: (settings: Settings) => void;
  onExport: () => Promise<void>;
  /** Lit un fichier de sauvegarde : renvoie de quoi demander confirmation, ou lève une erreur. */
  onReadBackup: (text: string) => { games: number; history: number; apply: () => Promise<void> };
  onImportBank: (text: string) => Promise<{ added: number; skipped: number }>;
  onBack: () => void;
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string; swatch?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'chip on' : 'chip'}
          onClick={() => onChange(o.value)}
        >
          {o.swatch && <i className="swatch" style={{ background: o.swatch }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen(props: Props) {
  const { settings, onChange } = props;
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    games: number;
    history: number;
    apply: () => Promise<void>;
  } | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const bankInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  /** Lit le fichier choisi par le joueur (dans Fichiers sur l'iPad). */
  const readFile = async (input: HTMLInputElement | null): Promise<string | null> => {
    const file = input?.files?.[0];
    if (input) input.value = '';
    return file ? file.text() : null;
  };

  const fail = (error: unknown) =>
    setMessage(S.readError(error instanceof Error ? error.message : String(error)));

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="bar-button" onClick={props.onBack}>
          <Icon name="back" />
          <span>{S.back}</span>
        </button>
        <h1>{S.title}</h1>
        <span className="topbar-spacer" />
      </header>
      <div className="library-scroll settings">
        {message && <p className="notice">{message}</p>}

        <Section title={S.aidsTitle}>
          <AidsContent
            aids={settings.defaultAids}
            onChange={(aids) => set('defaultAids', aids)}
            purist={PURIST_AIDS}
            defaults={DEFAULT_AIDS}
          />
        </Section>

        <Section title={S.displayTitle}>
          <h3>{S.notes}</h3>
          <Choice
            value={settings.notesLayout}
            options={[
              { value: 'inline', label: S.notesInline },
              { value: 'grid', label: S.notesGrid },
            ]}
            onChange={(v) => set('notesLayout', v)}
          />
          <h3>{S.theme}</h3>
          <Choice
            value={settings.theme}
            options={(['auto', 'light', 'dark'] as const).map((v) => ({ value: v, label: S.themes[v] }))}
            onChange={(v) => set('theme', v)}
          />
          <h3>{S.cageColor}</h3>
          <Choice
            value={settings.cageColor}
            options={(Object.keys(CAGE_COLORS) as (keyof typeof CAGE_COLORS)[]).map((v) => ({
              value: v,
              label: S.colors[v],
              swatch: CAGE_COLORS[v].light,
            }))}
            onChange={(v) => set('cageColor', v)}
          />
          <h3>{S.highlightColor}</h3>
          <Choice
            value={settings.highlightColor}
            options={(Object.keys(HIGHLIGHT_COLORS) as (keyof typeof HIGHLIGHT_COLORS)[]).map((v) => ({
              value: v,
              label: S.colors[v],
              swatch: HIGHLIGHT_COLORS[v].light,
            }))}
            onChange={(v) => set('highlightColor', v)}
          />
        </Section>

        <Section title={S.backupTitle}>
          <p className="panel-help">{S.backupHelp}</p>
          <div className="settings-buttons">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setMessage(null);
                props.onExport().then(() => setMessage(S.exportDone), fail);
              }}
            >
              {S.export}
            </button>
            <button type="button" onClick={() => backupInput.current?.click()}>
              {S.import}
            </button>
          </div>
          <input
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              setMessage(null);
              const text = await readFile(e.currentTarget);
              if (text === null) return;
              try {
                setPending(props.onReadBackup(text));
              } catch (error) {
                fail(error);
              }
            }}
          />
        </Section>

        <Section title={S.bankTitle}>
          <p className="panel-help">{S.bankHelp}</p>
          <div className="settings-buttons">
            <button type="button" onClick={() => bankInput.current?.click()}>
              {S.bankImport}
            </button>
          </div>
          <input
            ref={bankInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              setMessage(null);
              const text = await readFile(e.currentTarget);
              if (text === null) return;
              props
                .onImportBank(text)
                .then(({ added, skipped }) => setMessage(S.bankDone(added, skipped)), fail);
            }}
          />
        </Section>

        <Section title={S.aboutTitle}>
          <p>{TEXTS.home.version(__APP_VERSION__, ENGINE_VERSION)}</p>
          <h3>{S.gridsPerLevel}</h3>
          <ul className="about-list">
            {LEVELS.map((level) => (
              <li key={level}>
                {TEXTS.levels[level]} : {props.gridsPerLevel[level]}
              </li>
            ))}
          </ul>
          <p className="panel-help">{S.privacy}</p>
          <p className="panel-help">{S.legal}</p>
        </Section>
      </div>

      {pending && (
        <div className="modal-backdrop">
          <div className="modal">
            <p>{S.importConfirm(pending.games, pending.history)}</p>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setPending(null)}>
                {TEXTS.game.cancel}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const apply = pending.apply;
                  setPending(null);
                  apply().then(() => setMessage(S.importDone), fail);
                }}
              >
                {TEXTS.game.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
