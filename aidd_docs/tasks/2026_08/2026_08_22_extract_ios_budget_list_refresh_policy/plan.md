---
objective: "La politique de rafraîchissement de la liste des budgets et son test unitaire vivent dans la feature Budgets sans changer le comportement de navigation."
status: implemented
---

# Plan: Extraire la politique de rafraîchissement de la liste iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Rendre la politique de navigation découvrable, garder `Domain/Store` exempt de logique UI et aligner son test avec la feature. |
| **Source** | Commentaire de diff du 22 août 2026 sur `BudgetListRefreshPolicy` et review AIDD associée. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Extraire la politique et réaligner sa couverture | [`phase-1.md`](./phase-1.md) |
