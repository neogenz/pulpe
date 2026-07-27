---
objective: "La suppression d’un objectif présente un impact complet et permet de conserver, délier ou supprimer explicitement ses prévisions et transactions sur le web et iOS."
status: in-progress
---

# Plan: Prévisualiser et choisir l’impact de la suppression d’un objectif

## Overview

| Field      | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| **Goal**   | Sécuriser la suppression d’un objectif par un aperçu exhaustif et trois périmètres explicites. |
| **Source** | Linear PUL-319                                               |

## Phases

| #   | Phase                         | File                         |
| --- | ----------------------------- | ---------------------------- |
| 1   | Contrat partagé               | [`phase-1.md`](./phase-1.md) |
| 2   | Aperçu et suppression en base | [`phase-2.md`](./phase-2.md) |
| 3   | Orchestration API NestJS      | [`phase-3.md`](./phase-3.md) |
| 4   | Expérience web                | [`phase-4.md`](./phase-4.md) |
| 5   | Expérience iOS                | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Ajouter `GET /savings-goals/:id/deletion-impact` et `POST /savings-goals/:id/deletion`, tout en conservant l’ancien `DELETE` en mode « objectif seul ». | Le flux devient explicite sans casser une version web ou iOS déjà déployée. |
| Faire porter les trois mutations et la validation de la révision d’aperçu par une RPC PostgreSQL unique. | Les suppressions et déliaisons doivent réussir ensemble ou être entièrement annulées, y compris sous concurrence. |
| Représenter la révision par les identifiants et `updatedAt` des lignes et transactions affichées. | Le serveur peut comparer exactement l’aperçu consenti à l’état verrouillé, sans jeton opaque ni nouvelle table. |
| Garder le recalcul des budgets après le commit, avec une erreur explicite `partialFailure`. | Les montants sont chiffrés et le recalcul existant dépend du service NestJS ; il ne peut pas participer à la transaction PostgreSQL. |
