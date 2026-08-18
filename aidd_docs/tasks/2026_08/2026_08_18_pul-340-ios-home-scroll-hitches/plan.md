---
objective: "L’accueil iOS 1.4.0 scrolle verticalement sans micro-saccades, la surface mint s’arrête toujours au bas mesuré du hero, et le diagnostic comme le correctif sont vérifiés sur un build Release."
status: in-progress
---

# Plan: corriger les micro-saccades du scroll vertical de l’accueil iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Isoler, puis corriger, l’invalidation SwiftUI de toute la homepage à chaque frame de scroll vertical, sans changer le layout Tour 11. |
| **Source** | [PUL-340](https://linear.app/pulpe/issue/PUL-340/diagnostiquer-les-micro-saccades-du-scroll-vertical-de-laccueil-ios) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Confirmer la cause par expérience comparative | [`phase-1.md`](./phase-1.md) |
| 2   | Isoler la hauteur mint hors du body de l’accueil | [`phase-2.md`](./phase-2.md) |
| 3   | Vérifier l’absence de hitch et consigner le non-régression | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [PUL-340](https://linear.app/pulpe/issue/PUL-340/diagnostiquer-les-micro-saccades-du-scroll-vertical-de-laccueil-ios) | Accueil 1.4.0 (1), témoin horizontal vs vertical, hypothèse `heroSurfaceBottom`, interdiction de figer une race sans écritures concurrentes observées, pas de télémétrie permanente. |
| [onGeometryChange(for:of:action:)](https://developer.apple.com/documentation/swiftui/view/ongeometrychange(for:of:action:)) | L’action ne s’exécute que lorsque la valeur transformée change ; `CGFloat` de `frame(in: .global).maxY` change à chaque déplacement vertical. |
| [onScrollGeometryChange(for:of:action:)](https://developer.apple.com/documentation/swiftui/view/onscrollgeometrychange(for:of:action:)) | Le carrousel horizontal filtre déjà sa géométrie ; ce n’est pas le témoin à modifier. |
| `ios/DESIGN.md` — Hero Surface (Dashboard) | La mint est bornée par le bas mesuré du hero, coins inférieurs arrondis, pas une fraction de la hauteur d’écran. |

## Decisions

| Decision | Why |
| -------- | --- |
| Publier la hauteur mint via un `@Observable` lu uniquement par le calque de fond, sur le modèle de `BudgetDetailsScrollTracker` | Le visuel Tour 11 exige un suivi viewport-fixed du bas du hero. Le hitch vient de qui relit la valeur (`CurrentMonthView.body`), pas du suivi lui-même. Déplacer la mint dans le `ScrollView` ou figer sa hauteur casserait le DESIGN.md. |
