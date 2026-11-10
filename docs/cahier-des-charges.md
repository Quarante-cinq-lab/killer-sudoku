# Cahier des charges – Application Killer Sudoku iPad

Version du 11 novembre 2026

## 1. Contexte et objectifs

L'application est un jeu de killer sudoku personnel, pour un seul joueur, sur iPad Air 5. Elle se concentre sur les niveaux difficiles, propose une bibliothèque de grilles rejouables et un stock de grilles qui ne s'épuise pas.

- **Utilisateur** : un seul joueur confirmé, qui a terminé toutes les grilles de l'application de référence *Killer Sudoku!* (Sarah Pierce), y compris les niveaux HARD, EXTRA HARD, IMPOSSIBLE et BONUS.
- **Objectif 1** : proposer des grilles du niveau HARD au niveau ULTIME, toutes à solution unique et sans chiffre donné au départ.
- **Objectif 2** : retrouver l'ergonomie de l'application de référence (double clavier chiffres/notes, fenêtre des combinaisons, calculatrice).
- **Objectif 3** : corriger ses deux défauts principaux : impossible de rejouer une grille terminée, et stock de grilles limité.
- **Contraintes** : aucune publicité, aucun compte, aucun achat, aucune donnée envoyée sur Internet.

Ce document est destiné à Claude Code, qui doit le suivre étape par étape (voir section 13).

## 2. Périmètre

La V1 livre un killer sudoku complet. Le mode Enquête, inspiré du Murdoku, arrive en V2, une fois la V1 stabilisée.

| Lot | Contenu |
| --- | --- |
| V1 | Moteur de résolution et de notation, générateur et banque de grilles, écran de jeu, outils killer, aides désactivables, bibliothèque rejouable, statistiques, application installée sur l'iPad |
| V2 | Mode Enquête (section 11) |
| Hors périmètre | Sudoku classique et autres variantes, multijoueur, synchronisation en ligne, publication sur l'App Store, optimisation pour iPhone |

## 3. Plateforme et architecture technique

L'application est une application web installable (PWA). On l'ajoute à l'écran d'accueil de l'iPad depuis Safari ; elle s'ouvre alors en plein écran et fonctionne entièrement hors ligne.

| Élément | Choix |
| --- | --- |
| Langage | TypeScript en mode strict |
| Outillage | Vite + vite-plugin-pwa (manifeste et service worker) |
| Interface | React |
| Rendu de la grille | SVG, pour un affichage net à toutes les tailles et un style facile à ajuster |
| Stockage local | IndexedDB (bibliothèque idb ou Dexie) |
| Calculs lourds | Web Worker, pour que l'interface reste fluide |
| Tests | Vitest |
| Hébergement | GitHub Pages (gratuit, en HTTPS, ce qui est obligatoire pour une PWA) |

**Organisation du dépôt**

- `engine/` : moteur commun (modèle de grille, solveur exact, solveur logique, notation, générateur), sans dépendance à l'interface.
- `app/` : la PWA.
- `scripts/` : génération de la banque de grilles en Node.js.
- `data/` : banque de grilles au format JSON, embarquée dans l'application.

Un seul moteur sert à tout : générer, noter, produire les indices et vérifier les grilles. Le script de génération et l'application utilisent donc exactement la même logique.

**Contraintes iPadOS**

- L'écran cible est l'iPad Air 5 (10,9 pouces, 1180 × 820 points), en portrait et en paysage.
- Safari peut effacer les données d'un site web peu utilisé. L'application doit donc demander un stockage persistant (`navigator.storage.persist()`) et proposer un export/import de la sauvegarde.
- Pendant le développement, Claude Code doit indiquer comment tester sur l'iPad (serveur local accessible en Wi-Fi ou déploiement de prévisualisation).

## 4. Règles du killer sudoku

Chaque grille respecte les règles standard du killer sudoku, sans aucun chiffre donné au départ.

