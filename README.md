# Killer Sudoku pour iPad

Jeu de killer sudoku personnel, hors ligne, installable sur iPad (PWA). Le cahier des charges complet est dans
[docs/cahier-des-charges.md](docs/cahier-des-charges.md).

État : **étape 1** (socle du projet et solveur exact). Il n'y a pas encore d'écran de jeu.

## Installer

Prérequis : [Node.js](https://nodejs.org) en version LTS (22 ou plus) et git.

```bash
npm install
```

## Commandes

| Commande                        | Rôle                                                  |
| ------------------------------- | ----------------------------------------------------- |
| `npm test`                      | lance tous les tests automatiques                     |
| `npm run test:watch`            | relance les tests à chaque modification               |
| `npm run typecheck`             | vérifie les types TypeScript                          |
| `npm run lint`                  | cherche les erreurs courantes (ESLint)                |
| `npm run format`                | met en forme tout le code (Prettier)                  |
| `npm run solve -- fichier.json` | résout une grille et dit si sa solution est unique    |
| `npm run dev`                   | lance l'application sur le PC (http://localhost:5173) |
| `npm run dev:ipad`              | idem, accessible depuis l'iPad sur le même Wi-Fi      |
| `npm run build`                 | produit la version finale dans `dist/`                |

## Tester sur l'iPad (pendant le développement)

1. Le PC et l'iPad doivent être sur le même réseau Wi-Fi.
2. Sur le PC, lancer `npm run dev:ipad`. Vite affiche une ligne `Network: http://192.168.x.x:5173/`.
3. Sur l'iPad, ouvrir Safari et taper exactement cette adresse.
4. Si la page ne s'ouvre pas : au premier lancement, Windows demande d'autoriser Node.js sur le réseau.
   Accepter pour les **réseaux privés**. Sinon, vérifier que le Wi-Fi du PC est déclaré en « réseau privé »
   (Paramètres Windows → Réseau et Internet → Wi-Fi → propriétés).
5. Arrêter le serveur avec `Ctrl + C` dans le terminal.

L'installation sur l'écran d'accueil et le mode hors ligne viendront à l'étape 7 (GitHub Pages).

## Organisation du dépôt

- `engine/` : moteur commun (modèle de grille, combinaisons, solveur exact…), sans aucune dépendance à
  l'interface. Il est partagé par l'application et les scripts.
- `engine/__tests__/` : tests du moteur et grilles de test (`fixtures/killer-fixtures.json`).
- `app/` : l'application web. Tous ses textes sont dans `app/texts.fr.ts`.
- `scripts/` : outils en ligne de commande (Node.js).
- `data/` : banque de grilles (à partir de l'étape 3).

## Le moteur en bref

- Les cases sont numérotées de 0 à 80, ligne par ligne.
- Les candidats d'une case sont stockés sur 9 bits (un bit par chiffre). C'est compact et rapide.
- Le **solveur exact** (`engine/exactSolver.ts`) compte les solutions et s'arrête à 2, ce qui suffit pour
  savoir si une grille est valable. Il combine des essais avec retour arrière et des éliminations :
  singletons, combinaisons de cage et règle des 45 (une bande de lignes, de colonnes ou un bloc fait
  toujours 45 × nombre d'unités).
- Il est vérifié par un second solveur volontairement naïf (`engine/__tests__/helpers.ts`). Les deux
  doivent toujours trouver le même nombre de solutions.
- Les grilles de test sont fabriquées par `npx tsx scripts/build-test-fixtures.ts` (graine fixe, environ
  3 minutes).
