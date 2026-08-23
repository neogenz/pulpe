---
objective: "Le graphe de la Home est un burn-down du disponible : le plan sur tout le mois, le réel jusqu'à aujourd'hui, l'estimé jusqu'à la fin, un seul chiffre au bout."
status: in-progress
---

# Plan: Home burn-down chart

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Remplacer la courbe « estimation de fin de mois recalculée chaque jour » par un burn-down de l'argent disponible, lisible sans légende |
| **Source** | Maxime, 2026-08-23 : « la planification prévue de mon mois, ajustée du réel au jour J, puis ce qui reste à venir avec la tendance » ; décision : pas de split en deux courbes après J, la ligne réel part du disponible prévu |

## Modèle

```txt
 y = argent disponible
 ┃
 ┃ ● disponible prévu (revenus prévus + report)
 ┃  ╲ ╌ ╌ ╌ plan : droite vers le reste prévu en fin de mois
 ┃   ╲━━━━╲          réel : disponible − sorties pointées, jusqu'à J
 ┃         ╲━━━━●╌╌╌╌╌╌╌╌  estimé : de J vers « Si tu continues : X » (tendance)
 ┃              Aujourd'hui                               ╌ ╌ ╌ ● Prévu
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1er août                                                     31 août
```

- **Plan** : droite de `plannedAvailable` (jour 0) à `plannedBalance` (dernier jour). Les prévisions n'ont pas d'échéance, une droite est le seul rythme honnête.
- **Réel** : un point par jour de 0 à J ; `plannedAvailable − sorties réalisées connues ce jour-là`. « Réalisé » = pointé : ligne pointée via `checkedAt`, mouvement pointé via `transactionDate` (même filtre que la série actuelle). Une prévision non pointée ne bouge pas la ligne.
- **Estimé** : deux points, (J, réel(J)) → (fin, `trendBalance`). La tendance est intégrée, il n'y a pas de seconde courbe.
- L'écart plan/estimé en fin de mois est `Imprévus` ; `drift`, `driftDate`, le verdict et la tendance restent calculés sur `landing` (inchangé).

Hors plan : miroir TS. La trajectoire actuelle n'a pas de miroir dans `shared/` (précédent : elle se reflète dans `backend-nest/.../drift-history.ts` pour la tendance seulement). La série réel est une projection d'affichage iOS, même statut.

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | Série réel et disponible prévu dans `BalanceTrajectory` | [`phase-1.md`](./phase-1.md) |
| 2   | Le graphe dessine plan, réel, estimé ; squelette et a11y suivent | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | ----------------- |
| `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift` | `landing`, `trendBalance`, période, `today/totalDays` |
| `ios/Pulpe/Domain/Formulas/BudgetFormulas+Metrics.swift` | `calculateRealizedExpenses` (pointé seul), `available = totalIncome + rollover` |
| `aidd_docs/tasks/2026_08/2026_08_23_home-hero-clarity/plan.md` | phase 4 remplacée par ce plan ; phases 5-8 inchangées |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Une seule courbe après J | Deux lignes divergentes demandent de comprendre « prévu restant » vs « tendance », chiffre déjà porté par Imprévus |
| La ligne réel part du disponible prévu | Stable dès le 1er ; partir des revenus pointés ferait démarrer le mois à 0 |
| Sortie réalisée datée par `checkedAt` (ligne) et `transactionDate` (mouvement) | « Pointé » est le seul signal de réalisé ; la date du mouvement est celle où il est passé |