1. La grille fait 9 × 9 cases et compte 9 blocs de 3 × 3.
2. Chaque ligne, chaque colonne et chaque bloc contient les chiffres 1 à 9, une seule fois chacun.
3. Les cages sont des groupes de cases reliées par un côté. Elles couvrent toute la grille, sans se chevaucher.
4. Chaque cage porte une somme. Les chiffres de la cage doivent donner cette somme, sans répétition à l'intérieur de la cage.
5. La grille a une solution unique, que l'on peut trouver par déduction, sans essai-erreur (vérifié par le solveur logique, section 5).
6. La partie est gagnée quand les 81 cases sont remplies et correspondent à la solution.

**Contraintes sur la forme des cages, selon le niveau**

- Taille des cages : de 2 à 6 cases. Les cages de 7 cases ou plus sont interdites.
- Cages d'une seule case : 2 au maximum en HARD, aucune à partir d'EXPERT.
- Les paramètres précis (répartition des tailles, nombre maximal de cages à combinaison unique) sont regroupés dans un fichier de configuration par niveau, pour pouvoir être ajustés (section 5).

## 5. Niveaux de difficulté et notation

L'application propose cinq niveaux, de HARD à ULTIME. Le niveau d'une grille dépend des techniques nécessaires pour la résoudre, mesurées par un solveur logique qui raisonne comme un joueur humain.

### 5.1 Catalogue des techniques

Le solveur logique applique toujours la technique la plus simple disponible. Chaque étape réalisée rapporte des points. Les pondérations ci-dessous sont des valeurs de départ, à calibrer.

