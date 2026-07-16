---
objective: "Les deux findings confirmés de la re-review PUL-285 sont fermés : les erreurs generation-stop sont localisées côté web et le GET future-lines ne lit ni ne déchiffre de transactions inutiles."
status: in-progress
---

# Plan: Corriger les findings de re-review PUL-285

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Fermer le warning webapp et le minor backend sans modifier le contrat PUL-285 déjà validé. |
| **Source** | Message utilisateur et `aidd_docs/tasks/2026_07/2026_07_16_pul_285_auto_savings/review.md` |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Webapp — localiser les erreurs d'arrêt de génération | [`phase-1.md`](./phase-1.md) |
| 2   | Backend — alléger la lecture des prévisions futures | [`phase-2.md`](./phase-2.md) |
