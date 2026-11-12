import { describe, expect, it } from 'vitest';
import { parseBank } from '../../engine/bank';
import { rule45Regions } from '../../engine/logic/context';
import { cageIndexByCell, parseSolution, UNITS } from '../../engine/model';
import expertBank from '../../data/bank-expert.json';
import { emptySelection, sumInfo, toggleInSelection } from './sumMode';

const record = parseBank(expertBank).puzzles[0];
const solution = parseSolution(record.solution);
const owner = cageIndexByCell(record);
const empty = new Array<number>(81).fill(0);

/** Toutes les cages qui touchent une zone : la sélection couvre donc la zone, plus ce qui dépasse. */
const cagesTouching = (cells: readonly number[]): number[] => [...new Set(cells.map((c) => owner[c]))];

describe('mode Somme : total et règle des 45 (5 sélections de test)', () => {
  const zones = [
    { name: 'bloc 1', cells: UNITS[18] },
    { name: 'lignes 1 et 2', cells: [...UNITS[0], ...UNITS[1]] },
    { name: 'colonnes 4 à 6', cells: [...UNITS[12], ...UNITS[13], ...UNITS[14]] },
    { name: 'bloc 5', cells: UNITS[22] },
    { name: 'lignes 7 à 9', cells: [...UNITS[6], ...UNITS[7], ...UNITS[8]] },
  ];

  it.each(zones.map((z) => [z.name, z.cells] as const))('%s', (_, zoneCells) => {
    const info = sumInfo(record, empty, { cages: cagesTouching(zoneCells), cells: [] });
    // Le total est la somme des chiffres de la solution dans les cases sélectionnées.
    expect(info.total).toBe(info.cells.reduce((s, c) => s + solution[c], 0));
    // La zone complète trouvée est bien entièrement sélectionnée, et ce qui dépasse fait la bonne somme.
    expect(info.rule45).not.toBeNull();
    if (!info.rule45) return;
    expect(info.rule45.outsideSum).toBe(info.rule45.outside.reduce((s, c) => s + solution[c], 0));
    const region = rule45Regions().find(
      (r) => JSON.stringify(r.region) === JSON.stringify(info.rule45?.region),
    );
    expect(region?.cells.every((c) => info.cells.includes(c))).toBe(true);
    expect(region?.cells.length).toBeGreaterThanOrEqual(zoneCells.length);
  });
});

describe('mode Somme : sélection', () => {
  it('un toucher ajoute ou retire la cage entière', () => {
    let sel = toggleInSelection(record, empty, emptySelection(), record.cages[0].cells[0], 'cages');
    expect(sel.cages).toEqual([0]);
    expect(sumInfo(record, empty, sel)).toMatchObject({ total: record.cages[0].sum, cageCount: 1 });
    sel = toggleInSelection(record, empty, sel, record.cages[0].cells[0], 'cages');
    expect(sel.cages).toEqual([]);
  });

  it('en mode « cases », seule une case déjà remplie s’ajoute, avec son chiffre', () => {
    const values = [...empty];
    const cell = record.cages[3].cells[0];
    values[cell] = solution[cell];
    expect(toggleInSelection(record, empty, emptySelection(), cell, 'cases')).toEqual(emptySelection());
    const sel = toggleInSelection(record, values, emptySelection(), cell, 'cases');
    expect(sel.cells).toEqual([cell]);
    expect(sumInfo(record, values, sel).total).toBe(solution[cell]);
  });

  it('une case isolée déjà comprise dans une cage sélectionnée n’est pas comptée deux fois', () => {
    const values = [...empty];
    const cell = record.cages[3].cells[0];
    values[cell] = solution[cell];
    let sel = toggleInSelection(record, values, emptySelection(), cell, 'cases');
    sel = toggleInSelection(record, values, sel, cell, 'cages');
    expect(sel).toEqual({ cages: [3], cells: [] });
  });

  it('pas de règle des 45 sans zone complète', () => {
    expect(sumInfo(record, empty, { cages: [0], cells: [] }).rule45).toBeNull();
  });
});
