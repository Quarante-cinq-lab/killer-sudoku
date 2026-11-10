// Page provisoire : elle prouve que l'application se charge sur l'iPad et que le moteur y fonctionne.
import { countSolutions } from '../engine/exactSolver';
import fixtures from '../engine/__tests__/fixtures/killer-fixtures.json';
import { TEXTS } from '../texts/fr';

const setText = (id: string, text: string): void => {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
};

setText('title', TEXTS.appName);
setText('subtitle', TEXTS.underConstruction);

const start = performance.now();
const result = countSolutions(fixtures.fixtures[4]);
const elapsed = Math.round(performance.now() - start);
setText('engine', result.count === 1 ? TEXTS.engineCheckOk(elapsed) : TEXTS.engineCheckFailed);
