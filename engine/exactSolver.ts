import { ALL_DIGITS, popcount, singleDigit } from './bits';
import { combinationsFor } from './combinations';
import { CELL_COUNT, cageIndexByCell, cellAt, PEERS, UNITS, validatePuzzle, type Puzzle } from './model';

/**
 * Solveur exact : il compte les solutions d'une grille, en s'arrêtant dès qu'il en a trouvé `limit`
 * (2 par défaut, ce qui suffit pour savoir si la solution est unique).
 *
 * Principe : on maintient pour chaque case l'ensemble de ses candidats possibles. On élimine tout ce
 * qui est impossible (propagation), puis on choisit la case qui a le moins de candidats et on essaie
 * chacun d'eux à tour de rôle (retour arrière). Ce solveur ne cherche pas à raisonner comme un humain :
 * c'est le rôle du solveur logique (étape 2). Il utilise seulement ce qu'il faut pour aller vite.
 */

export interface CountOptions {
  /** Nombre de solutions à partir duquel on s'arrête (2 par défaut). */
  limit?: number;
  /** Garde-fou : nombre maximal de nœuds explorés avant abandon (5 millions par défaut). */
  maxNodes?: number;
}

export interface CountResult {
  /** Nombre de solutions trouvées (au plus `limit`). */
  count: number;
  /** Les solutions trouvées, chacune sous forme de 81 chiffres. */
  solutions: number[][];
  /** Faux si la recherche a été interrompue par le garde-fou : `count` n'est alors qu'un minimum. */
  complete: boolean;
  /** Nombre de nœuds explorés (utile pour mesurer la difficulté de calcul). */
  nodes: number;
}

const PEERS_FLAT = Uint8Array.from(PEERS.flat());
const UNITS_FLAT = Uint8Array.from(UNITS.flat());

/** Une contrainte « ces cases font telle somme ». Si `distinct`, les chiffres sont forcément différents. */
interface SumConstraint {
  sum: number;
  cells: Uint8Array;
  distinct: boolean;
}

/** Taille maximale des ensembles déduits par la règle des 45 (au-delà, ils n'apportent presque rien). */
const MAX_DERIVED_SIZE = 6;

/**
 * Prépare les contraintes : les cages, plus celles que donne la règle des 45.
 * Une bande de k lignes (ou de k colonnes, ou un bloc) fait toujours 45 × k. Donc :
 * - les cases de la région non couvertes par les cages entièrement incluses (« innies ») ont une somme connue ;
 * - les cases qui dépassent de la région, dans les cages qui la touchent (« outies »), aussi.
 */
function prepare(puzzle: Puzzle): SumConstraint[] {
  const issues = validatePuzzle(puzzle);
  if (issues.length > 0) throw new Error(`Grille mal formée : ${issues[0].message}`);

  const cageOf = cageIndexByCell(puzzle);
  const constraints: SumConstraint[] = puzzle.cages.map((cage) => ({
    sum: cage.sum,
    cells: Uint8Array.from(cage.cells),
    distinct: true,
  }));
  const seen = new Set(constraints.map((c) => [...c.cells].sort((a, b) => a - b).join(',')));

  const peerSets = PEERS.map((p) => new Set(p));
  const allDistinct = (cells: number[]): boolean =>
    cells.every((a, i) => cells.slice(i + 1).every((b) => peerSets[a].has(b) || cageOf[a] === cageOf[b]));

  const addDerived = (cells: number[], sum: number): void => {
    if (cells.length === 0 || cells.length > MAX_DERIVED_SIZE) return;
    cells.sort((a, b) => a - b);
    const key = cells.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    constraints.push({ sum, cells: Uint8Array.from(cells), distinct: allDistinct(cells) });
  };

  const regions: { cells: number[]; units: number }[] = [];
  for (let a = 0; a < 9; a++) {
    for (let b = a; b < 9; b++) {
      const rows: number[] = [];
      const cols: number[] = [];
      for (let i = a; i <= b; i++) {
        for (let j = 0; j < 9; j++) {
          rows.push(cellAt(i, j));
          cols.push(cellAt(j, i));
        }
      }
      regions.push({ cells: rows, units: b - a + 1 }, { cells: cols, units: b - a + 1 });
    }
  }
  for (let box = 0; box < 9; box++) regions.push({ cells: [...UNITS[18 + box]], units: 1 });

  for (const region of regions) {
    const inside = new Set(region.cells);
    const touching = new Set<number>();
    for (const cell of region.cells) touching.add(cageOf[cell]);
    let innerSum = 0;
    let touchingSum = 0;
    const innerCells = new Set<number>();
    const outies: number[] = [];
    for (const index of touching) {
      const cage = puzzle.cages[index];
      touchingSum += cage.sum;
      if (cage.cells.every((cell) => inside.has(cell))) {
        innerSum += cage.sum;
        for (const cell of cage.cells) innerCells.add(cell);
      } else {
        for (const cell of cage.cells) if (!inside.has(cell)) outies.push(cell);
      }
    }
    const regionSum = 45 * region.units;
    addDerived(
      region.cells.filter((cell) => !innerCells.has(cell)),
      regionSum - innerSum,
    );
    addDerived(outies, touchingSum - regionSum);
  }
  return constraints;
}

