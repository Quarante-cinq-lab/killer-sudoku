/**
 * Génère des grilles et les ajoute à la banque (cahier des charges, section 6).
 * Usage : npm run generate -- --level EXPERT --count 50 [--workers 7] [--seed 123] [--only] [--dry-run]
 *
 * - Plusieurs cœurs travaillent en parallèle (un « worker » par cœur).
 * - Chaque grille retenue est enregistrée aussitôt : on peut arrêter avec Ctrl + C et relancer plus tard,
 *   rien n'est perdu et aucune grille existante n'est modifiée.
 * - Une grille qui obtient un autre niveau que celui visé est gardée dans la banque de son niveau,
 *   sauf avec --only.
 * - --dry-run : rien n'est enregistré ; utile pour mesurer les scores et régler la configuration.
 */
import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { addToBank, type Bank } from '../engine/bank';
import { puzzleFingerprint } from '../engine/generator/fingerprint';
import { isLevelReachable, type Candidate } from '../engine/generator/generate';
import { LEVELS, type Level } from '../engine/model';
import { TEXTS } from '../texts/fr';
import { bankPath, loadBank, saveBank } from './bank-store';

const T = TEXTS.generate;

const { values: args } = parseArgs({
  options: {
    level: { type: 'string' },
    count: { type: 'string', default: '10' },
    workers: { type: 'string' },
    seed: { type: 'string' },
    only: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const target = (args.level ?? '').toUpperCase() as Level;
if (!args.level) {
  console.error(T.usage);
  process.exit(1);
}
if (!LEVELS.includes(target)) {
  console.error(T.unknownLevel(args.level));
  process.exit(1);
}
if (!isLevelReachable(target)) {
  console.error(T.unreachable(TEXTS.levels[target]));
  process.exit(1);
}
const count = Math.max(1, Number(args.count));
const workerCount = Math.max(1, Number(args.workers ?? Math.max(1, availableParallelism() - 1)));
const seed = args.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Number(args.seed);
const dryRun = args['dry-run'];
const today = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-JJ, date locale

// Banques chargées une fois ; les empreintes de toutes les grilles servent au dédoublonnage.
const banks = new Map<Level, Bank>();
const known = new Set<string>();
const bankOf = (level: Level): Bank => {
  let bank = banks.get(level);
  if (!bank) {
    bank = loadBank(level);
    banks.set(level, bank);
    for (const p of bank.puzzles) known.add(puzzleFingerprint(p));
  }
  return bank;
};
for (const level of LEVELS) bankOf(level);

console.log(T.start(TEXTS.levels[target], count, workerCount, seed, dryRun));
console.log(T.bankState(TEXTS.levels[target], bankOf(target).puzzles.length, bankPath(target)));

// Statistiques du rapport.
const begin = performance.now();
let tries = 0;
let workMs = 0;
let repairs = 0;
const found = new Map<Level, number>();
const rejections = new Map<string, number>();
const scores = new Map<Level, { score: number; withoutHardest: number }[]>();
let lastFound = begin;

function accept(candidate: Candidate): void {
  const level = candidate.level;
  const rating = candidate.rating;
  if (!level || !rating || !candidate.puzzle) return;
  if (level !== target && args.only) {
    rejections.set('autre_niveau', (rejections.get('autre_niveau') ?? 0) + 1);
    return;
  }
  const fingerprint = puzzleFingerprint(candidate.puzzle);
  if (known.has(fingerprint)) {
    rejections.set('doublon', (rejections.get('doublon') ?? 0) + 1);
    return;
  }
  found.set(level, (found.get(level) ?? 0) + 1);
  const list = scores.get(level) ?? [];
  list.push({ score: rating.score, withoutHardest: rating.score - rating.hardestPoints });
  scores.set(level, list);

  let id = `${TEXTS.levels[level]} n°${found.get(level)}`;
  if (dryRun) known.add(fingerprint);
  else {
    const bank = bankOf(level);
    const record = addToBank(bank, candidate.puzzle, candidate.solution, rating, today, known);
    if (!record) return;
    saveBank(bank);
    id = record.id;
  }
  const now = performance.now();
  if (level === target) {
    console.log(
      T.found(found.get(level) ?? 0, count, id, rating.score, rating.groups.B, (now - lastFound) / 1000),
    );
    lastFound = now;
  } else console.log(T.bonus(id, rating.score));
}

const workers: Worker[] = [];
let finished = false;

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function report(): void {
  const seconds = (performance.now() - begin) / 1000;
  console.log(`\n${T.reportTitle}`);
  console.log(T.duration(seconds, tries, tries ? workMs / tries : 0));
  const targetFound = found.get(target) ?? 0;
  if (targetFound > 0) console.log(T.perGrid(TEXTS.levels[target], seconds / targetFound));
  console.log(T.levelsHeader);
  for (const level of LEVELS) {
    const n = found.get(level) ?? 0;
    if (n > 0 || level === target)
      console.log(T.levelLine(TEXTS.levels[level], n, dryRun ? null : bankOf(level).puzzles.length));
  }
  if (rejections.size > 0) {
    console.log(T.rejectionsHeader);
    for (const [reason, n] of [...rejections].sort((a, b) => b[1] - a[1])) {
      console.log(T.rejectionLine(TEXTS.rejections[reason as keyof typeof TEXTS.rejections], n));
    }
  }
  console.log(T.repairs(tries ? repairs / tries : 0));
  if (scores.size > 0) {
    console.log(T.scoresHeader);
    for (const level of LEVELS) {
      const list = scores.get(level);
      if (!list) continue;
      const sorted = list.map((s) => s.score).sort((a, b) => a - b);
      const values = [0, 0.1, 0.5, 0.9, 1].map((p) => percentile(sorted, p));
      console.log(T.scoreLine(TEXTS.levels[level], values, Math.min(...list.map((s) => s.withoutHardest))));
    }
  }
}

async function stop(): Promise<void> {
  if (finished) return;
  finished = true;
  await Promise.all(workers.map((w) => w.terminate()));
  report();
}

process.on('SIGINT', () => {
  console.log(`\n${T.interrupted}`);
  void stop();
});

for (let i = 0; i < workerCount; i++) {
  const worker = new Worker(new URL('./generate-worker.ts', import.meta.url), {
    workerData: { target, start: seed + i, stride: workerCount },
  });
  worker.on('message', ({ candidate, ms }: { candidate: Candidate; ms: number }) => {
    if (finished) return;
    tries++;
    workMs += ms;
    repairs += candidate.repairs;
    if (candidate.rejection) {
      rejections.set(candidate.rejection, (rejections.get(candidate.rejection) ?? 0) + 1);
    } else accept(candidate);
    if ((found.get(target) ?? 0) >= count) void stop();
  });
  worker.on('error', (error) => {
    console.error(error);
    void stop().then(() => process.exit(1));
  });
  workers.push(worker);
}
