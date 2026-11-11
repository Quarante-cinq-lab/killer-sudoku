/**
 * Affiche, étape par étape, comment le solveur logique résout une grille, puis sa notation.
 * Usage : npm run trace -- grille.json [numéro]
 *
 * Le fichier peut contenir une grille de la banque, un objet { "cages": [...] }, ou un fichier de
 * grilles de test ({ "fixtures": [...] }) ou un fichier de banque ({ "puzzles": [...] }) : le numéro
 * (à partir de 1) choisit alors la grille. Exemple : npm run trace -- data/bank-expert.json 12
 */
import { readFileSync } from 'node:fs';
import { DIFFICULTY_CONFIG } from '../engine/difficulty';
import { createContext } from '../engine/logic/context';
import { describeStep } from '../engine/logic/describe';
import { parseCages, type Puzzle } from '../engine/model';
import { ratePuzzle } from '../engine/rating';
import { TEXTS } from '../texts/fr';

const [path, indexArg] = process.argv.slice(2);
if (!path) {
  console.error('Indique le fichier : npm run trace -- grille.json [numéro]');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(path, 'utf8')) as {
  cages?: unknown;
  fixtures?: { name: string; cages: unknown }[];
  puzzles?: { id: string; cages: unknown }[];
};
const index = Math.max(1, Number(indexArg ?? 1)) - 1;
const fixture = raw.fixtures?.[index];
const banked = raw.puzzles?.[index];
const puzzle: Puzzle = { cages: parseCages(raw.cages ?? fixture?.cages ?? banked?.cages) };
if (fixture ?? banked) console.log(`Grille : ${fixture?.name ?? banked?.id}\n`);

const ctx = createContext(puzzle, DIFFICULTY_CONFIG.rule45MaxCells);
const points = new Map(DIFFICULTY_CONFIG.techniques.map((t) => [t.id, t.points]));
const rating = ratePuzzle(puzzle);
const T = TEXTS.trace;

rating.steps.forEach((step, i) => {
  const { name, where, effect } = describeStep(step, ctx);
  console.log(T.line(i + 1, name, where, effect, points.get(step.technique) ?? 0));
});

console.log('');
const filled = new Set(rating.steps.flatMap((s) => s.placements.map((p) => p.cell))).size;
console.log(rating.solved ? T.solved : T.notSolved(filled));
console.log(T.score(rating.score));
console.log(T.entryPoints(rating.entryPoints));
console.log(T.cagesInfo(puzzle.cages.length, rating.cages.singleCell, rating.cages.uniqueCombo));
console.log(T.techniquesHeader);
for (const t of DIFFICULTY_CONFIG.techniques) {
  const count = rating.techniques[t.id];
  if (count) console.log(T.techniqueCount(TEXTS.techniques[t.id], count, count * t.points));
}
console.log(
  rating.level
    ? T.level(TEXTS.levels[rating.level])
    : T.rejected(TEXTS.rejections[rating.rejection ?? 'non_resolue']),
);
