/**
 * Applique les réglages d'affichage à la page : thème (clair, sombre, automatique) et couleurs du liseré
 * des cages et du surlignage. Les couleurs passent par des variables CSS (voir styles.css).
 */
import { CAGE_COLORS, HIGHLIGHT_COLORS, type Settings } from './settings';

export function applyAppearance(settings: Settings, root: HTMLElement = document.documentElement): void {
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  const cage = CAGE_COLORS[settings.cageColor];
  const highlight = HIGHLIGHT_COLORS[settings.highlightColor];
  root.style.setProperty('--cage-light', cage.light);
  root.style.setProperty('--cage-dark', cage.dark);
  root.style.setProperty('--highlight-light', highlight.light);
  root.style.setProperty('--highlight-dark', highlight.dark);
}

/** Enregistre un fichier : feuille de partage de l'iPad si possible (« Enregistrer dans Fichiers »), sinon téléchargement. */
export async function saveFile(name: string, text: string): Promise<void> {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // Partage annulé par le joueur : rien d'autre à faire.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
