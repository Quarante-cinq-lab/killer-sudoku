/**
 * Résout une grille depuis un fichier JSON et affiche la solution.
 * Usage : npm run solve -- chemin/vers/grille.json
 *
 * Le fichier peut contenir une grille au format de la banque (section 6.3), un simple objet
 * { "cages": [...] }, ou un fichier de grilles de test ({ "fixtures": [...] }, première grille utilisée).
 */
import { readFileSync } from 'node:fs';
import { countSolutions } from '../engine/exactSolver';
import { parseCages, validatePuzzle, type Puzzle } from '../engine/model';

function formatGrid(digits: readonly number[]): string {
  const lines: string[] = [];
  for (let r = 0; r < 9; r++) {
    if (r > 0 && r % 3 === 0) lines.push('------+-------+------');
    const row = digits.slice(r * 9, r * 9 + 9);
    lines.push([row.slice(0, 3), row.slice(3, 6), row.slice(6, 9)].map((g) => g.join(' ')).join(' | '));
  }
  return lines.join('\n');
}

const path = process.argv[2];
if (!path) {
  console.error('Indique le fichier à résoudre : npm run solve -- grille.json');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, 'utf8')) as { cages?: unknown; fixtures?: { cages: unknown }[] };
const puzzle: Puzzle = { cages: parseCages(raw.cages ?? raw.fixtures?.[0]?.cages) };

const issues = validatePuzzle(puzzle);
if (issues.length > 0) {
  console.error('Grille mal formée :');
  for (const issue of issues) console.error(` - ${issue.message}`);
  process.exit(1);
}

const start = performance.now();
const result = countSolutions(puzzle);
const elapsed = (performance.now() - start).toFixed(1);

if (!result.complete) {
  console.log(`Calcul interrompu (limite atteinte, ${result.nodes} nœuds) : impossible de conclure.`);
} else if (result.count === 0) {
  console.log('Aucune solution.');
} else {
  console.log(formatGrid(result.solutions[0]));
  console.log('');
  console.log(
    result.count === 1
      ? 'Solution unique.'
      : 'Plusieurs solutions (au moins 2) : la grille n’est pas valable.',
  );
}
console.log(`${puzzle.cages.length} cages, ${result.nodes} nœuds explorés, ${elapsed} ms.`);
