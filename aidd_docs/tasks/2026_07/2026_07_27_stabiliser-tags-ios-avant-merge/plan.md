---
objective: "La PR PUL-294 conserve un catalogue de tags unique et résout les tags après chaque évolution des données, avec un sélecteur conforme aux règles tactiles, visuelles et VoiceOver d’iOS."
status: in-progress
---

# Plan: Stabiliser les tags iOS avant merge

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger les findings de revue avec le minimum de logique et sans modifier les contrats API |
| **Source** | [`review.md`](../2026_07_26_ajouter-consulter-tags-ios/review.md) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Rendre le catalogue idempotent et réactif | [`phase-1.md`](./phase-1.md) |
| 2   | Conformer le sélecteur et l’affichage | [`phase-2.md`](./phase-2.md) |
