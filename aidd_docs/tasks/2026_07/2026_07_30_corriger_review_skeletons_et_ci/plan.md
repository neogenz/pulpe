---
objective: "Les trois findings de la review iOS sont fermés et le check GitHub « Quality Checks (quality) » passe sur le nouveau SHA sans modification CI spéculative."
status: in-progress
---

# Plan: Corriger la review des skeletons iOS et reverdir la CI

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Valider le skeleton Accueil dans son vrai conteneur, remettre ses dimensions au niveau du design system et faire rejouer la CI sur le correctif. |
| **Source** | Review locale du 2026-07-29 et job GitHub Actions `90662982504` sur le SHA distant `1b4276191`. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Fermer les findings iOS et valider le nouveau SHA | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/neogenz/pulpe/pull/560 | La PR distante pointe encore sur `1b4276191`, tandis que le correctif local `5c6d9f2f6` est en avance d’un commit. |
| https://github.com/neogenz/pulpe/actions/runs/30477263708/job/90662982504 | Le job `Quality Checks (quality)` a échoué sur l’ancien SHA ; ses annotations publiques ne donnent qu’un code de sortie générique et des warnings backend non bloquants. |
