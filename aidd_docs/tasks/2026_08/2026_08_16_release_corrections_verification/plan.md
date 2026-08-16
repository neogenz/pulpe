---
objective: "Les défauts pré-release confirmés sont corrigés avec des tests de non-régression, et l’API refuse les mises à jour de paramètres qu’elle ne peut pas appliquer atomiquement."
status: in-progress
---

# Plan: Corrections pré-release vérifiées

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger cinq défauts reproductibles de localisation, concurrence et retry, puis fermer le risque conditionnel de mise à jour backend partielle. |
| **Source** | Texte utilisateur du 2026-08-16 listant six corrections recommandées avant release. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Localisation web et landing | [`phase-1.md`](./phase-1.md) |
| 2   | Retry sûr après confirmation de la clé de récupération | [`phase-2.md`](./phase-2.md) |
| 3   | Dernier choix de langue gagnant sur iOS | [`phase-3.md`](./phase-3.md) |
| 4   | Contrat atomique des mises à jour de paramètres | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://nextjs.org/docs/app/api-reference/functions/generate-metadata#merging | Next.js fusionne les métadonnées par segment et laisse `support`/`changelog` hériter des champs sociaux de la homepage tant que la page ne définit pas ses propres objets `openGraph` et `twitter`. |
| https://developer.apple.com/documentation/swift/task/cancel() | L’annulation Swift est coopérative et ne suffit pas à empêcher une tâche déjà lancée d’appliquer ultérieurement un succès ou un rollback obsolète. |

## Decisions

| Decision | Why |
| -------- | --- |
| Refuser un payload qui mélange `locale` et préférences historiques au lieu de migrer toutes les préférences avant la release. | Les clients web et iOS envoient déjà ces familles séparément. Une migration de `auth.user_metadata` vers PostgreSQL serait la seule vraie transaction multi-champs, mais son coût et son risque dépassent le défaut actuellement atteignable. |
| Rendre `UserSettingsStore` responsable de la règle « dernier appel gagnant ». | Le store est le point partagé par tous les appelants ; se fier uniquement à `LanguageSettingView.saveTask.cancel()` est incorrect puisque l’annulation Swift est coopérative. |
