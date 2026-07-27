---
objective: "Le parcours web de suppression d’un objectif ouvre le vrai dialogue depuis la route, affiche son impact et exécute le choix confirmé sans erreur d’injection, avec une régression E2E qui protège ce joint."
status: in-progress
---

# Plan: Sécuriser la suppression d’un objectif sur le web

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger le `NG0201` à l’ouverture du dialogue et couvrir le parcours réel jusqu’au payload de suppression. |
| **Source** | Signalement utilisateur et reproduction Vercel du 2026-07-27 sur le parcours de suppression d’un objectif. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Reproduire, corriger et verrouiller le parcours web | [`phase-1.md`](./phase-1.md) |
