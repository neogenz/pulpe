---
objective: "Les résultats asynchrones liés aux tags respectent la session et la limite de dix, et aucun formulaire iOS n’affiche une sélection que son flux de sauvegarde ignore."
status: in-progress
---

# Plan: Corriger les findings de revue PUL-294

## Overview

| Field      | Value                                      |
| ---------- | ------------------------------------------ |
| **Goal**   | Fermer les trois défauts bloquant la PR iOS des tags |
| **Source** | PR GitHub `#552` et rapport de revue PUL-294 |

## Phases

| #   | Phase                                         | File                         |
| --- | --------------------------------------------- | ---------------------------- |
| 1   | Isoler les créations de tag par session       | [`phase-1.md`](./phase-1.md) |
| 2   | Sécuriser le sélecteur et le flux de prévision | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Séparer la génération de session de la génération de chargement | Un refresh du catalogue dans la même session ne doit pas invalider une création légitime, alors qu’un reset doit interdire toute mutation tardive |
| Masquer les tags dans le flux `savings-withdrawal` | Son contrat strict ne transporte aucun `tagIds`; l’étendre dépasserait PUL-294 et imposerait une évolution backend/shared |