const lowestDigit = (mask: number): number => 32 - Math.clz32(mask & -mask);
const highestDigit = (mask: number): number => 32 - Math.clz32(mask);
/** Masque des chiffres compris entre lo et hi (inclus). */
const rangeMask = (lo: number, hi: number): number =>
  lo > hi ? 0 : (ALL_DIGITS >> (9 - hi)) & ~((1 << (lo - 1)) - 1) & ALL_DIGITS;

/**
 * Élimine les candidats impossibles jusqu'à ce que plus rien ne change.
 * Renvoie faux si la grille devient contradictoire (une case sans candidat, une somme impossible…).
 */
function propagate(cand: Uint16Array, placed: Uint8Array, constraints: readonly SumConstraint[]): boolean {
  let changed = true;
  while (changed) {
    changed = false;

    // 1. Une case qui n'a plus qu'un candidat est posée : on retire ce chiffre de ses 20 voisines.
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (placed[cell] || popcount(cand[cell]) !== 1) continue;
      placed[cell] = 1;
      const bit = cand[cell];
      const base = cell * 20;
      for (let k = 0; k < 20; k++) {
        const peer = PEERS_FLAT[base + k];
        if (cand[peer] & bit) {
          cand[peer] &= ~bit;
          if (cand[peer] === 0) return false;
        }
      }
      changed = true;
    }

    // 2. Sommes : cages et ensembles déduits de la règle des 45.
    for (const constraint of constraints) {
      const result = constraint.distinct
        ? applyDistinctSum(cand, constraint)
        : applyBoundedSum(cand, constraint);
      if (result < 0) return false;
      if (result > 0) changed = true;
    }

    // 3. Singletons cachés : un chiffre qui n'a qu'une place possible dans une unité y est posé.
    for (let u = 0; u < 27; u++) {
      const base = u * 9;
      let once = 0;
      let twice = 0;
      for (let k = 0; k < 9; k++) {
        const m = cand[UNITS_FLAT[base + k]];
        twice |= once & m;
        once |= m;
      }
      if (once !== ALL_DIGITS) return false; // un chiffre n'a plus aucune place dans l'unité
      const unique = once & ~twice;
      if (unique === 0) continue;
      for (let k = 0; k < 9; k++) {
        const cell = UNITS_FLAT[base + k];
        const m = cand[cell] & unique;
        if (m === 0) continue;
        if (popcount(m) > 1) return false; // deux chiffres ne peuvent aller que dans cette même case
        if (cand[cell] !== m) {
          cand[cell] = m;
          changed = true;
        }
      }
    }
  }
  return true;
}

/**
 * Somme de chiffres tous différents (cage, ou ensemble inclus dans une même unité) :
 * seuls restent les chiffres présents dans une combinaison encore réalisable.
 * Renvoie -1 si c'est impossible, 1 si des candidats ont été retirés, 0 sinon.
 */
