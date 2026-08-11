---
objective: "Le contrat du feed What's New iOS est unique et cohérent : sous-ensemble curé (≤4 notes, mode `silent` légal), appliqué par le test de parité, par le validateur du skill et par la donnée embarquée."
status: in-progress
---

# Plan: Contrat What's New iOS — parité, curation, durcissement du skill

## Overview

| Field      | Value                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre légal (et vrai) le contrat « projection iOS curée » que le skill `update-changelog` décrit déjà     |
| **Source** | Audit de session du 2026-07-20 sur `.claude/skills/update-changelog` + `.claude/skills/asc-whats-new-writer` |

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Spec de parité → contrat sous-ensemble curé (bloquant)  | [`phase-1.md`](./phase-1.md) |
| 2   | Curer le feed iOS embarqué (contenu, 3 entrées)         | [`phase-2.md`](./phase-2.md) |
| 3   | Durcir le skill `update-changelog` (push, `skip`, replay) | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                    | Verified                                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `aidd_docs/tasks/2026_07/2026_07_16_release_review_fixes/phase-3.md:22-23` | Intention d'origine de la spec de parité : « reprendre leur sémantique » (celle de `validate-ios-release.ts` + `references/ios-release.md`) |
| `aidd_docs/tasks/2026_07/2026_07_16_release_review_fixes/phase-3.md:31`    | Critère d'acceptation « l'état actuel du repo passe vert » : c'est ce qui a gelé la donnée non curée                                   |

## Decisions

| Decision                                                                                                                                     | Why                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le contrat retenu est **sous-ensemble curé**, pas miroir verbatim. C'est la spec qui est corrigée, pas le skill                              | Le contrat curé est écrit 3× avant la spec (`SKILL.md:253-254`, `ios-release.md:16-17` et `:39`) et machine-enforced (`validate-ios-release.ts:167-171`). La spec devait le reprendre et ne l'a pas fait                          |
| Le cap 1–4 reste **hors** de la spec de parité, uniquement dans `validate-ios-release.ts:169`                                                | Le validateur ne juge que la version en cours de release ; mettre le cap dans la spec exigerait un backfill immédiat des 3 entrées legacy hors-cap et coupler une correction de contrat à une décision éditoriale                 |
| La curation de la phase 2 se fait **par suppression seule**, jamais par réécriture des titres/descriptions                                   | Le nouveau check de sous-ensemble exige que chaque note backend existe verbatim dans l'entrée landing. Réécrire côté backend ferait échouer la spec ; réécrire côté landing modifierait une page publique déjà publiée            |
| Ne pas corriger `whats-new-releases.ts` (toast web figé à `0.37.0` vs `0.37.1`)                                                              | Se répare seul au prochain bump. Le forcer maintenant rejouerait un toast pour une release déjà en ligne. Perte assumée : le fix « Report de dépense » de 0.37.1 n'aura pas été annoncé                                          |
| Ne pas câbler `asc-whats-new-writer` dans `update-changelog`                                                                                 | Le champ App Store se remplit à la soumission contre un `VERSION_ID` inexistant au moment du tag ; un dry-run montre que la commande viserait la 1.1.0 déjà en ligne. Le caller naturel serait `asc-release-flow`                |
