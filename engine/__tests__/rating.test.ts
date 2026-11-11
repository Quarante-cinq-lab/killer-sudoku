import { describe, expect, it } from 'vitest';
import { DIFFICULTY_CONFIG, parseDifficultyConfig, type DifficultyConfig } from '../difficulty';
import { TECHNIQUE_IDS, type Group } from '../logic/types';
import { cageStats, classify, ratePuzzle, type CageStats, type Summary } from '../rating';
import rawConfig from '../difficulty.config.json';
import data from './fixtures/killer-fixtures.json';

const expertCages: CageStats = { minSize: 2, maxSize: 5, singleCell: 0, uniqueCombo: 3 };

function summary(groups: Partial<Record<Group, number>>, techniques: Record<string, number> = {}): Summary {
  return {
    solved: true,
    score: 300, // dans les intervalles HARD et EXPERT de la configuration livrée
    techniques,
    groups: { A: 0, B: 0, C: 0, D: 0, ...groups },
    hardestPoints: 10,
  };
}

const withConfig = (change: (c: DifficultyConfig) => void): DifficultyConfig => {
  const copy = structuredClone(DIFFICULTY_CONFIG);
  change(copy);
  return copy;
};

describe('configuration de la difficulté', () => {
  it('donne un groupe et des points à chaque technique programmée', () => {
    expect(DIFFICULTY_CONFIG.techniques.map((t) => t.id).sort()).toEqual([...TECHNIQUE_IDS].sort());
  });

  it('essaie les techniques dans l’ordre des groupes : A, puis B, puis C, puis D', () => {
    const groups = DIFFICULTY_CONFIG.techniques.map((t) => t.group).join('');
    expect(groups).toMatch(/^A+B+C+D+$/);
  });

  it('refuse une technique inconnue ou un intervalle mal écrit', () => {
    const unknown = structuredClone(rawConfig) as unknown as Record<string, Record<string, unknown>>;
    unknown.techniques.teleportation = { group: 'A', points: 1 };
    expect(() => parseDifficultyConfig(unknown)).toThrow(/inconnue/);
    const badRange = structuredClone(rawConfig) as unknown as {
      levels: Record<string, Record<string, unknown>>;
    };
    badRange.levels.HARD.score = [1];
    expect(() => parseDifficultyConfig(badRange)).toThrow(/HARD.score/);
  });
});

describe('classement par niveau', () => {
  it('HARD : groupe A seulement, avec au moins 3 règles des 45', () => {
    const hardCages = { ...expertCages, minSize: 1, singleCell: 1 };
    expect(classify(summary({ A: 50 }, { rule45_single: 3 }), hardCages).level).toBe('HARD');
    expect(classify(summary({ A: 50 }, { rule45_single: 2 }), hardCages).rejection).toBe(
      'entre_deux_niveaux',
    );
  });

  it('EXPERT : au moins 2 étapes du groupe B ; une seule ne suffit pas', () => {
    expect(classify(summary({ A: 50, B: 2 }), expertCages).level).toBe('EXPERT');
    expect(classify(summary({ A: 50, B: 1 }), expertCages).rejection).toBe('entre_deux_niveaux');
  });

  it('niveaux supérieurs : le plus élevé l’emporte', () => {
    expect(classify(summary({ B: 4, C: 2 }), expertCages).level).toBe('DIABOLIQUE');
    expect(classify(summary({ C: 5 }), expertCages).level).toBe('EXTREME');
    expect(classify(summary({ D: 1 }), expertCages).level).toBe('EXTREME');
    expect(classify(summary({ D: 3 }), expertCages).level).toBe('ULTIME');
  });

  it('rejette une grille non résolue ou aux cages non conformes', () => {
    expect(classify({ ...summary({ B: 2 }), solved: false }, expertCages).rejection).toBe('non_resolue');
    const singles = { ...expertCages, minSize: 1, singleCell: 1 };
    expect(classify(summary({ B: 2 }), singles).rejection).toBe('cages_non_conformes');
    const tooManyUnique = { ...expertCages, uniqueCombo: 20 };
    expect(classify(summary({ B: 2 }), tooManyUnique).rejection).toBe('cages_non_conformes');
  });

  it('applique l’intervalle de score et la règle du goulot isolé', () => {
    const config = withConfig((c) => {
      c.levels.HARD.score = [100, 250];
      c.levels.EXPERT.score = [150, 400];
    });
    expect(classify({ ...summary({ B: 2 }), score: 120 }, expertCages, config).rejection).toBe(
      'score_hors_limites',
    );
    // 300 − 250 = 50 < 100 (minimum HARD) : la difficulté tient à une seule étape.
    expect(classify({ ...summary({ B: 2 }), hardestPoints: 250 }, expertCages, config).rejection).toBe(
      'goulot_isole',
    );
    expect(classify(summary({ B: 2 }), expertCages, config).level).toBe('EXPERT');
  });
});

describe('notation d’une grille', () => {
  const fixture = data.fixtures.find((f) => f.name === 'cages-moyennes-unique-2');

  it('additionne les points de chaque étape', () => {
    expect(fixture).toBeDefined();
    if (!fixture) return;
    const rating = ratePuzzle(fixture);
    const points = new Map(DIFFICULTY_CONFIG.techniques.map((t) => [t.id, t.points]));
    expect(rating.solved).toBe(true);
    expect(rating.score).toBe(rating.steps.reduce((s, step) => s + (points.get(step.technique) ?? 0), 0));
    expect(Object.values(rating.techniques).reduce((a, b) => a + b, 0)).toBe(rating.steps.length);
    expect(rating.entryPoints).toBeGreaterThan(0);
  });

  it('compte les cages d’une case et à combinaison unique', () => {
    const stats = cageStats({
      cages: [
        { sum: 3, cells: [0, 1] },
        { sum: 10, cells: [2, 3] },
        { sum: 5, cells: [4] },
      ],
    });
    expect(stats).toEqual({ minSize: 1, maxSize: 2, singleCell: 1, uniqueCombo: 2 });
  });

  it('refuse une grille mal formée', () => {
    expect(() => ratePuzzle({ cages: [{ sum: 3, cells: [0, 1] }] })).toThrow(/mal formée/);
  });
});
