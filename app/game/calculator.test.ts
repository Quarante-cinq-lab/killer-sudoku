import { describe, expect, it } from 'vitest';
import { display, emptyCalc, evaluate, pressKey, type CalcKey, type CalcState } from './calculator';

const type = (keys: string, state: CalcState = emptyCalc()): CalcState =>
  [...keys.replace(/\s/g, '')].reduce((s, k) => pressKey(s, k as CalcKey), state);
const shown = (s: CalcState) => display(s, 'Erreur');

describe('calculatrice', () => {
  it('enchaîne les soustractions de la règle des 45 : 45 − 17 − 9 = 19', () => {
    const s = type('45−17−9=');
    expect(s.result).toBe(19);
    expect(shown(s)).toEqual({ operation: '45 − 17 − 9 =', value: '19' });
  });

  it('respecte la priorité de × et ÷', () => {
    expect(type('2+3×4=').result).toBe(14);
    expect(type('20−12÷4=').result).toBe(17);
    expect(evaluate([7, '÷', 2])).toBe(3.5);
    expect(shown(type('7÷2=')).value).toBe('3,5');
  });

  it('affiche l’opération en cours', () => {
    expect(shown(type('12+3'))).toEqual({ operation: '12 +', value: '3' });
  });

  it('division par zéro : « Erreur », puis un nouveau calcul repart proprement', () => {
    const s = type('5÷0=');
    expect(shown(s).value).toBe('Erreur');
    expect(type('8+1=', s).result).toBe(9);
  });

  it('← efface le dernier chiffre, puis l’opérateur ; C efface tout', () => {
    expect(shown(type('123←')).value).toBe('12');
    const s = type('12+←');
    expect(s.tokens).toEqual([]);
    expect(s.entry).toBe('12');
    expect(type('12+3C')).toEqual(emptyCalc());
  });

  it('un opérateur après « = » repart du résultat ; un chiffre commence un nouveau calcul', () => {
    const s = type('10+5=');
    expect(type('×2=', s).result).toBe(30);
    expect(type('4=', s).result).toBe(4);
  });

  it('un second opérateur remplace le premier', () => {
    expect(type('9+−3=').result).toBe(6);
  });
});
