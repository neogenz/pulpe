# PUL-376: Suivre mes comptes depuis mon budget

**State:** Backlog | **Priority:** --- | **Assignee:** Unassigned

## En tant que Utilisateur, je veux que mes comptes de « Mon patrimoine » suivent ce que je pointe dans mon budget afin de voir où j'en suis sur chacun sans ressaisir sa valeur

### Contexte

Demande d'un utilisateur : rattacher une dépense (prévue, imprévue ou venue du modèle) à un compte du patrimoine, et choisir un compte par défaut. Il a beaucoup de comptes, mais un seul pour ce besoin : son compte courant, par lequel passe tout son budget. Aujourd'hui ce compte reste figé sur sa dernière saisie.

Le modèle retenu au cadrage :

1. Un réglage « Compte par défaut », parmi mes comptes et mes dettes de « Mon patrimoine ». Il ne fait que préremplir les nouveaux mouvements : il ne change rien à ce qui est déjà saisi
2. Un champ « Compte » sur chaque mouvement : aucun, le compte par défaut prérempli, ou un autre choisi à la main. Il propose aussi mes dettes : une dépense payée avec une carte de crédit monte ce que je dois
3. Pointer un mouvement qui a un compte change la valeur de ce compte tout de suite, sans « Appliquer »
4. Depuis un compte, un écran de détail montre tout son historique depuis sa création : mes saisies et les mouvements pointés
5. Je peux toujours écraser la valeur à la main

Cadrage complet : `aidd_docs/tasks/2026_11/2026_11_12_suivi-comptes-depuis-budget/brainstorm.md`.

### Stories

Dans l'ordre de livraison, chacune se livre seule :

1. Faire suivre la valeur d'un élément par ce que je pointe (fin de « Appliquer / Écarter »)
2. Rattacher un mouvement à un compte, avec un compte par défaut
3. Ouvrir le détail d'un élément et revoir tout son historique
4. Voir la projection de fin de mois d'un compte

### Règles communes aux stories

* Valeur d'un élément = ma dernière saisie + ce qui a bougé depuis cette saisie. Pour une prévision qui a des mouvements réels, ce qui a bougé est ce qu'elle compte aujourd'hui moins ce qu'elle comptait au moment de la saisie
* Une prévision compte comme dans le solde pointé du budget : pointée, pour le plus grand de son montant et de ses mouvements réels pointés ; non pointée, pour ses mouvements réels pointés. Un Revenu prévu suit la même règle, alors que le budget additionne aujourd'hui un Revenu prévu pointé et ses mouvements réels pointés
* Une dette ne descend jamais sous zéro : les mouvements sont pris dans l'ordre où je les ai pointés, et chacun est borné par ce qui reste dû à ce moment. Leasing à 200 : un remboursement de 300 retient −200 (il vaut 0), un achat de 100 pointé ensuite le porte à 100
* Les apps déjà installées (iOS 1.14.x, Android) qui affichent « Mon patrimoine » derrière le flag continuent de fonctionner sans mise à jour

### Hors périmètre

* Virements entre mes comptes
* Régler une carte de crédit depuis un compte autrement que par une saisie
* Écrans Android
* Projection sur plusieurs mois

## Sub-issues

- **PUL-380**: Voir la projection de fin de mois d'un compte _[Backlog]_
- **PUL-379**: Ouvrir le détail d'un élément et revoir tout son historique _[Backlog]_
- **PUL-378**: Rattacher un mouvement à un compte, avec un compte par défaut _[Backlog]_
- **PUL-377**: Faire suivre la valeur d'un élément par ce que je pointe _[Backlog]_

