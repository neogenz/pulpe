---
objective: "Un objectif d'épargne est une unité : son horizon détermine le contenant de ses prévisions, et son nom vit à un seul endroit."
status: pending
---

# Plan: l'objectif d'épargne comme unité

## Overview

| Field      | Value                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Un objectif daté se matérialise en prévisions bornées, pas en récurrence perpétuelle, et son nom se lit par la relation au lieu d'être recopié.           |
| **Source** | Décisions produit du 25.07.2026, sur la base de [PUL-312](https://linear.app/pulpe/issue/PUL-312) et de la vérification adversariale du plan qui l'a précédé. |

## Diagnostic

Deux défauts de modèle, pas deux bugs.

**1. Le contenant contredit l'intention.** Un objectif daté est un engagement **borné** — 3'700 sur
4 mois. L'auto-décomposition le pose en `template_line` récurrente, c'est-à-dire dans le contenant
qui signifie « tous les mois, indéfiniment ». Conséquences observées : le Mois Type porte
« Canapé, Récurrent » à vie, son solde net est faux dès le mois suivant l'échéance, et chaque
budget généré hérite de la ligne. PUL-311 a borné les écritures ; il ne pouvait rien contre la
ligne du modèle elle-même.

**2. Le nom est une copie, pas une référence.** `CreateSavingsGoalUseCase` écrit
`name: goal.name` sur la `template_line`, qui le recopie ensuite sur chaque `budget_line`.
Renommer l'objectif ne renomme rien : la relation existe (`savings_goal_id`) mais n'est pas lue.

À cela s'ajoute une **régression livrée le 24.07** : `AuthGuard` appelle déjà `auth.getUser()` par
requête et jette `payDayOfMonth`, que PUL-311 re-demande ensuite à chaque matérialisation — jusqu'à
36 allers-retours GoTrue redondants sur une génération de 36 mois, 12 sur le parcours d'onboarding.

## Phases

| #   | Phase                                                            | File                         | État                    |
| --- | ---------------------------------------------------------------- | ---------------------------- | ----------------------- |
| 1   | Le jour de paie voyage avec l'utilisateur authentifié            | [`phase-1.md`](./phase-1.md) | livrée — PR #546        |
| 2   | Un objectif daté se décompose en prévisions bornées              | [`phase-2.md`](./phase-2.md) | livrée — PR #547        |
| 3   | Rendre le lien vers l'objectif visible là où il manque           | [`phase-3.md`](./phase-3.md) | à faire                 |
| 4   | Borner le rattachement manuel depuis le Mois Type                | [`phase-4.md`](./phase-4.md) | à faire                 |

Chaque phase ship et se vérifie seule. Frontières de PR naturelles : la 1 part seule (correctif de
régression, deux lignes) ; les 2 et 3 vont ensemble (elles changent le même chemin d'écriture) ;
la 4 est indépendante.

## Resources

| Source                                                     | Verified                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vérification adversariale du plan précédent (25.07.2026)   | Deux bloquants et une sur-ingénierie identifiés avant écriture : divergence update/tags, perte de borne sur objectif non-`ACTIVE`, module feuille injustifié.    |
| `docs/SAVINGS.md` §3.2                                     | Le lien doit survivre à la régénération mensuelle — vrai d'une épargne récurrente, sans objet pour des `one_off` qui ne sont jamais régénérés.                  |
| `docs/SAVINGS.md` §3.5 et §4.2                             | La mensualité couvre `monthsRemaining` périodes, échéance et mois courant inclus — exactement le domaine d'un lissage.                                          |
| `docs/SPREAD.md` (PUL-17)                                  | Le lissage sait déjà : mode `total` divisé au centime, provisioning des budgets absents, idempotence par `spreadGroupId`.                                        |
| `shared/src/calculators/savings-goal-progress.ts:222`      | La progression ne filtre que `kind === 'saving'` et `isRollover !== true` — **aucun filtre de récurrence** : une ligne `one_off` liée compte comme une récurrente. |
| `shared/schemas.ts` `budgetLineSpreadCreateSchema`         | Le contrat HTTP du lissage ne porte pas `savingsGoalId` — passer par un port serveur, ne pas modifier l'API publique.                                            |

## Decisions

| Decision                                                                                            | Why                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objectif **avec** échéance → lissage de `one_off` liées. Objectif **sans** échéance → `template_line` récurrente. | Le contenant épouse l'intention. Un engagement borné dans un contenant non borné est la cause racine de PUL-311 et PUL-312 ; l'inverse — un pot perpétuel en `one_off` — obligerait à en recréer sans fin.                                    |
| Une prévision garde **toujours son propre nom**. Ce qui se lit par la relation, c'est le **lien**.   | Décision du 25.07 : on doit pouvoir rattacher n'importe quelle prévision à un objectif sans qu'elle perde son libellé. L'unité de l'objectif ne porte donc pas sur le nom des lignes, mais sur le libellé du lien.                                        |
| **Rien à construire pour ça** — c'est déjà le cas.                                                  | Vérifié le 25.07 sur les deux clients : le nom de l'objectif est partout résolu par identifiant depuis la liste des objectifs, jamais lu sur la prévision, et un renommage invalide déjà le cache web et patche le store iOS. Aucune jointure, aucun changement de contrat. La phase 3 ne garde que le manque révélé par ce même balayage : le lien n'est visible nulle part hors du détail d'un budget. |
| Le nom de l'objectif ne sert plus que de **valeur initiale** aux prévisions qu'il matérialise.       | Un libellé de départ utile, ensuite modifiable comme n'importe quelle prévision. Plus rien ne dépend de sa fraîcheur.                                                                                                                                     |
| Aucun nettoyage des données existantes.                                                             | Décision explicite du 25.07 : l'utilisateur a déjà géré, et il est seul sur la fonctionnalité. Pas de migration de données, pas de rattrapage.                                                                                                            |
| `payDayOfMonth` rejoint `AuthenticatedUser`, lu par les guards.                                     | La donnée est déjà en main à chaque requête. Toute lecture ultérieure est un appel HTTP redondant. Corrige une régression livrée et supprime le coût de tout ce qui suit, au lieu de le déplacer.                                                          |
| Le port d'horizon vit dans `budget/`, pas dans un module dédié.                                     | `budget-template` dépend déjà de `budget` : zéro arête nouvelle, deux fichiers au lieu de cinq plus un module. Le module feuille du plan précédent était de la sur-ingénierie.                                                                             |
| La lecture d'horizon **ne filtre pas** sur le statut.                                               | L'échéance d'un objectif en pause reste son échéance. Filtrer `ACTIVE` fait résoudre un objectif non actif en « inconnu », donc en « rien à borner » — perte de borne silencieuse. Le filtre statut appartient à l'appelant qui en a besoin, pas à la règle. |
| **Créer un objectif ne matérialise aucun budget** (25.07, en cours d'implémentation).               | Le lissage provisionne les mois absents ; appliqué jusqu'à l'échéance, un objectif à dix ans aurait créé 120 budgets dans un seul POST — lent, probablement en timeout, et la liste de budgets de l'utilisateur courrait soudain jusqu'en 2036. Seules les périodes déjà budgétées reçoivent leur prévision ; les autres restent des trous que « Ajuster mon plan » comble à la demande, un mois à la fois. |
