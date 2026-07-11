---
objective: "La sheet iOS des nouveautés s'affiche une seule fois après une vraie mise à jour, pour tous les parcours authentifiés, avec des données de version cohérentes et validées."
status: implemented
---

# Plan: Corriger PUL-186 — nouveautés après mise à jour iOS

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Lever les trois blocages de review et traiter les commentaires PR actionnables sans élargir la fonctionnalité. |
| **Source** | Ticket/PR `PUL-186` / `neogenz/pulpe#498`, `review.md`, threads GitHub non résolus |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Aligner le contrat et les données sur les versions iOS | [`phase-1.md`](./phase-1.md) |
| 2 | Fiabiliser migration, authentification et idempotence | [`phase-2.md`](./phase-2.md) |
| 3 | Finaliser la présentation et prouver le parcours complet | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/neogenz/pulpe/pull/498 | Objectif de la feature, plan de test initial et quatre threads de review encore ouverts. |

## Decisions

| Decision | Why |
| --- | --- |
| Porter une version marketing iOS explicite dans chaque release iOS | La version produit `0.x` et `MARKETING_VERSION` `1.x` sont volontairement indépendantes; une correspondance implicite ne peut pas fonctionner. |
| Utiliser le marqueur d'installation existant et une baseline de migration unique | Il faut distinguer les installations neuves des utilisateurs présents avant PUL-186 sans créer un second mécanisme de détection d'installation. |
