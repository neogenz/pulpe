---
objective: "Les tips TipKit iOS ne décrivent que des gestes qui existent encore, expliquent comment pointer en pointant la flèche sur le vrai contrôle, et portent le style de la refonte."
status: in-progress
---

# Plan: iOS first-launch tips refresh

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Audit et remise à niveau des tips TipKit (`ProductTips`) après la refonte design, focus sur le pointage |
| **Source** | Demande texte de Maxime (2026-08-23) : vérifier que les aides premier lancement existent, sont à jour, non invasives, premium, et que « pointer » est clair |

## Findings (audit)

| Tip | État | Verdict |
| --- | --- | --- |
| `GesturesTip` « Glisse pour compléter » | Jamais affiché en prod : aucun appelant ne passe `tip:` à `BudgetSection` (seuls harness/`PreviousBudgetSheet` sans tip). Copie obsolète : on pointe désormais via le disque `PointCircle`, pas par swipe. | Supprimer, avec le paramètre `tip` de `BudgetSection` |
| `CheckingTip` | Dit POURQUOI, jamais COMMENT. Sur Budget Detail, ancrée sur `BudgetTypeFilter` (le rail de chips) : la flèche pointe un filtre, pas le rond qui pointe. Sur Home, ancrée sur tout le deck. | Réécrire la copie (geste explicite), ré-ancrer sur le `PointCircle` de la première ligne à pointer |
| `PessimisticCheckTip` | Contenu exact, inline dans la zone, `pulpeTipBackground()` = surface carte de la refonte | Garder |
| `TemplatesWebParityTip` | Toujours vrai (pas de suppression de modèle sur iOS) | Garder |
| `tourDismissed` | Écrit seulement par le harness UI test et `resetAllTips` | Garder (harness) |

Pas d'onboarding « product tour » autre que ces tips ; pas de What's New impliqué. Axe non applicable (natif iOS) ; la vérif a11y passe par les labels VoiceOver existants du `PointCircle`.

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | Retirer le tip gestes mort et remettre le tip pointage sur le bon contrôle avec une copie actionnable | [`phase-1.md`](./phase-1.md) |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Un seul `CheckingTip`, deux ancrages (deck Home, disque Budget Detail), copie commune | TipKit compte les affichages par tip ; une copie qui nomme les deux gestes couvre les deux écrans sans second tip à maintenir |
| Ancrage sur UNE seule ligne (première à pointer, décidée dans `BudgetDetailsView`) | `.popoverTip` sur chaque ligne afficherait un popover par ancre |
