---
objective: "Au premier accès à l'onglet Objectifs, un écran d'intro immersif (2 pages) explique à quoi sert la feature et comment le plan fonctionne, ne se montre qu'une fois, et débouche sur la création d'un premier objectif."
status: in-progress
---

# Plan: Intro première-fois « Objectifs d'épargne » (iOS)

## Overview

| Field      | Value                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| **Goal**   | Un écran d'intro `.fullScreenCover` paginé au 1er accès de l'onglet Objectifs, montré une seule fois.       |
| **Source** | Demande utilisateur : « ajouter un tuto/onboarding moderne et agréable pour la nouvelle feature objectif ». |

## Phases

| #   | Phase                          | File                         |
| --- | ------------------------------ | ---------------------------- |
| 1   | Flux d'intro + gating 1-fois   | [`phase-1.md`](./phase-1.md) |
| 2   | Craft, accessibilité, preuve   | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                     | Why                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Présentation via `.fullScreenCover` paginé (pas `.sheet`, pas TipKit)        | Choix « signature » demandé (intro dédiée 1er accès). `DESIGN.md` réserve `.fullScreenCover` aux flux immersifs (auth, onboarding). TipKit reste le pattern des tips contextuels, pas d'un flux. |
| Gate `@AppStorage("hasSeenSavingsGoalsIntro")` + fonction pure `shouldPresentIntro` | One-time, natif SwiftUI, testable sans UI. Aligne le pattern « pure func testée » de `MainTabView.shouldHideFloatingTabBar`.                                                       |
| Visuel « authenticated-restrained » (pas de brand-glow façon WelcomeStep)    | On est dans l'app authentifiée. `DESIGN.md` Glass Restraint Rule : l'expressivité brand (glow) est réservée au pré-auth ; l'app authentifiée reste sobre (surfaces standard + entrées animées + `symbolEffect`). |
| Étendre `SavingsGoalsListView` comme point d'ancrage du cover                | L'onglet Objectifs entre par cette vue (`MainTabView` → `SavingsGoalsTab` → `SavingsGoalsListView`). Le gate + cover y vivent, `MainTabView` reste inchangé.                              |
