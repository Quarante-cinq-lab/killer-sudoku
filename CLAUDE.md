# Projet : application Killer Sudoku pour iPad

## Référence
- Le cahier des charges complet est dans `docs/cahier-des-charges.md`.
- Lis-le entièrement en début de session si tu ne l'as pas encore fait dans ce projet.
- En cas de doute ou de contradiction, le cahier des charges fait foi. Signale l'écart au lieu de le contourner.

## Utilisateur
- Un seul utilisateur, qui teste sur un iPad Air 5 (Safari, application installée sur l'écran d'accueil).
- Il débute en développement : explique brièvement les choix techniques importants, en français, sans jargon inutile.
- Pour chaque test sur l'iPad, donne la procédure exacte (commande à lancer, adresse à ouvrir, gestes à faire).

## Méthode de travail
- Travaille étape par étape, selon la section 13 du cahier des charges.
- Avant de coder une étape, propose un découpage détaillé et attends la validation.
- Une étape est terminée quand ses tests passent et que son critère de recette est rempli.
- Ne passe jamais à l'étape suivante sans validation explicite de l'utilisateur.
- Fais au moins un commit par étape, avec un message clair en français.

## Priorité : MVP jouable
Premier objectif : une version jouable sur l'iPad le plus tôt possible.
1. Étapes 1 à 3 : moteur (solveur exact, solveur logique, notation, générateur), mais une banque réduite d'environ 50 grilles HARD et 50 grilles EXPERT.
2. Étape 4 : écran de jeu de base (grille, double clavier, notes, annuler/rétablir, chronomètre, victoire).
3. Étape 7 : PWA installable et déployée sur GitHub Pages.
Ensuite seulement : étapes 5, 6, puis banque complète, niveaux supérieurs et calibrage (étape 8).

## Conventions techniques
- TypeScript strict, React, Vite, vite-plugin-pwa, IndexedDB, Vitest (section 3).
- Le dossier `engine/` ne dépend jamais de l'interface : il est partagé par l'application et les scripts.
- Tous les paramètres de difficulté sont dans `engine/difficulty.config.json`, jamais en dur dans le code.
- Tous les textes de l'interface sont en français et regroupés dans un seul fichier.
- Aucun appel réseau dans l'application, en dehors de son propre chargement.
