---
objective: "L'écran Compte affiche la photo de profil OAuth comme la homepage, et les chips informatifs « Lissé » / « Objectif » se détachent de leur fond sur les trois surfaces où ils apparaissent."
status: implemented
---

# Plan: Photo de profil dans Compte + contraste des chips informatifs (iOS)

## Overview

| Field      | Value                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| **Goal**   | Deux corrections visuelles iOS relevées en test sur `preview` : avatar manquant dans Compte, chips `.muted` illisibles sur le canvas nu. |
| **Source** | Retour de test utilisateur (texte + capture de l'écran Compte, 2026-07-24), branche `preview`. |

## Phases

| #   | Phase                                        | File                         |
| --- | -------------------------------------------- | ---------------------------- |
| 1   | Avatar partagé (homepage + Compte)           | [`phase-1.md`](./phase-1.md) |
| 2   | Teinte des chips informatifs (Lissé, Objectif) | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                                    | Why                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tous les chips informatifs concernés prennent le vert épargne de `c42f124b5`, « Lissé » compris.            | Décision utilisateur : un seul traitement visible pour tous ces chips, aligné sur le badge de statut d'objectif déjà corrigé et mergé. Le coût assumé est sémantique — une dépense lissée porte la couleur épargne — et il est préféré à une seconde teinte à maintenir. |
| `PulpeChip.Style.semantic(_:)` devient la recette unique « teinte à 12 % + encre pleine ».                   | Le couple `.tinted(surface: X.opacity(badgeBackground), foreground: X)` atteint 5 usages (badge objectif existant + 4 nouveaux). En dessous de 3 on aurait laissé la recette inline.                                                                                                        |
| L'avatar devient un composant partagé `ProfileAvatar` au lieu d'être dupliqué.                                | `ios/CLAUDE.md` : « Pattern repeat 2+ places → enrich shared component, never copy-paste ». La cascade photo → initiales → glyphe et le cache image ne doivent exister qu'une fois.                                                                                                          |
