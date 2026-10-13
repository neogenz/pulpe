---
objective: "Un échec de mutation ne remplace plus jamais le budget par la carte d'erreur de chargement : il se dit là où le geste a eu lieu, et aucun toast de succès ne le contredit."
status: implemented
---

# Plan: Le modèle d'erreur du budget sépare chargement et mutation

## Overview

| Field      | Value                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | `error` ne signale plus que l'échec de chargement de la ressource ; chaque mutation rend son motif par sa valeur de retour et son appelant l'affiche à l'endroit du geste.   |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_02_savings-goal-horizon-500/review.md`, finding 1 — le bug corrigé pour la création d'épargne reste ouvert pour quatorze autres mutations.  |

## Phases

| #   | Phase                                          | File                         |
| --- | ---------------------------------------------- | ---------------------------- |
| 1   | La carte d'erreur redevient celle du chargement | [`phase-1.md`](./phase-1.md) |
| 2   | Chaque geste refusé se dit sur place            | [`phase-2.md`](./phase-2.md) |
| 3   | La règle cesse d'enseigner le défaut            | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                       | Verified                                                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ngx-ziflux`, JSDoc de `mutate()` et `fesm2022/ngx-ziflux.mjs` | `mutate()` ne rejette jamais et rend `undefined` en cas d'erreur — donc `undefined` est aussi la valeur de succès d'une mutation typée `void`, et ne peut pas servir de test d'échec |

## Decisions

| Decision                                                                                                              | Why                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `error` ne remonte que `#budgetDetailsResource.error()`. Le canal de mutation disparaît du signal de page.             | La page rend une carte qui remplace tout le budget. Un refus ponctuel n'est pas une indisponibilité du budget, et la carte jetait de toute façon le message qu'on venait de calculer.                             |
| Chaque mutation rend son motif par sa valeur de retour, `null` valant succès.                                          | C'est le contrat que trois mutations appliquent déjà dans le store, avec sa justification écrite. On généralise un motif éprouvé au lieu d'en inventer un.                                                        |
| Le succès se lit sur le motif rendu, jamais sur `response !== undefined`.                                              | Deux mutations sont typées `void` : leur succès résout `undefined`. Le test maison les déclarerait en échec à chaque réussite. Remettre le motif à `null` avant l'appel puis le relire est vrai dans les deux cas. |
