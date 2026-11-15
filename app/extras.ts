/**
 * Grilles importées en complément de la banque : relues au démarrage et après l'import d'une sauvegarde.
 */
import { conflictingIds, registerExtraPuzzles } from './bank';
import { loadExtraPuzzles, renamePuzzles } from './storage';

/**
 * Relit les grilles importées et les ajoute à la banque en mémoire. Si une mise à jour de l'application a
 * livré une autre grille sous le même identifiant, la grille importée change d'identifiant, avec sa partie
 * et son historique (voir conflictingIds), pour que rien ne soit rattaché à la mauvaise grille.
 */
export async function restoreExtraPuzzles(): Promise<void> {
  const extras = await loadExtraPuzzles();
  const renames = conflictingIds(extras);
  await renamePuzzles(renames);
  registerExtraPuzzles(extras.map((p) => ({ ...p, id: renames.get(p.id) ?? p.id })));
}
