---
objective: "La valeur d'un élément de « Mon patrimoine » est sa dernière saisie plus ce qui a été pointé depuis, sans « Appliquer » ni « Écarter », sur le web, iOS et les apps installées."
status: in_progress
---

# Plan: PUL-377 — la valeur d'un élément suit ce que je pointe

Source: Linear PUL-377 ([contract.md](./contract.md)), epic PUL-376 ([../epic.md](../epic.md))

## Phases

| #   | Phase                                         | File                         | Depends on |
| --- | --------------------------------------------- | ---------------------------- | ---------- |
| 1   | Serveur : valeur à jour, contrat, mise en service | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Web : ligne, feuille « Modifier », fin des propositions | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | iOS : ligne, feuille « Modifier », fin des propositions | [`phase-3.md`](./phase-3.md) | 1          |

## External sources

| URL  | What it settled |
| ---- | --------------- |
| none | none            |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | `GET /v1/assets` change le sens de `latestValue` (dernière saisie → valeur à jour) et ajoute `recordedValue`. Lu par le web, iOS 1.14.x (`Asset.swift`) et Android (`net-worth-api.ts`, schéma partagé `z.object`, extras ignorés) : additif, aucun client ne casse. | 1 |
| regression    | `POST /v1/assets/:id/dismiss-suggestion` n'écrit plus rien ; iOS 1.14.x et Android l'appellent encore (`AssetService`, `useDismissAssetSuggestion`). | 1 |
| regression    | Les totaux, le Sankey, les sous-totaux par type de dette et le marqueur « découvert » lisent désormais la valeur à jour (`convertedValue` vient de la valeur à jour). | 1, 2, 3 |
| architecture  | Le calcul reste dans `asset.formulas.ts` ; les clients n'additionnent rien de plus (le delta affiché en CA9 est `latestValue − recordedValue`, une soustraction d'affichage en centimes). | 1 |
| documentation | `docs/BUSINESS_RULES.md` § Patrimoine : les deux derniers points (proposition, Appliquer/Écarter) sont remplacés. | 1 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `.claude/rules/05-workflows-and-processes/api-contract-changes.md` | Champ de réponse ajouté, sens d'un champ changé, route gardée pour les apps installées. |
| `docs/DEPLOYMENT.md` (migrations expand/contract) | La migration de mise en service écrit des photos et crée un trigger. |
| `CLAUDE.md` → chiffrer les montants | Les photos copiées gardent le chiffré existant, aucun montant en clair n'est écrit. |

## Decisions

| Decision | Why |
| -------- | --- |
| `latestValue` garde son nom et porte la valeur à jour ; la dernière saisie passe dans `recordedValue`. | Les apps installées (iOS 1.14.x, Android) affichent `latestValue` : elles montrent la valeur à jour sans mise à jour (CA18). |
| CA17 : copie SQL de la dernière photo, datée de l'écartement, plus un trigger `AFTER UPDATE OF suggestion_dismissed_at` qui fait la même copie à chaque écartement écrit par l'ancien backend. | La note technique demande une conversion relancée après la bascule ; le trigger couvre la fenêtre entre la migration et la bascule sans étape manuelle en production. Voir [questions.md](./questions.md). |
| Une dette applique les mouvements dans l'ordre de `checked_at`, chacun borné par ce qui reste dû. | Règle de l'epic (leasing à 200, remboursement de 300, achat de 100). |
