/** Cages virtuelles (refonte E5, section 7.4). */
import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import { cageIndexByCell, parseSolution, UNITS } from '../../engine/model';
import expertBank from '../../data/bank-expert.json';
import { comboSources } from './aids';
import { addVirtualCage, newGame, toggleVirtualHidden, undo, type VirtualCage } from './state';
import { suggestSum, virtualColor, virtualConflictCells, VIRTUAL_COLORS } from './virtual';

const record = parseBank(expertBank).puzzles[0];
const solution = parseSolution(record.solution);
const owner = cageIndexByCell(record);
const empty = (): number[] => new Array<number>(81).fill(0);
const sumOf = (cells: readonly number[]): number => cells.reduce((s, c) => s + solution[c], 0);

describe('somme proposée à la création (trois cas)', () => {
  it('réunion de cages entières : la somme de ces cages', () => {
    const cells = [...record.cages[0].cells, ...record.cages[1].cells];
    expect(suggestSum(record, cells)).toEqual({
      sum: record.cages[0].sum + record.cages[1].sum,
      reason: 'cages',
      cages: 2,
    });
    expect(suggestSum(record, cells)?.sum).toBe(sumOf(cells));
  });

  it('une unité moins des cages entières : 45 moins ces cages', () => {
    // On cherche une unité qui contient au moins une cage entière, sans être faite que de cages entières.
    for (let unit = 0; unit < 27; unit++) {
      const zone = UNITS[unit];
      const inside = [...new Set(zone.map((c) => owner[c]))].filter((k) =>
        record.cages[k].cells.every((c) => zone.includes(c)),
      );
      if (inside.length === 0) continue;
      const removed = new Set(inside.flatMap((k) => record.cages[k].cells));
      const cells = zone.filter((c) => !removed.has(c));
      if (cells.length === 0 || suggestSum(record, cells)?.reason !== 'unit') continue;
      const suggestion = suggestSum(record, cells);
      expect(suggestion?.sum).toBe(45 - inside.reduce((s, k) => s + record.cages[k].sum, 0));
      expect(suggestion?.sum).toBe(sumOf(cells));
      return;
    }
    throw new Error('aucune unité de test trouvée');
  });

  it('autre sélection : pas de proposition, le joueur tape la somme', () => {
    // L1C1 et L5C5 : ni dans une même unité, ni des cages entières (une grille EXPERT n'a pas de cage d'une case).
    expect(record.cages[owner[0]].cells.length).toBeGreaterThan(1);
    expect(suggestSum(record, [0, 40])).toBeNull();
    expect(suggestSum(record, [])).toBeNull();
  });
});

describe('conflits des cages virtuelles', () => {
  const row: VirtualCage = { id: 1, sum: 10, cells: [0, 1, 2] }; // trois cases d'une ligne : chiffres différents
  const scattered: VirtualCage = { id: 2, sum: 10, cells: [0, 40, 80] }; // chiffres qui peuvent se répéter

  it('somme dépassée', () => {
    const values = empty();
    values[0] = 9;
    values[1] = 8;
    expect([...virtualConflictCells(record, values, [row])].sort()).toEqual([0, 1]);
  });

  it('plus aucune combinaison possible quand les cases se voient', () => {
    const values = empty();
    values[0] = 1;
    values[1] = 2; // il faudrait 7 en L1C3 : possible
    expect(virtualConflictCells(record, values, [row]).size).toBe(0);
    values[1] = 8; // il faudrait 1 : déjà pris dans la même ligne
    expect(virtualConflictCells(record, values, [row]).size).toBe(2);
  });

  it('cases qui ne se voient pas : seul l’écart à la somme compte, un chiffre peut se répéter', () => {
    const values = empty();
    values[0] = 4;
    values[40] = 4; // il faudrait 2 en L9C9 : possible
    expect(virtualConflictCells(record, values, [scattered]).size).toBe(0);
    values[80] = 3; // 4 + 4 + 3 = 11 au lieu de 10
    expect(virtualConflictCells(record, values, [scattered]).size).toBe(3);
  });

  it('une cage masquée n’est pas vérifiée, et n’est jamais comparée à la solution', () => {
    const values = empty();
    values[0] = 9;
    values[1] = 8;
    expect(virtualConflictCells(record, values, [{ ...row, hidden: true }]).size).toBe(0);
    // Une cage virtuelle fausse mais sans contradiction avec les chiffres posés n'est pas signalée.
    const wrongSum: VirtualCage = { id: 3, sum: sumOf([0, 1]) + 1, cells: [0, 1] };
    expect(virtualConflictCells(record, empty(), [wrongSum]).size).toBe(0);
  });
});

describe('gestion des cages virtuelles', () => {
  it('masquer puis réafficher (annulable) ; une cage masquée ne sert plus aux combinaisons', () => {
    let s = addVirtualCage(newGame(record.id), [0, 1], 9);
    s = toggleVirtualHidden(s, 1);
    expect(s.virtualCages[0].hidden).toBe(true);
    expect(comboSources(record, s.virtualCages, 0).some((x) => x.virtual)).toBe(false);
    expect(undo(s).virtualCages[0].hidden).toBeFalsy();
  });

  it('chaque cage a sa couleur, reprise après la sixième', () => {
    expect([1, 2, 3, 4, 5, 6].map(virtualColor)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(virtualColor(VIRTUAL_COLORS + 1)).toBe(1);
  });
});
