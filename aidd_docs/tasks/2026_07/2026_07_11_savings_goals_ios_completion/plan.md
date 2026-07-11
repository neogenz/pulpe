---
objective: "Les objectifs d'épargne sont un pilier iOS directement accessible, démontré avec le compte seed local, entièrement vérifié puis publié sur la branche distante."
status: in-progress
---

# Plan: Finaliser les objectifs d'épargne sur iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter le tab principal Objectifs, produire une preuve visuelle réelle sans exposer les secrets, puis valider et pousser tout le diff iOS pertinent. |
| **Source** | Demande utilisateur dans le task Codex du 11 juillet 2026. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Promouvoir les objectifs dans la navigation principale | [`phase-1.md`](./phase-1.md) |
| 2   | Automatiser une capture réelle et sûre du compte seed | [`phase-2.md`](./phase-2.md) |
| 3   | Qualifier, versionner et pousser le périmètre iOS | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Un quatrième tab permanent nommé « Objectifs » devient l'entrée principale. | Les objectifs sont consultés régulièrement et constituent un pilier produit; « Objectifs » décrit mieux les projets de long terme que le terme mensuel « Épargne ». |
| Le raccourci du dashboard est conservé mais redirige vers le tab Objectifs. | Il maintient la découverte contextuelle sans créer deux piles de navigation concurrentes vers la même liste. |
| La capture du compte seed est un workflow local explicite, hors CI, alimenté uniquement par variables d'environnement. | Le seed et l'API locale sont requis; aucun secret ne doit entrer dans le dépôt, les logs ou les médias. |
| La démonstration du simulateur reste non destructive. | La redistribution peut être montrée comme brouillon, puis annulée; aucun plan réel n'est appliqué pendant la capture. |
