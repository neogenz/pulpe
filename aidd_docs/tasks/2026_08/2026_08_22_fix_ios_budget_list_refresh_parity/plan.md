---
objective: "Au retour sur la liste iOS, chaque budget affiche le même solde cumulé que son détail après une mutation."
status: in-progress
---

# Plan: Rafraîchir les soldes de la liste des budgets iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Déclencher le rechargement intelligent de la liste lors du retour sur l'onglet Budgets ou depuis un détail. |
| **Source** | Signalement utilisateur et quatre captures du 22 août 2026 montrant septembre à −4’199.78 CHF dans la liste contre −2’096.80 CHF dans le détail, et octobre à −2’096.80 CHF contre +39.18 CHF. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Relier les retours de navigation au cache invalidé | [`phase-1.md`](./phase-1.md) |
| 2   | Réparer les retours tardifs et le quick-add après review | [`phase-2.md`](./phase-2.md) |
| 3   | Sécuriser reset et l'ajout hors budget après review | [`phase-3.md`](./phase-3.md) |
| 4   | Isoler les publications périmées et dédupliquer les ajouts | [`phase-4.md`](./phase-4.md) |
