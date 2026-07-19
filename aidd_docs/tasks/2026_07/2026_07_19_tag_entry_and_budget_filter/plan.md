---
objective: "L’accès au catalogue de tags s’intègre aux autres réglages et la recherche globale retrouve les prévisions et transactions par texte, année et/ou tags."
status: in-progress
---

# Plan: Harmoniser l’accès aux tags et filtrer les budgets par tag

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Aligner l’entrée « Mes tags » sur les autres lignes de paramètres et ajouter un filtre multi-tags à la recherche globale des budgets. |
| **Source** | Demande utilisateur et captures des écrans Paramètres et Mes budgets du 19 juillet 2026. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Étendre la recherche globale aux tags | [`phase-1.md`](./phase-1.md) |
| 2   | Polir l’entrée et ajouter le filtre web | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Filtrer les éléments côté serveur à partir d’identifiants de tags, avec une requête texte optionnelle lorsqu’au moins un tag est sélectionné. | La liste des budgets ne charge pas les prévisions et transactions de chaque mois ; un filtrage client imposerait de télécharger et déchiffrer inutilement tous les détails. L’ajout de paramètres optionnels conserve les clients existants. |
| Appliquer un OU entre les tags sélectionnés, puis un ET entre les familles de filtres texte, années et tags. | Cette sémantique reprend le filtre multi-tags déjà utilisé dans le détail d’un budget et garde chaque contrôle prévisible. |
| Conserver le catalogue sous Paramètres > Organisation et remplacer uniquement son traitement visuel par une ligne de réglage standard. | Le problème signalé concerne la cohérence de l’entrée, pas l’architecture de navigation ni le catalogue en lecture seule déjà livré. |
