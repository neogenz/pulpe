---
objective: "Un utilisateur peut taguer toutes ses dépenses et comparer le prévu au réel d'un tag sur 3, 6, 12 ou 24 périodes budgétaires, sans fuite de session, perte silencieuse ni régression des objectifs d'épargne."
status: implemented
---

# Plan: Compléter PUL-18 et fermer les écarts de la PR #502

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Livrer l'historique multi-mois par tag et corriger les deux blocages critiques ainsi que les huit avertissements de la revue. |
| **Source** | Demande utilisateur + Linear `PUL-18` + `aidd_docs/tasks/2026_07/2026_07_10_pul18-tag-review-fixes/review.md` |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Isolation de session et validation aux frontières | [`phase-1.md`](./phase-1.md) |
| 2 | Contrat et agrégation backend de l'historique | [`phase-2.md`](./phase-2.md) |
| 3 | Dialog web d'évolution par tag | [`phase-3.md`](./phase-3.md) |
| 4 | Écritures complètes et atomiques | [`phase-4.md`](./phase-4.md) |
| 5 | Recherche, filtres et santé des repositories | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/neogenz/pulpe/pull/502 | Périmètre livré, migrations tags, formulaires annoncés et état CI de la branche. |

## Decisions

| Decision | Why |
| -------- | --- |
| L'historique est un dialog ouvert depuis le détail d'un budget, pas une nouvelle route. | Il conserve le contexte mensuel, reste accessible sur mobile et évite une navigation dédiée pour une lecture secondaire. |
| `GET /tags/:id/history` agrège côté backend après déchiffrement, sur 3/6/12/24 périodes au maximum. | Les montants AES-256-GCM ne peuvent pas être sommés en SQL; la borne de 24 mois limite les lignes déchiffrées et rejoint l'horizon d'historique existant. |
| Une série représente les dépenses directement taguées: Prévu = `budget_line kind=expense`, Réel = `transaction kind=expense`; aucun héritage implicite entre ligne et transaction. | Les deux junctions sont indépendantes aujourd'hui. L'héritage créerait des doubles comptes invisibles; les réels alloués deviennent explicitement taguables en phase 4. |
| Les mois sont les périodes `monthly_budget.month/year`, ancrées sur le budget consulté, avec des zéros pour les périodes sans données. | Le résultat reste payDay-aware et cohérent avec le reste du produit, y compris lorsqu'un budget passé est consulté. |
| Le dialog recharge son historique sans cache persistant. | Les mutations vivent dans les caches budget/transaction; éviter un cache tags séparé supprime une invalidation croisée fragile et garantit une lecture fraîche à chaque ouverture. |
| La création complète d'un template écrit les tags dans `create_template_with_lines` avec contrôle explicite de propriété. | L'RPC est `SECURITY DEFINER`: compter sur la RLS des junctions serait incorrect. Une validation dans l'RPC préserve l'atomicité, l'isolation tenant et `savings_goal_id`. |
| `DELETE /tags/:id` reste idempotent et retourne 200 si le tag est déjà absent ou masqué par RLS. | C'est le contrat déjà appliqué aux suppressions de tags, prévisions, transactions, objectifs d'épargne et modèles. Il évite aussi de révéler l'existence d'un tag étranger; le comportement devient explicite et couvert par un test. |
