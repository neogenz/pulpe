---
objective: "Le chart de l’accueil iOS conserve son esthétique organique tout en représentant clairement la consommation du budget, sa destination de fin de période et les périodes fondées sur le jour de paie sans fausse cadence quotidienne."
status: implemented
---

# Plan: Clarifier le chart budgétaire de l’accueil iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Conserver le grand graphique arrondi du hero en lui donnant un modèle mental honnête, une période correcte et des repères immédiatement compréhensibles. |
| **Source** | Clarification utilisateur du 29 juillet 2026 et `aidd_docs/tasks/2026_07/2026_07_29_estimation_fin_mois_accueil_ios/review.md`. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Trajectoire budgétaire et périodes réelles | [`phase-1.md`](./phase-1.md) |
| 2   | Chart organique et lecture immédiate | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Le tracé plein représente un burn-down du budget de la période : montant disponible complet moins sorties pointées cumulées, et non le solde d’un compte bancaire. | Cette grandeur correspond au fonctionnement actuel, explique la descente naturelle du chart et évite de promettre une synchronisation bancaire inexistante. |
| Le trait pointillé reste un connecteur visuel entre aujourd’hui et l’estimation finale, avec seulement deux points et une destination explicitement nommée. | L’esthétique du modèle est conservée sans créer de prévisions intermédiaires ni prétendre connaître le calendrier des prévisions. |
| La fenêtre temporelle vient exclusivement de `BudgetPeriodCalculator.periodDates`. | Le chart doit suivre le même mois budgétaire que le reste de l’app, y compris lorsque le jour de paie fait traverser deux mois civils. |
| La propriété hybride `CurrentMonthStore.projection` est supprimée, tandis que le type générique `BudgetFormulas.Projection` reste intact. | Aucun appelant produit n’utilise la propriété du store ; la conserver mélangerait un taux journalier historique avec une estimation issue des enveloppes. |
