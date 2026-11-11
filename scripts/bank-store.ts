/** Lecture et écriture des fichiers de la banque (data/bank-<niveau>.json). */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyBank, parseBank, serializeBank, type Bank } from '../engine/bank';
import type { Level } from '../engine/model';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

export function bankPath(level: Level): string {
  return `${DATA_DIR}bank-${level.toLowerCase()}.json`;
}

/** Charge la banque d'un niveau (vide si le fichier n'existe pas encore). */
export function loadBank(level: Level): Bank {
  const path = bankPath(level);
  if (!existsSync(path)) return emptyBank(level);
  const bank = parseBank(JSON.parse(readFileSync(path, 'utf8')));
  if (bank.level !== level) throw new Error(`${path} contient des grilles ${bank.level}.`);
  return bank;
}

/**
 * Enregistre la banque. On écrit d'abord un fichier temporaire, puis on le renomme : si le script est
 * interrompu pendant l'écriture, l'ancien fichier reste intact.
 */
export function saveBank(bank: Bank): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const path = bankPath(bank.level);
  writeFileSync(`${path}.tmp`, serializeBank(bank));
  renameSync(`${path}.tmp`, path);
}
