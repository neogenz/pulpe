---
objective: "Les versions iOS qui embarquent ce changement proposent une mise à jour App Store non bloquante quand elles sont sous latestVersion, sans modifier le gate dur fondé sur minVersion."
status: implemented
---

# Plan: proposer doucement les mises à jour iOS disponibles

## Overview

| Field      | Value                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Exploiter `latestVersion` pour suggérer une mise à jour iOS une seule fois par version cible, tout en gardant `minVersion` strictement bloquant. |
| **Source** | Texte fourni dans la tâche Codex du 16 août 2026 sur les cohortes iOS 1.0.0 à 1.3.2 et le rôle distinct de « Nouveau dans Pulpe ».               |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Ajouter le prompt doux iOS de bout en bout | [`phase-1.md`](./phase-1.md) |
