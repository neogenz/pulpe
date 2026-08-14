---
objective: "Le seed du mode démo expose les capacités livrées que le prospect ne peut pas voir aujourd'hui : consommation d'enveloppe, pointage, objectifs d'épargne, lissage."
status: pending
---

# Plan: Couverture du seed démo

## Overview

| Field      | Value                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Combler les lacunes du seed démo pour qu'un prospect voie une image complète et cohérente du produit                |
| **Source** | Demande utilisateur (texte) : « comble les lacunes de seed pour que les clients qui testent le mode démo aient une bonne vision claire et cohérente des possibilités » |

Le seed actuel écrit 7 tables (`template`, `template_line`, `monthly_budget`, `budget_line`, `transaction`, `tag`, `transaction_tag`). Trois capacités livrées n'y apparaissent jamais :

| Capacité                        | État dans le seed                                                | Ce que le prospect voit                             |
| ------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Consommation d'enveloppe        | `transaction.budget_line_id` toujours `null`                      | Chaque prévision affiche 0 consommé                  |
| Pointage (« Pointé / À pointer ») | `checked_at` toujours `null` sur lignes **et** transactions       | Aucun mois passé n'est réconcilié                    |
| Objectifs d'épargne             | table `savings_goal` jamais écrite, `savings_goal_id` toujours `null` | L'entrée « Objectifs » de la nav mène à un empty state |
| Lissage (PUL-17)                | `spread_group_id` jamais écrit                                    | Fonctionnalité invisible                             |

Les deux premières lignes sont un préalable technique aux objectifs : `computeSavingsGoalProgress` calcule `confirmed` à partir de l'enveloppe **checked-only** (`shared/src/calculators/savings-goal-progress.ts:285`). Un objectif seedé dont les lignes liées ne sont jamais pointées afficherait 0 %.

## Phases

| #   | Phase                              | File                         |
| --- | ---------------------------------- | ---------------------------- |
| 1   | Réel rattaché et pointé            | [`phase-1.md`](./phase-1.md) |
| 2   | Objectifs d'épargne                | [`phase-2.md`](./phase-2.md) |
| 3   | Lissage d'une dépense              | [`phase-3.md`](./phase-3.md) |

Ordre imposé par la dépendance : la progression d'un objectif (phase 2) n'est non nulle que si les lignes liées sont pointées (phase 1).

## Resources

| Source                              | Verified                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `docs/SAVINGS.md`                   | Un objectif daté impose une échéance à chaque gap provisionnable ; `initialAmount` seede le cumul confirmé |
| `docs/SPREAD.md`                    | Le lissage matérialise N lignes `one_off` partageant un `spread_group_id`                     |
| `docs/ENCRYPTION.md`                | `target_amount` et `initial_amount` sont des colonnes `text` porteuses de chiffré AES-256-GCM |

## Decisions

| Decision                                                                     | Why                                                                                                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `insertBudgetLines` renvoie les lignes insérées au lieu de `void`             | Rattacher une transaction à sa prévision et lier une ligne à un objectif exigent les ids générés ; aucune autre voie ne les expose au use case |
| Le seed écrit `savings_goal_id` en direct, sans passer par le use case métier | Le seed est déjà un écrivain de bas niveau assumé (il insère templates et budgets sans leurs use cases) ; réutiliser la couche métier imposerait un contexte de requête que le flux démo n'a pas |
