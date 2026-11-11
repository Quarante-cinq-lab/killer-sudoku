/** Réglages de l'application (section 8.3). */
import { DEFAULT_AIDS, type Aids } from '../game/state';

export type NotesLayout = 'inline' | 'grid';
export type Theme = 'auto' | 'light' | 'dark';

/** Couleurs proposées pour le liseré des cages et pour le surlignage de la cage sélectionnée. */
export const CAGE_COLORS = {
  mauve: { light: '#8a81a6', dark: '#a198c2' },
  ardoise: { light: '#6b7a8f', dark: '#9aa8bb' },
  sarcelle: { light: '#3f8a8c', dark: '#6cb8b9' },
  brique: { light: '#a8604f', dark: '#d08d7c' },
} as const;

export const HIGHLIGHT_COLORS = {
  vert: { light: '#dcf1dc', dark: '#213b27' },
  bleu: { light: '#dceaf8', dark: '#1f3247' },
  jaune: { light: '#f8f0cf', dark: '#3e3820' },
  rose: { light: '#f6e0ea', dark: '#42263a' },
} as const;

export type CageColor = keyof typeof CAGE_COLORS;
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

export interface Settings {
  /** Aides activées au début de chaque nouvelle partie (section 9). */
  defaultAids: Aids;
  notesLayout: NotesLayout;
  theme: Theme;
  cageColor: CageColor;
  highlightColor: HighlightColor;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultAids: { ...DEFAULT_AIDS },
  notesLayout: 'inline',
  theme: 'auto',
  cageColor: 'mauve',
  highlightColor: 'vert',
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Relit des réglages (sauvegarde, fichier importé) : toute valeur inconnue reprend sa valeur par défaut. */
export function parseSettings(raw: unknown): Settings {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const aids = (typeof o.defaultAids === 'object' && o.defaultAids !== null ? o.defaultAids : {}) as Record<
    string,
    unknown
  >;
  const defaultAids = Object.fromEntries(
    Object.entries(DEFAULT_AIDS).map(([key, value]) => [key, typeof aids[key] === 'boolean' ? aids[key] : value]),
  ) as unknown as Aids;
  return {
    defaultAids,
    notesLayout: oneOf(o.notesLayout, ['inline', 'grid'], DEFAULT_SETTINGS.notesLayout),
    theme: oneOf(o.theme, ['auto', 'light', 'dark'], DEFAULT_SETTINGS.theme),
    cageColor: oneOf(o.cageColor, Object.keys(CAGE_COLORS) as CageColor[], DEFAULT_SETTINGS.cageColor),
    highlightColor: oneOf(
      o.highlightColor,
      Object.keys(HIGHLIGHT_COLORS) as HighlightColor[],
      DEFAULT_SETTINGS.highlightColor,
    ),
  };
}
