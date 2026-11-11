import { describe, expect, it } from 'vitest';
import { digitsOf } from '../bits';
import { parseBank } from '../bank';
import { DIFFICULTY_CONFIG } from '../difficulty';
import { findHint, hintEffect, playerState } from '../hint';
import { createContext } from '../logic/context';
import { describeStep, describeZone } from '../logic/describe';
import { solveLogically } from '../logic/solver';
import { applyStep, cloneState, initialState } from '../logic/state';
import type { LogicState } from '../logic/types';
import { parseSolution, type PuzzleRecord } from '../model';
import { TEXTS } from '../../texts/fr';
import hardBank from '../../data/bank-hard.json';
import expertBank from '../../data/bank-expert.json';

const GROUP = new Map(DIFFICULTY_CONFIG.techniques.map((t) => [t.id, t.group]));

/** La grille du joueur qui correspond à un état du solveur : chiffres posés, et candidats en notes. */
function asPlayer(state: LogicState): { values: number[]; notes: number[][] } {
  const values = Array.from(state.value);
  const notes = values.map((v, cell) => (v ? [] : digitsOf(state.cand[cell])));
  return { values, notes };
}

/** Position de test : la grille résolue pas à pas, arrêtée juste avant l'étape numéro `index`. */
function position(record: PuzzleRecord, index: number) {
  const ctx = createContext(record, DIFFICULTY_CONFIG.rule45MaxCells);
  const { steps } = solveLogically(ctx);
  const state = initialState(ctx);
  for (const step of steps.slice(0, index)) applyStep(state, ctx, step);
  return { ctx, expected: steps[index], state: cloneState(state) };
}

/**
 * Les 10 positions : dans les 40 premières grilles de chaque banque, la première apparition de chaque
 * technique ; on garde 10 techniques différentes, celles du groupe B (les plus difficiles) en premier.
 */
function testPositions(): { record: PuzzleRecord; index: number; technique: string }[] {
  const found = new Map<string, { record: PuzzleRecord; index: number; technique: string }>();
  const records = [
    ...parseBank(expertBank).puzzles.slice(0, 40),
    ...parseBank(hardBank).puzzles.slice(0, 40),
  ];
  for (const record of records) {
    const { steps } = solveLogically(createContext(record, DIFFICULTY_CONFIG.rule45MaxCells));
    steps.forEach((step, index) => {
      if (!found.has(step.technique)) found.set(step.technique, { record, index, technique: step.technique });
    });
  }
  const order = (t: string): number => (GROUP.get(t as never) === 'B' ? 0 : 1);
  return [...found.values()].sort((a, b) => order(a.technique) - order(b.technique)).slice(0, 10);
}

const positions = testPositions();

describe('indice progressif : 10 positions de test', () => {
  it('couvre 10 techniques différentes', () => {
    expect(new Set(positions.map((p) => p.technique)).size).toBe(10);
  });

  it.each(positions.map((p) => [p.technique, p.record.id, p] as const))(
    '%s (%s) : l’indice nomme la bonne technique et la bonne zone',
    (_, __, { record, index }) => {
      const { ctx, expected, state } = position(record, index);
      const solution = parseSolution(record.solution);
      const { values, notes } = asPlayer(state);
      const hint = findHint(ctx, solution, values, notes);
      expect(hint.kind).toBe('step');
      if (hint.kind !== 'step') return;
      expect(hint.step.technique).toBe(expected.technique);
      expect(describeStep(hint.step, ctx).name).toBe(TEXTS.techniques[expected.technique]);
      expect(describeZone(hint.step, ctx)).toBe(describeZone(expected, ctx));
      // La déduction proposée est juste : elle ne retire jamais le bon chiffre.
      for (const { cell, digit } of hint.step.placements) expect(digit).toBe(solution[cell]);
      for (const { cell, digits } of hint.step.eliminations)
        expect(digits & (1 << (solution[cell] - 1))).toBe(0);
    },
  );
});

describe('indice : cas particuliers', () => {
  const record = parseBank(hardBank).puzzles[0];
  const ctx = createContext(record, DIFFICULTY_CONFIG.rule45MaxCells);
  const solution = parseSolution(record.solution);
  const blank = () => ({
    values: new Array<number>(81).fill(0),
    notes: Array.from({ length: 81 }, (): number[] => []),
  });

  it('signale un chiffre faux au lieu de proposer une déduction', () => {
    const { values, notes } = blank();
    values[0] = (solution[0] % 9) + 1;
    expect(findHint(ctx, solution, values, notes)).toEqual({
      kind: 'error',
      wrongDigits: [0],
      missingNotes: [],
    });
  });

  it('signale une case dont les notes ont perdu le bon chiffre', () => {
    const { values, notes } = blank();
    notes[5] = [(solution[5] % 9) + 1];
    expect(findHint(ctx, solution, values, notes)).toEqual({
      kind: 'error',
      wrongDigits: [],
      missingNotes: [5],
    });
  });

  it('part de la grille vide avec la déduction la plus simple, et sait quand c’est fini', () => {
    const { values, notes } = blank();
    const hint = findHint(ctx, solution, values, notes);
    expect(hint.kind).toBe('step');
    expect(findHint(ctx, solution, solution, notes).kind).toBe('solved');
  });

  it('tient compte des notes du joueur', () => {
    const { values, notes } = blank();
    notes[0] = [solution[0]];
    const state = playerState(ctx, values, notes);
    expect(state?.cand[0]).toBe(1 << (solution[0] - 1));
  });

  it('applique la déduction : chiffres posés et notes à jour', () => {
    const { ctx: c, state } = position(record, positions[0].index);
    const { values, notes } = asPlayer(state);
    const hint = findHint(c, solution, values, notes);
    if (hint.kind !== 'step') throw new Error('déduction attendue');
    const effect = hintEffect(hint, values, notes);
    expect(effect.size).toBeGreaterThan(0);
    for (const [cell, content] of effect) {
      if (content.value) expect(content.value).toBe(solution[cell]);
      else expect(content.notes).toContain(solution[cell]);
    }
  });
});
