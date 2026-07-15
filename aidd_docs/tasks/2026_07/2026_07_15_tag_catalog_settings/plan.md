---
objective: "Les tags personnels créés sur le web sont consultables depuis les paramètres web et iOS à partir du catalogue backend existant."
status: implemented
---

# Plan: Catalogue de tags dans les paramètres

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter un écran de consultation des tags personnels dans les paramètres web et iOS, sans dupliquer leur stockage. |
| **Source** | Demande utilisateur du 15 juillet 2026. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Catalogue web dans les paramètres | [`phase-1.md`](./phase-1.md) |
| 2   | Catalogue iOS connecté au même backend | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Conserver `GET /tags` et la table `tag` comme source de vérité unique pour les deux clients. | La persistance utilisateur, la RLS, l’unicité et le CRUD existent déjà ; une préférence locale ou une nouvelle table créerait une divergence entre plateformes. |
| Livrer un catalogue en lecture seule dans ce plan. | Le besoin porte sur la consultation ; renommer ou supprimer introduit des conséquences sur les associations aux transactions, prévisions et modèles qui nécessitent un cadrage produit séparé. |
