---
objective: "Rendre mesurable le geste dont dépend toute la thèse rétention — le pointage — qui n'émet rien aujourd'hui, sur aucune des deux plateformes."
status: pending
---

# Plan: Mesure du geste d'habitude

## Overview

| Field      | Value                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Trois questions de rétention deviennent répondables depuis PostHog, sans SQL ad hoc et sans inférence                       |
| **Source** | Inventaire PostHog 30 j du 2026-08-05, croisé avec les sites de mutation des deux plateformes                              |

## Le constat

Le diagnostic rétention conclut que « le comportement récurrent (pointer les transactions) ne s'adopte jamais ». Cette phrase n'a jamais été mesurée. Elle est inférée de `transaction_created`, qui compte un **autre geste** : `shared/schemas.ts:2074` énonce que pointer une prévision est une contribution *sans* transaction. Les deux actions sont distinctes dans le domaine, et une seule est instrumentée.

Le pointage est déclenché depuis huit endroits du code. Aucun n'émet quoi que ce soit.

## Les trois questions

| #   | Question                                                             | Mesure                                                            | Ce qui manque                          |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| Q1  | Le geste d'habitude s'installe-t-il ?                                | Part des utilisateurs activés qui pointent au moins une fois       | `check_toggled`                        |
| Q2  | Reviennent-ils au mois suivant ?                                     | Rétention mensuelle, ancrée sur le geste et non sur l'ouverture     | `budget_created` côté web              |
| Q3  | Combien de temps tiennent-ils avant de décrocher ?                   | Délai `first_budget_created` → premier `check_toggled`, puis dernier | rien de plus                          |

Tout événement qui ne sert aucune de ces trois lignes est hors périmètre. C'est la règle qui empêche ce plan de devenir un catalogue.

## Phases

| #   | Phase                            | File                         |
| --- | -------------------------------- | ---------------------------- |
| 1   | Instrumenter le geste et le cycle | [`phase-1.md`](./phase-1.md) |
| 2   | Construire les trois mesures     | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                    | Verified                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/schemas.ts:2074`                                                  | « Pointer la prévision (`checkedAt`) est une contribution SANS transaction. » Le pointage et la création de transaction sont deux gestes distincts ; `transaction_created` ne mesure pas le premier.        |
| 8 sites de pointage, 2 plateformes                                        | iOS `CurrentMonthStore.swift:620,667` et `BudgetDetailsCoordinator.swift:267,301,339` ; web `dashboard-store.ts:354` et `budget-details-store.ts:1205,1263`. Zéro capture analytics sur les huit.            |
| 4 points de passage communs                                               | Les huit sites convergent sur `BudgetLineService.swift:106`, `TransactionService.swift:73`, `budget-api.ts:349`, `transaction-api.ts:65`.                                                                    |
| Inventaire PostHog 30 j, projet 87621                                     | 46 couples événement × plateforme. Tout le post-activation tient en quatre noms : `app_opened` et `tab_switched` (iOS seuls), `transaction_created` (75 iOS / 4 web), `budget_created` (4 iOS / 0 web).      |
| `template-store.ts:166` vs `AnalyticsEvent.budgetCreated`                 | Le 0 web de `budget_created` n'est pas un usage faible : **le web ne l'émet pas**. La création du budget mensuel y passe sans trace, alors que c'est l'acte qui ouvre un nouveau cycle.                       |
| `$pageview` web, 30 j                                                     | 619 vues, 155 personnes, 31 jours actifs. Le retour sur le web est déjà mesurable — il ne porte simplement pas le même nom que l'`app_opened` iOS.                                                          |
| Diagnostic rétention du 2026-07 (mémoire projet)                          | Marche bloquante mesurée à l'époque : `first_budget_created` 20 → retour 3 (15%) → `transaction_created` 1 (5%). Le maillon « a-t-il pointé » n'apparaît nulle part dans cette chaîne, faute d'événement.    |

## Decisions

| Decision                                                                        | Why                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L'événement part de la couche service, pas des huit appelants                     | Les huit sites traversent quatre fonctions. Instrumenter les appelants, c'est huit diffs et un oubli garanti au prochain écran qui pointe. Le service est le seul endroit où tout le trafic passe.          |
| Un seul `check_toggled`, avec `entity` et `checked` en propriétés                 | Quatre événements — ligne cochée, ligne décochée, transaction cochée, décochée — rendraient toute mesure du geste dépendante d'une union. Une propriété distingue les variantes, jamais un nom par variante. |
| Le retour se mesure par une Action, pas par un `app_opened` web                   | `$pageview` couvre déjà le web sur 31 jours actifs. Ajouter un `app_opened` web dupliquerait un signal auto-capté pour le seul confort d'un nom commun.                                                     |
| Les objectifs d'épargne restent hors périmètre                                    | `SavingsGoalService.create` et `savings-goal-api.ts:111` n'émettent rien non plus, mais leur absence ne bloque aucune des trois questions. À instrumenter le jour où une question les concerne.             |
| Aucune propriété ne porte de montant                                              | Un pointage a un montant, et c'est précisément ce qui ne doit jamais partir. Le geste se compte, il ne se chiffre pas.                                                                                    |
