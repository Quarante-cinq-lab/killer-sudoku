# Évolutions demandées – 12 novembre 2026

Ces évolutions modifient le cahier des charges (`docs/cahier-des-charges.md`).
Avant de coder : intègre-les dans les sections concernées du cahier des charges, propose un découpage, puis attends la validation.

---

## E1. Vérification immédiate des erreurs et limite de 3 erreurs

**Besoin** : savoir tout de suite qu'un chiffre est faux, pour identifier l'endroit où le raisonnement a déraillé, et s'obliger à réfléchir avant de poser un chiffre.

**Règles**

1. Dès qu'un chiffre définitif est posé, il est comparé à la solution.
2. S'il est faux, il s'affiche en rouge et le compteur d'erreurs augmente de 1.
3. Le compteur s'affiche dans la barre supérieure, à côté du chronomètre : « Erreurs : 1 / 3 ».
4. Un chiffre faux reste affiché en rouge jusqu'à ce qu'il soit effacé ou remplacé. L'effacer ne retire pas l'erreur du compteur.
5. Les notes ne sont jamais vérifiées et ne comptent pas comme des erreurs.
6. Annuler (undo) ne retire pas une erreur du compteur.
7. À la 3e erreur, la partie s'arrête :
   - la grille est bloquée (plus aucune saisie possible) ;
   - un écran « Partie perdue » affiche le temps écoulé et propose « Recommencer la grille » ou « Retour à l'accueil » ;
   - la partie est enregistrée dans l'historique comme « perdue ».
8. Réglage « Mode erreurs », activé par défaut : Vérification immédiate + limite de 3 erreurs. Il peut être désactivé dans les Réglages, mais seulement entre deux parties : il ne peut pas être changé en cours de partie, pour ne pas fausser les statistiques.
9. Statistiques : nombre de parties perdues par niveau, et nombre moyen d'erreurs par partie terminée.

## E2. Recommencer une grille à zéro

**Besoin** : relancer une grille depuis le début, avec un nouveau chronomètre.

1. Commande « Recommencer la grille », accessible :
   - dans le menu de la barre supérieure ;
   - dans le menu Options (icône crayon) ;
   - sur l'écran « Partie perdue » ;
   - dans la bibliothèque, sur chaque grille.
2. Une confirmation est demandée (sauf depuis l'écran « Partie perdue »).
3. Effet : la grille est vidée (chiffres, notes, combinaisons barrées, cages virtuelles, historique d'annulation), le chronomètre repart à 00:00:00 et le compteur d'erreurs à 0.
4. La tentative précédente reste dans l'historique de la grille, marquée « abandonnée » (ou « perdue » si elle s'est arrêtée à 3 erreurs).

## E3. Renommer l'outil actuel « Calculatrice » et ajouter une vraie calculatrice

1. L'outil actuel (Somme + Nombre de cases → liste des combinaisons) est renommé **« Combinaisons »**. Pour éviter toute confusion, la fenêtre des combinaisons de la cage sélectionnée devient **« Combinaisons de la cage »**.
2. Ajouter une **vraie calculatrice**, avec sa propre icône :
   - fenêtre flottante et déplaçable, qui ne masque pas la grille plus que nécessaire ;
   - touches 0 à 9, +, −, ×, ÷, =, C (tout effacer), ← (effacer le dernier chiffre) ;
   - affichage de l'opération en cours et du résultat ;
   - le dernier résultat reste affiché quand on ferme puis rouvre la calculatrice pendant la partie.
3. Ces deux outils restent disponibles même en mode puriste.

## E4. Somme de plusieurs cages (bouton « + »)

**Besoin** : additionner rapidement les sommes de plusieurs cages, par exemple pour appliquer la règle des 45.

**Hypothèse de fonctionnement (à confirmer par l'utilisateur avant de coder)**

1. Un bouton « + » active le mode Somme.
2. En mode Somme, toucher une cage la sélectionne entièrement (toutes ses cases sont surlignées dans une couleur dédiée) ; la toucher à nouveau la désélectionne.
3. Un bandeau flottant affiche en permanence :
   - le total des sommes des cages sélectionnées (par exemple « Σ = 67 ») ;
   - le nombre de cages et de cases sélectionnées (par exemple « 4 cages, 11 cases ») ;
   - si les cases sélectionnées couvrent une ou plusieurs lignes, colonnes ou blocs complets, plus quelques cases : la différence avec 45 × (nombre d'unités), c'est-à-dire la somme des cases qui dépassent. Cet affichage est désactivable, car il donne une partie du raisonnement.
4. On peut aussi ajouter des cases isolées déjà remplies : leur chiffre est alors ajouté au total.
5. Toucher à nouveau « + » ou « Fermer » quitte le mode Somme et efface la sélection.
6. Depuis le bandeau, un bouton « Créer une cage virtuelle » transforme la sélection en cage virtuelle (voir E5).

## E5. Refonte des cages virtuelles

**Constat** : la version actuelle n'est pas utile en pratique.

**Hypothèse de refonte (à confirmer par l'utilisateur avant de coder)**

Une cage virtuelle sert à noter une déduction du type « ces cases font X au total », puis à exploiter cette information comme une vraie cage.

1. **Création rapide** : on sélectionne des cases, puis « Créer une cage virtuelle ». L'application propose la somme quand elle peut la calculer :
   - sélection = réunion de cages entières → somme de ces cages ;
   - sélection = une ligne, une colonne ou un bloc moins des cages entières → 45 moins ces cages ;
   - sinon, l'utilisateur saisit la somme lui-même.
2. **Affichage** : contour en pointillé d'une couleur distincte, avec la somme dans un petit cadre de la même couleur. Plusieurs cages virtuelles peuvent coexister, chacune avec sa couleur.
3. **Exploitation** :
   - si les cases de la cage virtuelle sont toutes dans une même ligne, colonne ou un même bloc (donc sans chiffre répété), la fenêtre « Combinaisons de la cage » fonctionne dessus, avec possibilité de barrer ;
   - sinon, elle affiche seulement la somme et le nombre de cases, et indique que des chiffres peuvent se répéter ;
   - le signalement des conflits vérifie aussi les cages virtuelles (somme dépassée, combinaison impossible).
4. **Gestion** : une liste des cages virtuelles permet de les masquer, les afficher ou les supprimer. Elles sont sauvegardées avec la partie et effacées par « Recommencer la grille ».
5. Une cage virtuelle fausse (somme incompatible avec la solution) n'est jamais signalée comme fausse : c'est une note de l'utilisateur.

---

## Ordre de développement proposé

1. E2 (recommencer) et E1 (erreurs), car ils sont liés : l'écran « Partie perdue » utilise « Recommencer ».
2. E3 (renommage et calculatrice).
3. E4 puis E5, après confirmation des hypothèses par l'utilisateur.

Chaque évolution : tests, mise à jour du cahier des charges, commit séparé, vérification de confidentialité avant envoi sur GitHub.
