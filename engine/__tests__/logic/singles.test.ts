import { describe, expect, it } from 'vitest';
import { hiddenSingle, nakedSingle } from '../../logic/techniques/singles';
import { placeDigit } from '../../logic/state';
import { blankState, contextWith, removeCand, setCands } from './helpers';

describe('singleton nu', () => {
  it('pose le seul candidat restant', () => {
    const state = blankState();
    setCands(state, 40, [7]);
    const steps = [...nakedSingle(state)];
    expect(steps).toHaveLength(1);
    expect(steps[0].placements).toEqual([{ cell: 40, digit: 7 }]);
  });

  it('ne trouve rien quand chaque case a plusieurs candidats', () => {
    expect([...nakedSingle(blankState())]).toEqual([]);
  });

  it('ignore les cases déjà remplies', () => {
    const state = blankState();
    placeDigit(state, contextWith(), 0, 5);
    expect([...nakedSingle(state)]).toEqual([]);
  });
});

describe('singleton caché', () => {
  it('trouve le chiffre qui n’a qu’une place dans une ligne', () => {
    const state = blankState();
    removeCand(state, [0, 1, 2, 4, 5, 6, 7, 8], 5); // le 5 de la ligne 1 ne peut aller qu'en L1C4
    const step = [...hiddenSingle(state)].find((s) => s.units[0] === 0);
    expect(step?.placements).toEqual([{ cell: 3, digit: 5 }]);
  });

  it('trouve le chiffre qui n’a qu’une place dans un bloc', () => {
    const state = blankState();
    removeCand(state, [30, 31, 32, 39, 41, 48, 49, 50], 7); // bloc 5 : le 7 ne peut aller qu'en L5C5
    const step = [...hiddenSingle(state)].find((s) => s.units[0] === 22);
    expect(step?.placements).toEqual([{ cell: 40, digit: 7 }]);
  });

  it('ne trouve rien quand chaque chiffre a au moins deux places', () => {
    const state = blankState();
    removeCand(state, [0, 1, 2, 4, 5, 6, 7], 5); // reste L1C4 et L1C9
    expect([...hiddenSingle(state)]).toEqual([]);
  });
});
