/**
 * Chaînes (groupes C et D) : X-Cycles, XY-Chain, chaînes d'inférences alternées (AIC) et X-Cycles groupés.
 *
 * Principe commun : on suppose qu'un candidat de départ S est faux. Un lien fort rend alors le suivant
 * vrai, un lien faible rend le suivant faux, et ainsi de suite en alternant. Si l'on arrive, par un lien
 * fort, à un candidat E (vrai), on sait que « S ou E » est vrai. Tout candidat incompatible à la fois avec
 * S et avec E est donc faux. La recherche se fait en largeur : les chaînes les plus courtes d'abord.
 */
import { digitBit } from '../../bits';
import { CELL_COUNT, UNITS } from '../../model';
import { sees, type LogicContext } from '../context';
import { cageRequired, cellOfNode, digitOfNode, linkGraph, type LinkGraph } from '../links';
import { EliminationSet, makeStep } from '../state';
import type { LogicState, Step, TechniqueId } from '../types';

/** Candidats éliminés si « S ou E » est vrai. */
function endpointEliminations(state: LogicState, ctx: LogicContext, s: number, e: number): EliminationSet {
  const elims = new EliminationSet(state);
  const c1 = cellOfNode(s);
  const c2 = cellOfNode(e);
  const x = digitOfNode(s);
  const y = digitOfNode(e);
  if (c1 === c2) {
    // Même case : l'un des deux chiffres y est, les autres candidats de la case tombent.
    if (x !== y) elims.add(c1, state.cand[c1] & ~(digitBit(x) | digitBit(y)));
  } else if (x === y) {
    for (let c = 0; c < CELL_COUNT; c++) {
      if (c !== c1 && c !== c2 && sees(ctx, c, c1) && sees(ctx, c, c2)) elims.add(c, digitBit(x));
    }
  } else if (sees(ctx, c1, c2)) {
    // Si C1 valait Y, S serait faux, donc E vrai (C2 = Y) : impossible, C1 et C2 se voient.
    elims.add(c1, digitBit(y));
    elims.add(c2, digitBit(x));
  }
  return elims;
}

interface ChainSearch {
  graph: LinkGraph;
  maxNodes: number;
  /** Extrémités acceptées (par exemple : même chiffre pour XY-Chain). */
  accept?: (s: number, e: number) => boolean;
}

/** Chaînes alternées trouvées dans le graphe : la chaîne (candidats) et ses éliminations. */
function* alternatingChains(
  state: LogicState,
  ctx: LogicContext,
  search: ChainSearch,
): Generator<{ chain: number[]; elims: EliminationSet }> {
  const { strong, weak } = search.graph;
  const parent = new Int32Array(CELL_COUNT * 9 * 2);
  const depth = new Int16Array(CELL_COUNT * 9 * 2);
  for (let s = 0; s < CELL_COUNT * 9; s++) {
    if (strong[s].length === 0) continue;
    parent.fill(-2);
    // État de recherche : candidat × 2 + (1 s'il est vrai, 0 s'il est faux).
    const start = s * 2;
    parent[start] = -1;
    depth[start] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const key = queue[head];
      const n = key >> 1;
      const isTrue = key & 1;
      if (isTrue && depth[key] >= 3 && (!search.accept || search.accept(s, n))) {
        const elims = endpointEliminations(state, ctx, s, n);
        if (!elims.isEmpty) {
          const chain: number[] = [];
          for (let k = key; k !== -1; k = parent[k]) chain.unshift(k >> 1);
          yield { chain, elims };
        }
      }
      if (depth[key] + 1 >= search.maxNodes) continue;
      for (const m of isTrue ? weak[n] : strong[n]) {
        const next = m * 2 + (isTrue ? 0 : 1);
        if (parent[next] !== -2) continue;
        parent[next] = key;
        depth[next] = depth[key] + 1;
        queue.push(next);
      }
    }
  }
}

function chainStep(technique: TechniqueId, chain: number[], elims: EliminationSet): Step {
  const cells = [...new Set(chain.map(cellOfNode))];
  const digits = chain.reduce((m, n) => m | digitBit(digitOfNode(n)), 0);
  return makeStep(technique, { eliminations: elims.list(), cells, digits });
}

/** X-Cycles : chaîne d'un seul chiffre (liens forts dans les lignes, colonnes, blocs et cages). */
export function* xCycles(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (let d = 1; d <= 9; d++) {
    const graph = linkGraph(state, ctx, { digit: d, strongBetweenCells: true, strongInCell: false });
    for (const { chain, elims } of alternatingChains(state, ctx, { graph, maxNodes: 10 })) {
      yield chainStep('x_cycles', chain, elims);
    }
  }
}

