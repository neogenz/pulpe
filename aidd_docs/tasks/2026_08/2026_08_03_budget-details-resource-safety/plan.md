---
objective: "Le chargement des détails de budget annule ce qu'il abandonne, et aucune mutation ne peut écrire `undefined` dans le cache."
status: implemented
---

# Plan: Sûreté de la resource BudgetDetails

## Overview

| Field      | Value                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **Goal**   | Aligner `#budgetDetailsResource` et `#updateDetails` sur le contrat ziflux déjà respecté par le reste du fichier |
| **Source** | [`../2026_08_03_audit/code-quality.md`](../2026_08_03_audit/code-quality.md) — 2 findings 🟡, effort S chacun |

## Phases

| #   | Phase                                            | File                         |
| --- | ------------------------------------------------ | ---------------------------- |
| 1   | Annuler les chargements de détail abandonnés     | [`phase-1.md`](./phase-1.md) |
| 2   | Ne plus écrire de trou dans le cache             | [`phase-2.md`](./phase-2.md) |
