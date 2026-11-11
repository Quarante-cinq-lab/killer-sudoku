/**
 * Travailleur de `npm run generate` : il tourne sur un cœur du processeur et produit des grilles
 * candidates en boucle, chacune à partir de sa propre graine. Le script principal trie les résultats.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { generateCandidate } from '../engine/generator/generate';
import type { Level } from '../engine/model';

const { target, start, stride } = workerData as { target: Level; start: number; stride: number };

for (let k = 0; ; k++) {
  const seed = (start + k * stride) >>> 0;
  const begin = performance.now();
  const candidate = generateCandidate(seed, target);
  parentPort?.postMessage({ candidate, ms: performance.now() - begin });
}
