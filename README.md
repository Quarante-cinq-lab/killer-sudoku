# Killer Sudoku pour iPad

Jeu de killer sudoku personnel, hors ligne, installable sur iPad (PWA). Le cahier des charges complet est dans
[docs/cahier-des-charges.md](docs/cahier-des-charges.md).

**Projet personnel, non destiné à la diffusion. Tous droits réservés.** Voir [LICENSE](LICENSE).

État : **banque complète** (930 grilles, cinq niveaux : 300 HARD, 300 EXPERT, 200 DIABOLIQUE, 100 EXTRÊME, 30
ULTIME) et toutes les techniques des groupes A à D. L'application est jouable sur l'iPad, installable et hors
ligne. Reste le calibrage (étape 8), qui demande de jouer une dizaine de grilles par niveau.

## Installer

Prérequis : [Node.js](https://nodejs.org) en version LTS (22 ou plus) et git.

```bash
npm install
```

## Commandes

| Commande                                        | Rôle                                                    |
| ----------------------------------------------- | ------------------------------------------------------- |
| `npm test`                                      | lance tous les tests automatiques                       |
| `npm run test:watch`                            | relance les tests à chaque modification                 |
| `npm run typecheck`                             | vérifie les types TypeScript                            |
| `npm run lint`                                  | cherche les erreurs courantes (ESLint)                  |
| `npm run format`                                | met en forme tout le code (Prettier)                    |
| `npm run solve -- fichier.json`                 | résout une grille et dit si sa solution est unique      |
| `npm run trace -- fichier.json`                 | montre le raisonnement pas à pas, le score et le niveau |
| `npm run generate -- --level EXPERT --count 50` | génère des grilles et les ajoute à la banque            |
| `npm run dev`                                   | lance l'application sur le PC (http://localhost:5173)   |
| `npm run dev:ipad`                              | idem, accessible depuis l'iPad sur le même Wi-Fi        |
| `npm run build`                                 | produit la version finale dans `dist/`                  |
| `npm run preview`                               | sert la version finale (http://localhost:4173)          |
| `npm run icons`                                 | redessine l'icône et les écrans de démarrage            |

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
- `engine/logic/` : solveur logique (une technique par famille dans `techniques/`).
- `engine/difficulty.config.json` : tous les paramètres de difficulté (ordre et points des techniques,
  conditions des niveaux, forme des cages).
- `app/` : l'application web (React).
  - `app/game/state.ts` : état d'une partie et actions du joueur (fonctions pures, testées) ;
  - `app/game/GameScreen.tsx`, `Keypad.tsx` : écran de jeu et double clavier ;
  - `app/grid/` : grille SVG et tracé des cages ;
  - `app/storage.ts` : sauvegarde automatique dans IndexedDB ;
  - `app/bank.ts` : banque de grilles embarquée (fichiers `data/bank-*.json`).
- `texts/fr.ts` : tous les textes en français (interface, noms des techniques, phrases de la trace).
- `scripts/` : outils en ligne de commande (Node.js).
- `engine/generator/` : générateur de grilles (découpage, unicité, empreinte de dédoublonnage).
- `data/` : banque de grilles, un fichier par niveau (`bank-hard.json`, `bank-expert.json`…).

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

## Le solveur logique et la notation

- Le **solveur logique** (`engine/logic/solver.ts`) raisonne comme un joueur. Au départ, chaque case reçoit
  les chiffres permis par sa cage (comme « Remplir toutes les notes »). Ensuite, à chaque tour, il applique
  la technique la plus simple qui fait progresser, dans l'ordre du fichier de configuration.
- Techniques programmées :
  - groupe A : singletons nus et cachés, combinaisons de cage, règle des 45 sur une case, pointing pair,
    box/line, chevauchement cage/unité, paires et triplets nus ou cachés ;
  - groupe B : innies/outies de plusieurs cases, découpage de cage, comparaison innies/outies, parité,
    combinaisons croisées, quadruplets nus ou cachés, X-Wing, Y-Wing, XYZ-Wing, Swordfish.
  - groupe C : X-Cycles, coloriage simple, XY-Chain, WXYZ-Wing, Jellyfish, Aligned Pair Exclusion,
    3D Medusa ;
  - groupe D : X-Wing et Swordfish à aileron, X-Cycles groupés, ensembles presque verrouillés (ALS-XZ),
    chaînes d'inférences alternées (AIC).
- Les chaînes et le coloriage reposent sur des **liens** entre candidats (`engine/logic/links.ts`),
  adaptés au killer : un chiffre obligatoire d'une cage qui n'y a que deux places forme un lien fort, et deux
  chiffres d'une même cage qu'aucune combinaison ne réunit forment un lien faible (« lien de somme »).
- Chaque étape est une donnée (technique, cases, chiffres posés ou retirés). `engine/logic/describe.ts`
  la met en phrase avec les textes de `texts/fr.ts` ; la même donnée servira aux indices.
- La **notation** (`engine/rating.ts`) additionne les points des étapes et compte les points d'entrée
  (déductions du groupe A possibles au départ). Elle retient le niveau le plus élevé dont les conditions sont
  remplies. Elle vérifie ensuite l'intervalle de score, la forme des cages et l'absence de goulot isolé.
- Les intervalles de score sont encore vides (`null`) : ils seront fixés à l'étape 3, d'après les scores
  réellement obtenus.

## Le générateur et la banque

`npm run generate -- --level HARD --count 50` produit des grilles selon la section 6.1 du cahier des charges :

1. une solution complète tirée au hasard ;
2. un découpage en cages d'un seul tenant, sans chiffre répété, selon le profil du niveau
   (`generation` dans `engine/difficulty.config.json` : poids de chaque taille de cage) ;
3. tant que le solveur exact trouve une deuxième solution, une retouche locale : deux cages voisines sont
   fusionnées puis redécoupées autrement, de façon à interdire cette deuxième solution ;
4. la notation par le solveur logique : seules les grilles résolues par déduction et classées sont gardées ;
5. le dédoublonnage : une empreinte identique pour les 8 rotations et symétries d'une même grille.

Options :

- `--workers 4` : nombre de cœurs utilisés (par défaut, tous sauf un) ;
- `--seed 123` : graine de départ, pour reproduire exactement un tirage ;
- `--only` : ne garde que le niveau visé (sinon, une grille d'un autre niveau est gardée dans sa banque) ;
- `--dry-run` : n'enregistre rien ; le rapport sert à mesurer les scores et à régler la configuration.

Chaque grille retenue est écrite aussitôt dans `data/`. On peut arrêter avec `Ctrl + C` puis relancer :
rien n'est perdu, et une grille existante n'est jamais modifiée. Les identifiants (`HRD-0001`,
`EXP-0001`…) ne changent jamais et un numéro n'est jamais réutilisé.

**Niveaux difficiles (recherche ciblée).** Les grilles tirées au hasard sont presque toujours soit
faciles, soit impossibles à finir par déduction. Pour DIABOLIQUE, EXTRÊME et ULTIME, le générateur part donc
d'une grille EXPERT et retouche ses cages pas à pas (`engine/generator/harden.ts`) : une retouche n'est gardée
que si la grille reste à solution unique, résolue par déduction, plus difficile, et sans dépasser le niveau
visé. Réglages : `generation.<NIVEAU>.harden` dans `engine/difficulty.config.json`.

La banque complète (300 HARD, 300 EXPERT, 200 DIABOLIQUE, 100 EXTRÊME, 30 ULTIME) a été produite en un peu plus
d'une heure sur 7 cœurs. Les 50 premières grilles HARD et EXPERT viennent des graines 20261111 et 20261112, le
reste des graines 20261113 à 20261117.

Pour voir le raisonnement d'une grille de la banque : `npm run trace -- data/bank-expert.json 12` (12e grille).

## L'écran de jeu (étape 4)

- **Sélection** : toucher une case la sélectionne ; glisser le doigt (ou l'Apple Pencil) en sélectionne
  plusieurs. La cage de la dernière case touchée est surlignée en vert clair.
- **Grand pavé** : chiffre définitif dans les cases sélectionnées (il remplace les notes). Un second appui
  sur le même chiffre l'efface.
- **Petit pavé** : note dans les cases vides sélectionnées. Si toutes l'ont déjà, elle est retirée.
- **Options** (crayon) : Tout effacer, Effacer la sélection, Remplir toutes les notes, Annuler, Rétablir.
- **Annuler / Rétablir** : sans limite, conservés dans la sauvegarde.
- **Chronomètre** : il s'arrête en pause et quand l'application passe en arrière-plan.
- **Sauvegarde** : chaque action est enregistrée ; « Reprendre » sur l'accueil rouvre la dernière partie.
- **Clavier physique** (facultatif) : chiffres, Maj + chiffre pour une note, flèches, Retour arrière pour
  effacer, Cmd + Z pour annuler, Cmd + Maj + Z pour rétablir.

## Outils, aides et indice (étape 5)

- **Combinaisons de la cage** : toutes les combinaisons de la cage sélectionnée et de ses cages virtuelles.
  Un toucher barre ou rétablit une combinaison ; celles qui contredisent les chiffres posés sont grisées.
- **Combinaisons** (bloc-notes) : « Somme » et « Nombre de cases » se remplissent avec le grand pavé (qui
  change de teinte), « 0 » pour 10, 20…, « C » pour effacer ; chiffres obligatoires ou exclus en option.
- **Calculatrice** : une vraie calculatrice (+, −, ×, ÷, =, C, ←), avec l'opération en cours et le résultat.
  Le résultat reste affiché quand on ferme puis rouvre la fenêtre pendant la partie.
- **Somme** (colonne de gauche, évolution E4) : toucher des cages pour additionner leurs sommes (Σ) ; le
  bandeau donne aussi la règle des 45 quand une ligne, une colonne, un bloc ou une bande est entièrement
  couvert (aide désactivable). Interrupteur « cages | cases remplies ». « Créer une cage virtuelle » en un geste.
- **Cages virtuelles** (refonte E5) : sélectionner des cases puis « Créer ». La somme est proposée quand elle
  se déduit (cages entières, ou 45 moins des cages entières d'une ligne, colonne ou bloc). Une couleur par
  cage ; on peut les montrer, les masquer ou les supprimer. Les combinaisons fonctionnent quand leurs cases se
  voient deux à deux ; les conflits (somme dépassée ou impossible) sont signalés. Une cage virtuelle n'est
  jamais comparée à la solution : c'est une note.
- Les fenêtres se déplacent en faisant glisser leur barre de titre.
- **Aides** (menu « ⋯ » → Aides de la partie) : surlignages, conflits, nettoyage automatique des notes,
  filtrage des combinaisons, notes automatiques, vérification, indice. Préréglage **Puriste**.
- **Vérifier la grille** (menu « ⋯ ») : marque en rouge les chiffres faux.
- **Indice** : 1er appui, la technique et la zone ; 2e, l'explication et les cases utilisées (en jaune) ;
  3e, la déduction est appliquée (annulable). Si la grille contient une erreur, l'indice la signale.
  Le calcul part des chiffres et des notes du joueur (`engine/hint.ts`).
- Annuler et Rétablir couvrent aussi les combinaisons barrées, les cages virtuelles et les indices.

## Bibliothèque, statistiques et réglages (étape 6)

- **Accueil** : Reprendre, une tuile par niveau (grilles jamais jouées), Bibliothèque, Statistiques, Réglages.
- **Bibliothèque** : toutes les grilles avec miniature et statut (jamais jouée, en cours avec le temps,
  terminée avec le meilleur temps, favorite ★) ; filtres par niveau, statut et favoris ; tris par numéro,
  meilleur temps, dernière partie ou difficulté. Pour chaque grille : jouer ou reprendre, recommencer,
  favori, historique des parties.
- **Fin de partie** : temps, indices, vérifications, ressenti (Trop facile, Bon niveau, Trop dur), puis
  Grille suivante, Rejouer ou Bibliothèque. Une partie recommencée avant la fin est notée « abandonnée ».
- **Statistiques** par niveau (terminées, temps moyen et médian, meilleur temps, parties sans indice,
  série en cours) et graphique du temps moyen par mois, consultable aussi en tableau.
- **Réglages** : aides par défaut des nouvelles parties, notes en ligne ou en grille 3 × 3, thème,
  couleurs, export et import de la sauvegarde, import d'une banque complémentaire, À propos.
- **Sauvegarde** : tout est enregistré dans IndexedDB à chaque action (`app/storage.ts`, schéma
  versionné avec migration automatique). L'export ouvre la feuille de partage de l'iPad : choisir
  « Enregistrer dans Fichiers ». L'import vérifie le fichier et demande confirmation avant de remplacer.
  Les grilles importées en complément figurent dans l'export, pour que leur historique reste utilisable.

## Erreurs et « Recommencer » (évolutions E1 et E2)

- **Mode erreurs** (réglage, activé par défaut) : chaque chiffre posé est comparé à la solution. Un chiffre
  faux s'affiche en rouge et compte une erreur (« Erreurs : 1 / 3 » dans la barre). Effacer ou annuler ne
  retire pas l'erreur ; les notes ne sont jamais vérifiées. À la 3e erreur, la grille se bloque et l'écran
  « Partie perdue » propose de recommencer. Le réglage s'applique aux nouvelles parties seulement.
- Les conflits (doublon, somme impossible) sont signalés en orangé, pour ne pas les confondre avec un chiffre
  faux.
- **Recommencer la grille** : menu « ⋯ », menu Options, écran « Partie perdue » et bibliothèque. Tout repart
  de zéro ; la tentative précédente reste dans l'historique (abandonnée ou perdue).
- Statistiques : parties perdues et erreurs moyennes par grille terminée.

## Installer l'application sur l'iPad

L'application est publiée sur GitHub Pages : **https://quarante-cinq-lab.github.io/killer-sudoku/**

Sur l'iPad :

1. Ouvrir **Safari** (pas un autre navigateur) à l'adresse de l'application.
2. Toucher le bouton **Partager** (carré avec une flèche vers le haut), puis **Sur l'écran d'accueil**, puis
   **Ajouter**.
3. Lancer **Killer Sudoku** depuis son icône : l'application s'ouvre en plein écran, sans barre Safari.
4. Au premier lancement, elle garde une copie de tous ses fichiers : elle fonctionne ensuite en **mode avion**.

Les parties sont enregistrées sur l'iPad seulement (IndexedDB), jamais en ligne.

**Mises à jour** : quand une nouvelle version est publiée, l'application la télécharge en arrière-plan à
l'ouverture suivante (avec Internet). Elle s'applique au lancement d'après, une fois l'application complètement
fermée (balayer vers le haut dans le sélecteur d'applications). Les parties sauvegardées ne sont pas touchées.

## Publication (GitHub Pages)

- À chaque envoi sur la branche `main`, GitHub vérifie le code (types, lint, tests, audit des dépendances),
  construit l'application et la publie (`.github/workflows/deploy.yml`).
- Chaque pull request passe par les mêmes vérifications, sans publication : ne fusionner qu'avec une coche verte.
- Réglage à faire une fois sur GitHub : **Settings → Pages → Source : GitHub Actions**.
- Dependabot (`.github/dependabot.yml`) propose une mise à jour groupée par mois pour les bibliothèques npm et
  une pour les actions GitHub. Les correctifs de sécurité arrivent sans attendre, regroupés eux aussi. Activer
  **Settings → Code security → Dependabot alerts**.

## Sécurité et confidentialité

- Aucune donnée collectée, aucun appel réseau en dehors du chargement de l'application.
- La version publiée applique une politique de sécurité stricte (`Content-Security-Policy`,
  `default-src 'self'`) : elle ne charge que ses propres fichiers.
- Pas d'indexation par les moteurs de recherche (`noindex` et `robots.txt`).
- Les commits sont signés d'un pseudonyme et de l'adresse « noreply » de GitHub (section 12.1 du cahier des
  charges).
