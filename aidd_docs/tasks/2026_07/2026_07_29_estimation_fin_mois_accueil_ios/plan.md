---
objective: "L’accueil iOS affiche un solde de fin de mois fondé sur le budget restant et les écarts déjà connus, tandis que le graphique distingue le réalisé du reste du plan sans extrapolation journalière."
status: in-progress
---

# Plan: Estimation de fin de mois sur l’accueil iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Remplacer la projection au rythme quotidien par une estimation issue des enveloppes du budget et des opérations connues, puis simplifier le hero autour de cette seule réponse. |
| **Source** | Échange utilisateur du 29 juillet 2026 sur la compréhension de « Plan », « Écart estimé » et « À ce rythme ». |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Source financière et trajectoire | [`phase-1.md`](./phase-1.md) |
| 2   | Hiérarchie du hero et validation iOS | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Réutiliser `BudgetFormulas.calculateAllMetrics` comme source de l’estimation et du plan de référence, sans nouveau modèle financier ni changement de persistance. | `Metrics.remaining` réserve déjà les prévisions non réalisées et absorbe les dépassements ou opérations hors enveloppe connus ; le même calcul sans transactions fournit une référence comparable. |
| Retirer la projection journalière du parcours de l’accueil sans supprimer le type générique `BudgetFormulas.Projection` ni le composant historique non monté. | Le plus petit changement fiable corrige l’expérience active sans transformer cette itération en nettoyage de code mort. |
| Représenter le futur par une liaison vers le solde estimé de fin de mois, sans placer les prévisions sur des jours inventés. | `BudgetLine` ne porte aucune date d’échéance ; une chronologie détaillée du reste du plan serait une fausse précision. |
