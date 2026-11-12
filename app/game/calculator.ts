/**
 * Calculatrice (évolution E3) : touches 0 à 9, +, −, ×, ÷, =, C (tout effacer) et ← (effacer le dernier
 * chiffre). Fonctions pures : chaque touche transforme l'état. × et ÷ passent avant + et −.
 */
export type Operator = '+' | '−' | '×' | '÷';
export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | Operator | '=' | 'C' | '←';

export interface CalcState {
  /** Opération en cours : nombres et opérateurs déjà saisis. */
  tokens: (number | Operator)[];
  /** Nombre en train d'être tapé. */
  entry: string;
  /** Dernier résultat (null s'il n'y en a pas, NaN pour une division par zéro). */
  result: number | null;
  /** Opération complète du dernier calcul, pour l'affichage (« 45 − 17 − 9 = »). */
  last: (number | Operator)[];
}

export const emptyCalc = (): CalcState => ({ tokens: [], entry: '', result: null, last: [] });

const OPERATORS: readonly string[] = ['+', '−', '×', '÷'];
const MAX_DIGITS = 9;

/** Résultat d'une opération ; NaN si une division par zéro la rend impossible. */
export function evaluate(tokens: readonly (number | Operator)[]): number {
  // D'abord × et ÷, de gauche à droite.
  const sums: (number | Operator)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ((t === '×' || t === '÷') && sums.length > 0) {
      const left = sums.pop() as number;
      const right = tokens[++i] as number;
      if (t === '÷' && right === 0) return NaN;
      sums.push(t === '×' ? left * right : left / right);
    } else sums.push(t);
  }
  // Puis + et −.
  let total = sums[0] as number;
  for (let i = 1; i < sums.length; i += 2) {
    const right = sums[i + 1] as number;
    total = sums[i] === '+' ? total + right : total - right;
  }
  return Math.round(total * 1e6) / 1e6;
}

export function pressKey(state: CalcState, key: CalcKey): CalcState {
  if (key === 'C') return emptyCalc();
  if (/^\d$/.test(key)) {
    // Après « = », un chiffre commence un nouveau calcul.
    const fresh = state.tokens.length === 0 && state.entry === '' && state.result !== null;
    const entry = state.entry === '0' ? key : state.entry + key;
    if (entry.length > MAX_DIGITS) return state;
    return fresh ? { ...emptyCalc(), entry } : { ...state, entry };
  }
  if (OPERATORS.includes(key)) {
    const op = key as Operator;
    if (state.entry !== '')
      return { ...state, tokens: [...state.tokens, Number(state.entry), op], entry: '' };
    const lastToken = state.tokens[state.tokens.length - 1];
    if (typeof lastToken === 'string') return { ...state, tokens: [...state.tokens.slice(0, -1), op] };
    // On repart du résultat précédent (sauf après une erreur).
    if (state.tokens.length === 0 && state.result !== null && !Number.isNaN(state.result)) {
      return { ...state, tokens: [state.result, op] };
    }
    return state;
  }
  if (key === '←') {
    if (state.entry !== '') return { ...state, entry: state.entry.slice(0, -1) };
    const lastToken = state.tokens[state.tokens.length - 1];
    if (typeof lastToken === 'string') {
      // On efface l'opérateur et on reprend la saisie du nombre précédent.
      const previous = state.tokens[state.tokens.length - 2] as number;
      return { ...state, tokens: state.tokens.slice(0, -2), entry: String(previous) };
    }
    return state;
  }
  // « = »
  const tokens = state.entry !== '' ? [...state.tokens, Number(state.entry)] : [...state.tokens];
  if (typeof tokens[tokens.length - 1] === 'string') tokens.pop();
  if (tokens.length === 0) return state;
  return { tokens: [], entry: '', result: evaluate(tokens), last: tokens };
}

/** Nombre à la française (virgule décimale, signe moins typographique). */
export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 6, useGrouping: false }).replace('-', '−');
}

const show = (tokens: readonly (number | Operator)[]): string =>
  tokens.map((t) => (typeof t === 'number' ? formatNumber(t) : t)).join(' ');

/** Les deux lignes de l'afficheur : l'opération (en haut) et le nombre ou le résultat (en bas). */
export function display(state: CalcState, errorText: string): { operation: string; value: string } {
  if (state.tokens.length > 0 || state.entry !== '') {
    return { operation: show(state.tokens), value: state.entry === '' ? '' : state.entry };
  }
  if (state.result === null) return { operation: '', value: '0' };
  return {
    operation: `${show(state.last)} =`,
    value: Number.isNaN(state.result) ? errorText : formatNumber(state.result),
  };
}