function applyDistinctSum(cand: Uint16Array, constraint: SumConstraint): number {
  let fixedMask = 0;
  let fixedSum = 0;
  let free = 0;
  let union = 0;
  for (const cell of constraint.cells) {
    const m = cand[cell];
    if (popcount(m) === 1) {
      if (fixedMask & m) return -1; // même chiffre deux fois
      fixedMask |= m;
      fixedSum += singleDigit(m);
    } else {
      free++;
      union |= m;
    }
  }
  const remaining = constraint.sum - fixedSum;
  if (free === 0) return remaining === 0 ? 0 : -1;
  let allowed = 0;
  let required = ALL_DIGITS;
  for (const combo of combinationsFor(free, remaining)) {
    // La combinaison ne doit réutiliser aucun chiffre déjà posé et n'utiliser que des candidats présents.
    if ((combo & fixedMask) === 0 && (combo & ~union) === 0) {
      allowed |= combo;
      required &= combo;
    }
  }
  if (allowed === 0) return -1;
  let changed = 0;
  for (const cell of constraint.cells) {
    const m = cand[cell];
    if (popcount(m) === 1) continue;
    const restricted = m & allowed;
    if (restricted !== m) {
      if (restricted === 0) return -1;
      cand[cell] = restricted;
      changed = 1;
    }
  }
  // Un chiffre présent dans toutes les combinaisons et possible dans une seule case y est posé.
  required &= ~fixedMask;
  while (required !== 0) {
    const bit = required & -required;
    required ^= bit;
    let holder = -1;
    let holders = 0;
    for (const cell of constraint.cells) {
      if (cand[cell] & bit) {
        holders++;
        holder = cell;
      }
    }
    if (holders === 0) return -1;
    if (holders === 1 && cand[holder] !== bit) {
      cand[holder] = bit;
      changed = 1;
    }
  }
  return changed;
}

/**
 * Somme de chiffres qui peuvent se répéter : on encadre chaque case entre la plus petite et la plus
 * grande valeur compatibles avec la somme. Renvoie -1 si c'est impossible, 1 si des candidats ont été
 * retirés, 0 sinon.
 */
function applyBoundedSum(cand: Uint16Array, constraint: SumConstraint): number {
  let totalMin = 0;
  let totalMax = 0;
  for (const cell of constraint.cells) {
    totalMin += lowestDigit(cand[cell]);
    totalMax += highestDigit(cand[cell]);
  }
  if (constraint.sum < totalMin || constraint.sum > totalMax) return -1;
  let changed = 0;
  for (const cell of constraint.cells) {
    const m = cand[cell];
    const lo = lowestDigit(m);
    const hi = highestDigit(m);
    const newLo = Math.max(1, constraint.sum - (totalMax - hi));
    const newHi = Math.min(9, constraint.sum - (totalMin - lo));
    const restricted = m & rangeMask(newLo, newHi);
    if (restricted !== m) {
      if (restricted === 0) return -1;
      cand[cell] = restricted;
      changed = 1;
    }
  }
  return changed;
}

/** Compte les solutions de la grille (arrêt dès `limit` solutions trouvées). */
export function countSolutions(puzzle: Puzzle, options: CountOptions = {}): CountResult {
  const limit = options.limit ?? 2;
  const maxNodes = options.maxNodes ?? 5_000_000;
  const constraints = prepare(puzzle);
  const solutions: number[][] = [];
  let nodes = 0;
  let aborted = false;

  const search = (cand: Uint16Array, placed: Uint8Array): void => {
    nodes++;
    if (nodes > maxNodes) {
      aborted = true;
      return;
    }
    if (!propagate(cand, placed, constraints)) return;

    // Case à essayer : celle qui a le moins de candidats (moins de pistes à explorer).
    let best = -1;
    let bestCount = 10;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (placed[cell]) continue;
      const count = popcount(cand[cell]);
      if (count < bestCount) {
        best = cell;
        bestCount = count;
        if (count === 2) break;
      }
    }
    if (best === -1) {
      solutions.push(Array.from(cand, singleDigit));
      return;
    }

    let remaining = cand[best];
    while (remaining !== 0) {
      const bit = remaining & -remaining;
      remaining ^= bit;
      const nextCand = cand.slice();
      nextCand[best] = bit;
      search(nextCand, placed.slice());
      if (solutions.length >= limit || aborted) return;
    }
  };

  if (limit > 0) search(new Uint16Array(CELL_COUNT).fill(ALL_DIGITS), new Uint8Array(CELL_COUNT));
  return { count: solutions.length, solutions, complete: !aborted, nodes };
}

/** Première solution trouvée, ou null si la grille n'en a aucune. */
export function solve(puzzle: Puzzle, maxNodes?: number): number[] | null {
  const result = countSolutions(puzzle, maxNodes === undefined ? { limit: 1 } : { limit: 1, maxNodes });
  return result.solutions[0] ?? null;
}

/** Vrai si la grille a exactement une solution. Lève une erreur si le garde-fou a interrompu le calcul. */
export function hasUniqueSolution(puzzle: Puzzle, maxNodes?: number): boolean {
  const result = countSolutions(puzzle, maxNodes === undefined ? {} : { maxNodes });
  if (!result.complete && result.count < 2) {
    throw new Error("Le solveur exact a atteint sa limite de calcul : impossible de conclure sur l'unicité.");
  }
  return result.count === 1;
}
