---
objective: "Le détail web d’un objectif présente une trajectoire aussi lisible que la référence Linear, avec le réalisé, la projection planifiée et la cible clairement distincts et accessibles."
status: in-progress
---

# Plan: Clarifier la trajectoire d’un objectif

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Adapter le graphe Chart.js existant au langage visuel de la référence Linear sans changer les calculs métier ni ajouter de dépendance. |
| **Source** | Demande utilisateur, capture `Screenshot 2026-07-26 at 11.06.06.png` et DOM joint `pasted-text.txt`. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Adapter la grammaire Chart.js | [`phase-1.md`](./phase-1.md) |
| 2 | Composer la synthèse responsive et accessible | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://www.chartjs.org/docs/latest/charts/line.html | Chart.js 4 couvre nativement les lignes pleines ou pointillées, les points terminaux, les remplissages et l’interpolation adaptée aux séries. |
| https://www.chartjs.org/docs/latest/developers/plugins.html | Un plugin local peut dessiner un repère et une zone de fond sur le canvas sans dépendance externe ni enregistrement global. |
| https://www.chartjs.org/docs/latest/configuration/responsive.html | Le canvas doit rester dans un conteneur dédié et positionné, avec `responsive` et `maintainAspectRatio: false`. |
| https://www.chartjs.org/docs/latest/general/accessibility.html | Le canvas ne porte pas seul une information accessible ; une alternative textuelle ou HTML doit restituer les valeurs. |
| https://www.chartjs.org/docs/latest/samples/legend/html.html | Une légende HTML est le motif recommandé quand la légende canvas ne permet pas la composition voulue. |

## Decisions

| Decision | Why |
| --- | --- |
| Conserver Chart.js 4.5.1 et ng2-charts 8, sans ajouter de plugin npm. | Les datasets et l’API `Plugin<'line'>` installés couvrent tout le rendu demandé ; une dépendance d’annotation ou de hachures serait superflue. |
| Rendre la synthèse avec le template Angular, alimenté par les mêmes inputs que le canvas. | Cela garde le DOM, le responsive, le masquage des montants et l’accessibilité sous le contrôle idiomatique d’Angular, sans mutation DOM depuis Chart.js. |
| Adapter la référence Linear à la sémantique Pulpe au lieu de la copier littéralement. | Le gris représente la cible, le vert l’épargne, le pointillé le futur ; les hachures de week-end et les couleurs “started/completed” de Linear n’ont pas d’équivalent métier dans un objectif mensuel. |
| Limiter ce plan au détail web. | La demande vise explicitement Chart.js ; l’écran iOS utilise Swift Charts et nécessite une décision visuelle séparée, pas un refactor opportuniste. |
