---
objective: "Le seed local respecte l’échéance de chaque objectif d’épargne et permet au pipeline CI de démarrer Supabase puis d’exécuter ses contrôles."
status: in-progress
---

# Plan: Corriger le seed des objectifs d’épargne bornés

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Ne plus insérer de prévision seed liée à un objectif après sa période d’échéance. |
| **Source** | Job GitHub Actions `90068041104` de la PR #553 et diagnostic du seed Supabase. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Aligner les contributions seed sur l’horizon des objectifs | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/neogenz/pulpe/actions/runs/30293255699/job/90068041104 | Le démarrage Supabase applique toutes les migrations puis échoue trois fois pendant le seed avec `Savings goal line outside target horizon`. |

## Decisions

| Decision | Why |
| --- | --- |
| Corriger uniquement les données générées par le seed et conserver le trigger d’horizon inchangé. | Le trigger applique le contrat produit attendu ; le défaut vient du produit cartésien qui lie actuellement les douze budgets 2026 à chaque objectif, quelle que soit son échéance. |
