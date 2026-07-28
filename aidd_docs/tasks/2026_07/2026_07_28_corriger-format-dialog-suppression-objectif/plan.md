---
objective: "Le détail d’un objectif d’épargne reste compact, explicite et cohérent avec la date de début du plan."
status: in-progress
---

# Plan: Corriger la lisibilité du détail d’un objectif d’épargne

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger le format de la dialog, expliciter les séries visuelles et faire commencer le plan mensuel à sa date de début. |
| **Source** | Retours et captures utilisateur du 28 juillet 2026 |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Rendre la dialog content-sized | [`phase-1.md`](./phase-1.md) |
| 2   | Clarifier la projection et la cible | [`phase-2.md`](./phase-2.md) |
| 3   | Aligner le plan mensuel sur sa date de début | [`phase-3.md`](./phase-3.md) |

## Diagnostic retenu

La timeline métier conserve volontairement le cycle courant avant une
`startDate` future afin d’ancrer la trajectoire et le montant de départ. Le
composant « Ton plan, mois par mois » affiche ensuite toutes ces périodes et
traduit chaque état `gap` par « Pas de budget ». Un budget peut donc exister
sans Prévision liée avant le début du plan et recevoir à tort ce libellé.

Le correctif reste local à la présentation : conserver la timeline complète
pour la trajectoire et le simulateur, mais masquer dans la liste les périodes
où `isContributionEligible === false`.

## Resources

| Source | Verified |
| ------ | -------- |
| https://next.material.angular.dev/docs-content/api-docs/material-dialog | `height` fixe la hauteur de la dialog, tandis que `maxHeight` la plafonne et `MatDialogContent` fournit le conteneur scrollable. |