| Groupe | Techniques | Points par étape (initial) |
| --- | --- | --- |
| A – Base | Singletons nus et cachés, élimination par combinaisons de cage, règle des 45 (innie/outie d'une case), paires et triplets nus ou cachés, pointing pairs, box/line, chevauchement cage/unité | 1 à 5 |
| B – Avancé | Innies/outies de plusieurs cases, cage splitting, comparaison de cages, combinaisons croisées entre cages, règle de parité, quads, X-Wing, Y-Wing, XYZ-Wing, Swordfish | 10 à 30 |
| C – Diabolique | X-Cycles, XY-Chain, coloriage simple, 3D Medusa, Jellyfish, WXYZ-Wing, Aligned Pair Exclusion | 40 à 80 |
| D – Extrême | Chaînes d'inférences alternées (AIC), X-Cycles groupés, X-Wing et Swordfish à ailerons, ensembles presque verrouillés (ALS) | 100 et plus |

Une grille que le solveur logique ne résout pas entièrement est rejetée, même si sa solution est unique.

### 5.2 Définition des niveaux

| Niveau | Condition sur les techniques | Temps cible | Équivalent dans l'application de référence |
| --- | --- | --- | --- |
| HARD | Groupe A uniquement, au moins 3 étapes de règle des 45 | 20 à 25 min | HARD (\~25 min) |
| EXPERT | Au moins 2 étapes du groupe B, aucune du groupe C | \~30 min | EXTRA HARD (\~30 min) |
| DIABOLIQUE | Au moins 2 étapes du groupe C, aucune du groupe D | \~40 min | IMPOSSIBLE (35 à 40 min) |
| EXTRÊME | Au moins 1 étape du groupe D, ou au moins 5 du groupe C | 50 à 60 min | BONUS (\~50 min) |
| ULTIME | Au moins 3 étapes du groupe D, score dans les 10 % les plus élevés du niveau EXTRÊME | 60 à 90 min | Aucun |

En plus de la condition sur les techniques, chaque niveau a un intervalle de score (somme des points de toutes les étapes) à respecter.

### 5.3 Critères complémentaires

- **Pas de goulot isolé** : une grille est rejetée si elle est triviale sauf une seule étape difficile. Règle de départ : le score obtenu sans l'étape la plus difficile doit rester au-dessus du score minimal du niveau inférieur.
- **Cages à combinaison unique** : leur nombre maximal diminue quand le niveau augmente.
- **Points d'entrée** : le nombre de déductions possibles au départ est mesuré et enregistré. Moins il y en a, plus la grille est difficile.
- Chaque grille enregistre son score, la liste des techniques utilisées avec leur nombre d'occurrences, et la version du moteur qui l'a notée.

### 5.4 Calibrage

- Pondérations, seuils et paramètres de cages sont regroupés dans un seul fichier, `engine/difficulty.config.json`, modifiable sans toucher au code.
- Après chaque grille terminée, l'application propose trois boutons : « Trop facile », « Bon niveau », « Trop dur ». Elle enregistre le choix avec le temps réalisé.
- Un script `npm run calibrate` lit un export de la sauvegarde. Il compare les temps réels aux temps cibles et propose de nouveaux seuils, à appliquer lors de la génération suivante de la banque.

## 6. Génération et banque de grilles

Les grilles sont produites à l'avance sur ordinateur par un script. Elles sont livrées dans l'application sous forme de banque, et l'on peut en ajouter à tout moment sans perdre l'historique de jeu.

### 6.1 Algorithme de génération

1. Générer une solution complète aléatoire, par retour arrière (backtracking) avec un ordre de chiffres tiré au hasard.
2. Découper la grille en cages, en faisant grandir des régions reliées entre elles. Les tailles suivent le profil du niveau visé, et une cage ne peut pas contenir deux fois le même chiffre.
3. Vérifier l'unicité de la solution avec le solveur exact, qui s'arrête dès qu'il trouve une deuxième solution.
4. Si la solution n'est pas unique, modifier localement les cages concernées (fusion ou redécoupage), puis vérifier à nouveau.
5. Noter la grille avec le solveur logique (section 5). Rejeter les grilles impossibles à résoudre par déduction ou déséquilibrées.
6. Classer la grille dans son niveau, puis éliminer les doublons (empreinte calculée après normalisation par symétries et permutation des chiffres).

### 6.2 Banque initiale

| Niveau | Nombre de grilles visé |
| --- | --- |
| HARD | 300 |
| EXPERT | 300 |
| DIABOLIQUE | 200 |
| EXTRÊME | 100 |
| ULTIME | 30 (à confirmer selon le temps de génération réel) |

Les grilles très difficiles sont rares quand on génère au hasard. Le script doit donc pouvoir tourner longtemps, sur plusieurs cœurs en parallèle, et reprendre là où il s'était arrêté.

### 6.3 Format d'une grille

```json
{
  "id": "EXP-0042",
  "level": "EXPERT",
  "number": 42,
  "score": 312,
  "techniques": { "innies_outies_multi": 3, "cage_splitting": 1, "x_wing": 1 },
  "entryPoints": 4,
  "cages": [ { "sum": 17, "cells": [0, 1, 10] } ],
  "solution": "81 chiffres, de la case en haut à gauche à celle en bas à droite",
  "engineVersion": "1.0.0",
  "createdAt": "2026-11-11"
}
```

Les cases sont numérotées de 0 à 80, ligne par ligne. L'identifiant d'une grille ne change jamais.

### 6.4 Commandes et ajout de grilles

- `npm run generate -- --level EXPERT --count 100` : génère des grilles, affiche la progression et un rapport (nombre obtenu par niveau, temps moyen par grille).
- Les nouvelles grilles sont ajoutées à la banque. Une grille déjà présente n'est jamais écrasée.
- Dans l'application, le menu Réglages permet d'importer un fichier de banque complémentaire, sans perte d'historique.
- Option V1.1 : génération directement sur l'iPad, dans un Web Worker, pour les niveaux HARD et EXPERT uniquement (bouton « Générer une grille »). Prévoir d'abord une mesure du temps de génération réel sur l'iPad.

## 7. Écran de jeu

L'écran de jeu reprend la disposition de l'application de référence : la grille occupe le haut de l'écran, le double clavier le bas. En paysage, le clavier passe à droite de la grille.

### 7.1 Barre supérieure

- À gauche : le nom de la grille (par exemple « Expert #042 ») et un bouton de retour à l'accueil.
- À droite : le bouton pause et le chronomètre (format hh:mm:ss).
- Un menu donne accès à : recommencer la grille, ajuster les aides de la partie, mettre la grille en favori.

### 7.2 Grille

- La grille est carrée et aussi grande que l'écran le permet.
- Traits : fins et gris entre les cases, épais et noirs entre les blocs 3 × 3.
- Cages : un liseré gris-mauve d'environ 3 px, tracé à l'intérieur des cases avec un retrait d'environ 4 px. C'est le style de l'application de référence ; la couleur et l'épaisseur sont réglables.
- Somme de la cage : en petit, en haut à gauche de sa première case (celle située le plus en haut, puis le plus à gauche), sur un fond blanc pour rester lisible.
- Chiffres définitifs : en grand, centrés dans la case.
- Notes : affichées par défaut en ligne, au centre de la case, dans l'ordre de saisie (comme dans l'application de référence). En option, une grille 3 × 3 triée.
- Case sélectionnée : bordure de couleur. Toute sa cage est surlignée en vert clair.
- Sélection multiple : en faisant glisser le doigt ou l'Apple Pencil, qui fonctionne comme un doigt.

### 7.3 Clavier

| Zone | Contenu |
| --- | --- |
| Colonne gauche | Annuler, Rétablir, Indice |
| Pavé chiffres (grand) | 1 à 9 : saisie d'un chiffre définitif |
| Pavé notes (plus petit, autre teinte) | 1 à 9 : ajoute la note, ou la retire si elle est déjà présente |
| Colonne droite | Combinaisons de la cage sélectionnée (icône calculatrice), Calculatrice libre (icône bloc-notes), Menu Options (icône crayon), Cages virtuelles |

- Un chiffre définitif remplace les notes de la case.
- Une note s'applique à toutes les cases sélectionnées.
- L'effacement passe par le menu Options (« Effacer la sélection », « Tout effacer »).
- Annuler et Rétablir couvrent toutes les actions : chiffres, notes, combinaisons barrées, cages virtuelles. L'historique n'a pas de limite et il est conservé dans la sauvegarde.

### 7.4 Outils killer

- **Fenêtre des combinaisons** : elle s'ouvre sur la cage sélectionnée et liste toutes les combinaisons possibles pour sa taille et sa somme. Un toucher barre ou rétablit une combinaison. Ces choix sont mémorisés par cage et sauvegardés. La fenêtre est flottante, déplaçable, et se ferme par un « x ».
- **Calculatrice** : fenêtre flottante indépendante de la grille, comme dans l'application de référence. Deux champs, « Somme » et « Nombre de cases », se remplissent avec le pavé chiffres, chiffre par chiffre. Une touche « 0 » permet d'écrire les nombres à deux chiffres (1 puis 0 pour 10, 2 puis 5 pour 25). Une touche « C » vide le champ actif. Un toucher sur un champ le rend actif. Le bouton « Lister les combinaisons » affiche toutes les combinaisons possibles, par exemple 25 en 4 cases. En option, on peut ajouter des chiffres obligatoires ou exclus.
- **Cages virtuelles** : on sélectionne des cases et on leur attribue une somme déduite. Elles s'affichent en pointillé d'une autre couleur, alimentent la fenêtre des combinaisons et peuvent être supprimées.

**Menu Options (icône crayon)**

Une fenêtre flottante regroupe les commandes suivantes :

1. Tout effacer : vide toute la grille, après confirmation.
2. Effacer la sélection : vide les cases sélectionnées.
3. Remplir toutes les notes : inscrit tous les candidats possibles dans chaque case vide.
4. Annuler.
5. Rétablir.
6. Fermer.

### 7.5 Pause et fin de partie

- La pause masque la grille et arrête le chronomètre. Le chronomètre s'arrête aussi quand l'application passe en arrière-plan.
- En fin de partie, un écran récapitule le temps, le nombre d'indices et le nombre de vérifications. Il propose les boutons de ressenti (section 5.4), puis « Rejouer », « Grille suivante » et « Bibliothèque ».

## 8. Bibliothèque et autres écrans

Aucune grille ne disparaît jamais de la bibliothèque : toute grille peut être reprise ou recommencée à zéro, à tout moment.

### 8.1 Accueil

- Un grand bouton « Reprendre » ouvre la dernière partie en cours.
- Cinq tuiles « Nouvelle grille », une par niveau, affichent le nombre de grilles encore jamais jouées.
- Des accès mènent à la Bibliothèque, aux Statistiques et aux Réglages.
- « Nouvelle grille » tire au hasard une grille jamais jouée du niveau. S'il n'en reste plus, l'application le signale et propose la grille terminée la plus anciennement jouée.

### 8.2 Bibliothèque

- Les grilles sont regroupées par niveau. Chacune est affichée avec une miniature, son numéro et son statut : jamais jouée, en cours (avec le temps écoulé), terminée (avec le meilleur temps), favorite.
- Filtres : niveau, statut, favoris.
- Tris : numéro, meilleur temps, date de dernière partie, score de difficulté.
- Actions sur une grille : Jouer ou Reprendre, Recommencer à zéro, Ajouter aux favoris ou les retirer, consulter l'historique des parties de la grille.
- Plusieurs parties peuvent être en cours en même temps, sur des grilles différentes.

### 8.3 Réglages

- Les aides et leurs valeurs par défaut (section 9).
- L'affichage des notes : en ligne ou en grille 3 × 3.
- Le thème : clair, sombre ou automatique.
- La couleur du liseré des cages et du surlignage.
- L'export et l'import de la sauvegarde (fichier JSON).
- L'import d'un fichier de banque complémentaire.
- Une page « À propos » : version de l'application et du moteur, nombre de grilles par niveau.

## 9. Aides désactivables

Toutes les aides peuvent être activées ou désactivées dans les Réglages, et ajustées en cours de partie. Un préréglage « Puriste » désactive tout sauf le surlignage.

| Aide | Par défaut | Description |
| --- | --- | --- |
| Surlignage ligne, colonne et bloc | Activée | Met en évidence les zones liées à la case sélectionnée |
| Surlignage des chiffres identiques | Activée | Met en évidence toutes les cases qui contiennent le chiffre sélectionné |
| Signalement des conflits | Activée | Marque en rouge un doublon (ligne, colonne, bloc, cage) ou une somme de cage impossible |
| Nettoyage automatique des notes | Activée | Retire une note devenue impossible après la saisie d'un chiffre dans la même ligne, colonne, bloc ou cage |
| Filtrage des combinaisons | Activée | Grisé des combinaisons incompatibles avec les chiffres déjà posés |
| Notes automatiques | Activée | Commande « Remplir toutes les notes » du menu Options (section 7.4) ; la masquer si l'aide est désactivée |
| Vérification | À la demande | Bouton qui marque les chiffres faux par rapport à la solution |
| Indice | À la demande | Voir ci-dessous |

**Indice progressif**

Chaque appui sur le bouton Indice donne un niveau de détail supplémentaire sur la même déduction :

1. le nom de la technique et la zone concernée (par exemple « Règle des 45 dans le bloc 5 ») ;
2. l'explication du raisonnement, avec la mise en évidence des cases utilisées ;
3. l'application de la déduction (chiffre placé ou notes éliminées).

L'indice part de l'état actuel de la grille du joueur. Si la grille contient une erreur, l'indice le signale au lieu de proposer une déduction.

Les indices et les vérifications utilisés sont comptés dans l'historique. Une partie terminée avec au moins un indice est marquée comme telle dans les statistiques.

## 10. Sauvegarde, historique et statistiques

Tout est enregistré automatiquement, à chaque action, dans IndexedDB. On retrouve donc une partie exactement dans l'état où on l'a laissée.

- **État sauvegardé pour chaque partie** : chiffres, notes et leur ordre de saisie, combinaisons barrées, cages virtuelles, historique d'annulation, temps écoulé.
- **Historique par grille** : une ligne par partie, avec la date de début, la date de fin, la durée, le nombre d'indices et de vérifications, et le ressenti.
- **Statistiques par niveau** : grilles terminées, temps moyen et médian, meilleur temps, pourcentage de parties sans indice, série en cours de parties sans indice.
- **Évolution** : un graphique du temps moyen par niveau, mois par mois.
- **Export et import** : un fichier JSON complet, qui contient la progression, l'historique et les réglages. La banque de grilles n'y figure pas, puisqu'elle est fournie avec l'application.
- **Compatibilité** : le schéma de données est versionné, avec une migration automatique lors des mises à jour de l'application.

## 11. Mode Enquête (V2)

Le mode Enquête reprend la mécanique du Murdoku (Manuel Garand) : placer des personnages sur un plan selon des indices pour démasquer le meurtrier. Il ne reprend ni son nom, ni ses grilles, ni ses illustrations : tout est généré par l'application.

### 11.1 Règles

1. La grille est carrée, de 6 × 6 à 9 × 9 cases. Elle est découpée en pièces (par exemple cuisine, salon, bureau).
2. Elle accueille N personnages pour une grille N × N : N − 1 suspects et une victime.
3. Chaque ligne et chaque colonne contient exactement un personnage.
4. Certaines cases sont occupées par du mobilier. Les meubles bloquants (étagère, table, plante) ne peuvent pas recevoir de personnage ; les meubles occupables (chaise, lit, canapé) le peuvent.
5. Chaque suspect a un indice. Types d'indices :
   - dans telle pièce, ou pas dans telle pièce ;
   - à côté de tel objet (case adjacente par un côté, dans la même pièce) ;
   - assis sur tel type de meuble ;
   - dans telle ligne ou telle colonne ;
   - dans la même pièce qu'un autre personnage, ou dans une pièce différente ;
   - seul dans sa pièce ;
   - un nombre donné de cases au nord, au sud, à l'est ou à l'ouest d'un autre personnage.
6. Le meurtrier est la seule personne qui se trouve seule dans une pièce avec la victime.

### 11.2 Génération

1. Créer le plan : découpage en pièces et mobilier, à partir de modèles de décor.
2. Placer aléatoirement les personnages selon les règles 3 et 4, en s'assurant qu'une seule personne partage une pièce avec la victime.
3. Générer un grand nombre d'indices vrais, puis en retenir un ensemble minimal qui garantit une solution unique (vérification par un solveur).
4. Noter la difficulté selon la profondeur de déduction nécessaire et la taille de la grille. Trois niveaux sont prévus : Difficile, Expert et Diabolique.

### 11.3 Interface

- Le plan s'affiche avec des pièces colorées et des icônes simples pour le mobilier.
- Un panneau liste les personnages et leurs indices. Un indice déjà exploité peut être coché.
- Le joueur pose un personnage sur une case, ou marque une case d'une croix pour l'exclure. Annuler et Rétablir sont disponibles.
- Une fois tous les personnages placés, le joueur désigne le meurtrier, puis l'application valide la solution.
- La bibliothèque, l'historique et les statistiques fonctionnent comme pour le killer.

## 12. Exigences non fonctionnelles

| Domaine | Exigence |
| --- | --- |
| Performance | Ouverture de l'application en moins de 2 s ; réaction à un toucher en moins de 50 ms ; indice calculé en moins de 1 s |
| Hors ligne | 100 % des fonctions disponibles en mode avion après la première installation |
| Lisibilité | Sommes de cage d'au moins 11 pt ; contraste conforme au niveau AA des WCAG ; thème sombre |
| Confidentialité | Aucun appel réseau en dehors du chargement de l'application ; aucune mesure d'audience ; aucun compte |
| Langue | Interface en français ; tous les textes regroupés dans un seul fichier |
| Qualité du code | TypeScript strict ; linter et formatage automatiques ; tests unitaires du moteur, avec au moins 3 cas par technique du solveur logique |
| Fiabilité des grilles | Tests automatiques : chaque grille de la banque a une solution unique et le solveur logique la résout entièrement |
| Documentation | Un README qui explique comment installer, lancer, tester, générer des grilles, déployer et installer l'application sur l'iPad |

## 13. Plan de développement et critères de recette

Claude Code développe l'application en neuf étapes, dans l'ordre. Une étape n'est terminée que lorsque ses tests passent et que son critère de recette est rempli. Chaque étape fait l'objet d'au moins un commit.

| Étape | Contenu | Critère de recette |
| --- | --- | --- |
| 1. Socle et solveur exact | Projet Vite/TypeScript, modèle de grille et de cages, solveur exact qui compte les solutions (arrêt à 2) | Résout un jeu de grilles killer de test ; détecte correctement les grilles à solutions multiples |
| 2. Solveur logique et notation | Techniques des groupes A et B, puis C et D ; trace lisible de chaque étape ; calcul du score ; fichier de configuration | Au moins 3 tests par technique ; la trace d'une grille de test est lisible par un humain |
| 3. Générateur et banque | Algorithme de la section 6, script en ligne de commande, dédoublonnage, rapport | Banque initiale produite ; 100 % des grilles uniques et résolues par déduction ; rapport de répartition par niveau |
| 4. Écran de jeu | Grille SVG, sélection simple et multiple, double clavier, notes, annuler/rétablir, chronomètre, pause, victoire | Une partie complète jouable sur iPad, en portrait et en paysage |
| 5. Outils et aides | Combinaisons, calculatrice, cages virtuelles, aides de la section 9, indice progressif | Chaque aide s'active et se désactive ; l'indice nomme correctement la technique sur 10 positions de test |
| 6. Bibliothèque et données | Accueil, bibliothèque, sauvegarde automatique, historique, statistiques, réglages, export et import | Fermer puis rouvrir l'application restitue exactement chaque partie ; une grille terminée se rejoue |
| 7. PWA et déploiement | Manifeste, icône, service worker, déploiement GitHub Pages, guide d'installation sur l'iPad | Installation depuis Safari ; fonctionnement complet en mode avion |
| 8. Calibrage | Script de calibrage ; 10 grilles jouées par niveau ; ajustement des seuils ; régénération si besoin | Temps réels dans les fourchettes de la section 5.2, à ± 20 % près |
| 9. Mode Enquête (V2) | Section 11 | Grilles générées à solution unique ; une enquête complète jouable |

**Consignes pour Claude Code**

- Lire tout le document avant de commencer, puis proposer un découpage détaillé de l'étape en cours avant de coder.
- Ne pas passer à l'étape suivante sans validation de l'utilisateur.
- Signaler toute impossibilité ou tout écart par rapport au document au lieu de le contourner en silence.
- Expliquer brièvement les choix techniques importants ; l'utilisateur débute en développement.

## 14. Points ouverts

- [x] Rôle des icônes « bloc-notes » et « crayon » : précisé et intégré en section 7.
- [ ] Valider ou ajuster les pondérations et les seuils de la section 5 après le calibrage (étape 8).
- [ ] Fixer la taille de la banque ULTIME d'après le temps de génération mesuré à l'étape 3.
- [ ] Choisir le nom de l'application et son icône.
- [ ] Créer un compte GitHub (gratuit), nécessaire à l'hébergement sur GitHub Pages, si tu n'en as pas déjà un.
- [ ] Décider si la génération de grilles directement sur l'iPad (option V1.1) est utile, une fois la banque en place.

## Sources

- [Killer Sudoku! (Sarah Pierce) – App Store](https://apps.apple.com/app/id437747279)
- [Killer Sudoku by Logic Wiz – App Store](https://apps.apple.com/us/app/-/id1641151077)
- [Killer Sudoku + (James Gibbs) – App Store](https://apps.apple.com/us/app/killer-sudoku/id866856408)
- [SudokuWiki – Killer Sudoku Solver (liste des stratégies)](https://www.sudokuwiki.org/killersudoku.htm)
- [SudokuWiki – Grading Puzzles](https://www.sudokuwiki.org/Grading_Puzzles)
- [Murdoku expliqué – allthings.how](https://allthings.how/?p=30434)
