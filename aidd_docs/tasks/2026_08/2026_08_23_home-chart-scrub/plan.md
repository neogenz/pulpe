---
objective: "Le burn-down de la Home se lit au doigt : une règle qui suit le toucher et une bulle qui dit le jour, le réel, le prévu et l'estimé."
status: pending
---

# Plan: Home chart scrub

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Rendre le burn-down interrogeable au doigt (règle + bulle), sans casser le défilement vertical ni l'accessibilité |
| **Source** | [`brainstorm.md`](./brainstorm.md), Maxime 2026-08-23 : « comme Revolut, une barre verticale qu'on déplace avec des informations » |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | Lecture du jour et règle de scrub | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | ----------------- |
| `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Chart.swift` | séries `plan`, `real`, `projection` ; labels ; `.sensitiveAmount()` sur le graphe |
| Swift Charts | `chartOverlay { proxy in … }`, `proxy.value(atX:)`, `RuleMark(x:)` + `.annotation` |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Appui court puis glissement | Le graphe est dans un ScrollView vertical ; un drag nu vole le scroll |
| Lecture pure `ScrubReading` testée, geste non testé | Le geste ne se teste pas en unitaire ; les valeurs, si |
| Labels fixes masqués pendant le scrub | Une seule annotation à la fois sur un graphe de 150 pt |