/** XY-Chain : chaîne de cases à deux candidats, reliées par des chiffres communs. */
export function* xyChain(state: LogicState, ctx: LogicContext): Generator<Step> {
  const graph = linkGraph(state, ctx, { bivalueOnly: true, strongBetweenCells: false, strongInCell: true });
  const accept = (s: number, e: number): boolean =>
    digitOfNode(s) === digitOfNode(e) && cellOfNode(s) !== cellOfNode(e);
  for (const { chain, elims } of alternatingChains(state, ctx, { graph, maxNodes: 12, accept })) {
    yield chainStep('xy_chain', chain, elims);
  }
}

/** AIC : chaîne générale, entre cases et à l'intérieur des cases, sur plusieurs chiffres. */
export function* aic(state: LogicState, ctx: LogicContext): Generator<Step> {
  const graph = linkGraph(state, ctx, { strongBetweenCells: true, strongInCell: true });
  for (const { chain, elims } of alternatingChains(state, ctx, { graph, maxNodes: 12 })) {
    yield chainStep('aic', chain, elims);
  }
}

/**
 * X-Cycles groupés : comme les X-Cycles, mais un maillon peut être un groupe de 2 ou 3 cases alignées dans
 * un bloc (« le chiffre est quelque part dans ce groupe »). Seules les chaînes qui utilisent au moins un
 * groupe sont proposées (les autres sont de simples X-Cycles).
 */
export function* groupedXCycles(state: LogicState, ctx: LogicContext): Generator<Step> {
  for (let d = 1; d <= 9; d++) {
    const bit = digitBit(d);
    const has = (c: number): boolean => !state.value[c] && (state.cand[c] & bit) !== 0;
    // Maillons : cases seules, puis groupes (intersection d'un bloc et d'une ligne ou colonne).
    const nodes: number[][] = [];
    for (let c = 0; c < CELL_COUNT; c++) if (has(c)) nodes.push([c]);
    for (let b = 0; b < 9; b++) {
      for (let line = 0; line < 18; line++) {
        const cells = UNITS[18 + b].filter((c) => UNITS[line].includes(c) && has(c));
        if (cells.length >= 2) nodes.push(cells);
      }
    }
    const n = nodes.length;
    const strong: number[][] = Array.from({ length: n }, () => []);
    const weak: number[][] = Array.from({ length: n }, () => []);
    const disjoint = (a: number[], b: number[]): boolean => a.every((x) => !b.includes(x));
    // Liens forts : dans une unité (ou une cage où le chiffre est obligatoire), les places du chiffre
    // sont exactement deux maillons.
    const groupsOfCells: number[][] = [];
    UNITS.forEach((cells) => groupsOfCells.push(cells.filter(has)));
    ctx.cages.forEach((cage, k) => {
      if (cageRequired(state, ctx, k) & bit) groupsOfCells.push(cage.cells.filter(has));
    });
    for (const places of groupsOfCells) {
      if (places.length < 2) continue;
      const inside = nodes
        .map((cells, i) => (cells.every((c) => places.includes(c)) ? i : -1))
        .filter((i) => i >= 0);
      for (const i of inside) {
        for (const j of inside) {
          if (i >= j || !disjoint(nodes[i], nodes[j])) continue;
          if (nodes[i].length + nodes[j].length !== places.length) continue;
          if (!strong[i].includes(j)) {
            strong[i].push(j);
            strong[j].push(i);
          }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (
          i !== j &&
          disjoint(nodes[i], nodes[j]) &&
          nodes[i].every((a) => nodes[j].every((b) => sees(ctx, a, b)))
        ) {
          weak[i].push(j);
        }
      }
    }
    // Recherche en largeur, comme alternatingChains, sur les maillons.
    for (let s = 0; s < n; s++) {
      if (strong[s].length === 0) continue;
      const parent = new Int32Array(n * 2).fill(-2);
      const depth = new Int16Array(n * 2);
      parent[s * 2] = -1;
      const queue = [s * 2];
      for (let head = 0; head < queue.length; head++) {
        const key = queue[head];
        const e = key >> 1;
        if (key & 1 && depth[key] >= 3) {
          const chain: number[] = [];
          for (let k = key; k !== -1; k = parent[k]) chain.unshift(k >> 1);
          if (chain.some((i) => nodes[i].length > 1)) {
            const ends = [...nodes[s], ...nodes[e]];
            const used = new Set(chain.flatMap((i) => nodes[i]));
            const elims = new EliminationSet(state);
            for (let c = 0; c < CELL_COUNT; c++) {
              if (!has(c) || ends.includes(c)) continue;
              if (ends.every((x) => sees(ctx, c, x))) elims.add(c, bit);
            }
            if (!elims.isEmpty) {
              yield makeStep('grouped_x_cycles', {
                eliminations: elims.list(),
                cells: [...used],
                digits: bit,
              });
            }
          }
        }
        if (depth[key] + 1 >= 10) continue;
        for (const m of key & 1 ? weak[e] : strong[e]) {
          const next = m * 2 + (key & 1 ? 0 : 1);
          if (parent[next] !== -2) continue;
          parent[next] = key;
          depth[next] = depth[key] + 1;
          queue.push(next);
        }
      }
    }
  }
}
