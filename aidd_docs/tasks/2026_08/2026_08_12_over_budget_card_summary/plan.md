---
objective: "Les résumés compacts Web et iOS remplacent le pourcentage supérieur à 100 % par le montant exact du dépassement, sans modifier les calculs ni les écrans de détail."
status: implemented
---

# Plan: Clarifier le dépassement des prévisions

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Afficher une information immédiatement actionnable lorsqu'une dépense dépasse sa prévision. |
| **Source** | Demande utilisateur du 12 août 2026, issue du retour UX sur « 879 % utilisé ». |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Aligner les résumés Web et iOS | [`phase-1.md`](./phase-1.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Ne pas modifier les formules de consommation | La demande porte uniquement sur la présentation d'une valeur déjà calculée et disponible sur les deux plateformes. |
