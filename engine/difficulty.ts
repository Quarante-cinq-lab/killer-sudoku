import rawConfig from './difficulty.config.json';
import { LEVELS, type Level } from './model';
import { GROUPS, TECHNIQUE_IDS, type Group, type TechniqueId } from './logic/types';

/** Intervalle [minimum, maximum] ; null = sans limite. */
export type Range = [number | null, number | null];

export interface LevelConfig {
  conditions: Record<string, Range>[];
  score: Range;
  cages: { minSize: number; maxSize: number; maxSingleCell: number; maxUniqueCombo: number | null };
}

/** Profil de génération d'un niveau (section 6.1). */
export interface GenerationProfile {
  /** Poids de chaque taille de cage visée : [taille, poids]. */
  cageSizes: [number, number][];
  /** Nombre maximal de retouches pour rendre la solution unique. */
  maxRepairs: number;
  /**
   * Recherche ciblée (niveaux difficiles) : partir d'une grille du niveau `from`, puis retoucher ses cages
   * au plus `steps` fois, en ne gardant que les retouches qui la rendent plus difficile.
   */
  harden?: { from: Level; steps: number };
}

export interface DifficultyConfig {
  version: number;
  /** Techniques dans leur ordre d'essai, avec leur groupe et leurs points. */
  techniques: { id: TechniqueId; group: Group; points: number }[];
  rule45MaxCells: number;
  bottleneck: { enabled: boolean };
  levels: Record<Level, LevelConfig>;
  generation: Record<Level, GenerationProfile>;
}

function fail(message: string): never {
  throw new Error(`difficulty.config.json : ${message}`);
}

function parseRange(value: unknown, where: string): Range {
  const ok = (x: unknown): boolean => x === null || (typeof x === 'number' && Number.isFinite(x));
  if (!Array.isArray(value) || value.length !== 2 || !ok(value[0]) || !ok(value[1])) {
    fail(`${where} doit être [minimum, maximum] (nombres ou null).`);
  }
  return [value[0] as number | null, value[1] as number | null];
}

/** Lit et vérifie le fichier de configuration. Lève une erreur claire si un paramètre est faux. */
export function parseDifficultyConfig(raw: unknown): DifficultyConfig {
  const o = raw as Record<string, unknown>;
  if (typeof o !== 'object' || o === null) fail('objet attendu.');
  const techniquesRaw = o.techniques as Record<string, { group?: unknown; points?: unknown }> | undefined;
  if (!techniquesRaw || typeof techniquesRaw !== 'object') fail('« techniques » manquant.');
  const techniques = Object.entries(techniquesRaw).map(([id, t]) => {
    if (!(TECHNIQUE_IDS as readonly string[]).includes(id)) fail(`technique inconnue « ${id} ».`);
    if (!(GROUPS as readonly unknown[]).includes(t.group)) fail(`groupe invalide pour « ${id} ».`);
    if (typeof t.points !== 'number' || t.points < 0) fail(`points invalides pour « ${id} ».`);
    return { id: id as TechniqueId, group: t.group as Group, points: t.points };
  });
  for (const id of TECHNIQUE_IDS) {
    if (!techniques.some((t) => t.id === id)) fail(`la technique « ${id} » n'a pas de paramètres.`);
  }
  const levelsRaw = o.levels as Record<string, Record<string, unknown>> | undefined;
  if (!levelsRaw) fail('« levels » manquant.');
  const levels = {} as Record<Level, LevelConfig>;
  for (const level of LEVELS) {
    const l = levelsRaw[level];
    if (!l) fail(`niveau « ${level} » manquant.`);
    if (!Array.isArray(l.conditions) || l.conditions.length === 0)
      fail(`${level}.conditions doit être une liste.`);
    const conditions = (l.conditions as Record<string, unknown>[]).map((alt, i) => {
      const parsed: Record<string, Range> = {};
      for (const [key, range] of Object.entries(alt)) {
        const known =
          (GROUPS as readonly string[]).includes(key) || (TECHNIQUE_IDS as readonly string[]).includes(key);
        if (!known) fail(`${level}.conditions[${i}] : « ${key} » n'est ni un groupe ni une technique.`);
        parsed[key] = parseRange(range, `${level}.conditions[${i}].${key}`);
      }
      return parsed;
    });
    const cages = l.cages as LevelConfig['cages'] | undefined;
    if (!cages || typeof cages.minSize !== 'number' || typeof cages.maxSize !== 'number') {
      fail(`${level}.cages incomplet.`);
    }
    levels[level] = { conditions, score: parseRange(l.score, `${level}.score`), cages };
  }
  const generationRaw = o.generation as Record<string, Record<string, unknown>> | undefined;
  if (!generationRaw) fail('« generation » manquant.');
  const generation = {} as Record<Level, GenerationProfile>;
  for (const level of LEVELS) {
    const g = generationRaw[level];
    if (!g) fail(`generation.${level} manquant.`);
    const sizes = g.cageSizes as Record<string, unknown> | undefined;
    if (!sizes || typeof sizes !== 'object') fail(`generation.${level}.cageSizes manquant.`);
    const cageSizes = Object.entries(sizes).map(([size, weight]): [number, number] => {
      const n = Number(size);
      if (!Number.isInteger(n) || n < 1 || n > levels[level].cages.maxSize)
        fail(`generation.${level}.cageSizes : taille « ${size} » invalide.`);
      if (typeof weight !== 'number' || weight < 0)
        fail(`generation.${level}.cageSizes : poids invalide pour « ${size} ».`);
      return [n, weight];
    });
    if (!cageSizes.some(([, w]) => w > 0)) fail(`generation.${level}.cageSizes : aucun poids positif.`);
    const maxRepairs = g.maxRepairs;
    if (typeof maxRepairs !== 'number' || maxRepairs < 0) fail(`generation.${level}.maxRepairs invalide.`);
    const harden = g.harden as { from?: unknown; steps?: unknown } | undefined;
    if (harden !== undefined) {
      if (!LEVELS.includes(harden.from as Level) || typeof harden.steps !== 'number' || harden.steps < 1)
        fail(`generation.${level}.harden doit être { "from": niveau, "steps": nombre }.`);
      generation[level] = {
        cageSizes,
        maxRepairs,
        harden: { from: harden.from as Level, steps: harden.steps },
      };
    } else generation[level] = { cageSizes, maxRepairs };
  }
  const bottleneck = o.bottleneck as { enabled?: unknown } | undefined;
  return {
    version: typeof o.version === 'number' ? o.version : 1,
    techniques,
    rule45MaxCells: typeof o.rule45MaxCells === 'number' ? o.rule45MaxCells : 5,
    bottleneck: { enabled: bottleneck?.enabled === true },
    levels,
    generation,
  };
}

/** Configuration livrée avec le moteur. */
export const DIFFICULTY_CONFIG: DifficultyConfig = parseDifficultyConfig(rawConfig);
