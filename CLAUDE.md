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

## Sécurité et confidentialité (priorité absolue)
- Applique la section 12.1 du cahier des charges sans exception.
- Avant le premier commit : affiche la configuration Git (nom et e-mail) et attends que l'utilisateur confirme un pseudonyme et l'adresse « noreply » de GitHub.
- Avant chaque commit : vérifie qu'aucun fichier ne contient de nom réel, d'e-mail personnel, de chemin local nominatif, de capture d'écran, de mot de passe ou de clé. Signale tout doute au lieu de commiter.
- Ne pousse jamais rien vers GitHub sans l'accord explicite de l'utilisateur.

## Conventions techniques
- TypeScript strict, React, Vite, vite-plugin-pwa, IndexedDB, Vitest (section 3).
- Le dossier `engine/` ne dépend jamais de l'interface : il est partagé par l'application et les scripts.
- Tous les paramètres de difficulté sont dans `engine/difficulty.config.json`, jamais en dur dans le code.
- Tous les textes de l'interface sont en français et regroupés dans un seul fichier.
- Aucun appel réseau dans l'application, en dehors de son propre chargement.

## Consignes Karpathy

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
