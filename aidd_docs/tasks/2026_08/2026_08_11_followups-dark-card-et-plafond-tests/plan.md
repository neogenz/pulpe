---
objective: "La carte de ligne se lit en dark aussi bien qu'en clair, et plus aucune struct de test ne crève le plafond SwiftLint."
status: implemented
---

# Plan: carte de ligne en dark, et plafond des structs de test

## Overview

| Field      | Value                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| **Goal**   | Solder les deux défauts résiduels du suivi BudgetDetails, hors point VoiceOver écarté      |
| **Source** | Bloc « Follow-up suggestions » de la session du 2026-08-11, recalé contre le code et chiffré |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Rendre la portance de la carte bimodale    | [`phase-1.md`](./phase-1.md) |
| 2   | Découper les deux structs de test hors cap | [`phase-2.md`](./phase-2.md) |
| 3   | Solder les ombres mortes en dark restantes | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision                                                                                | Why                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La barre est la parité avec le mode clair, pas les 3:1 de WCAG 1.4.11                    | Le mode clair rend la carte à **1,12:1** (blanc sur `#EFF3EE`) et personne ne le considère cassé. Viser 3:1 en dark rendrait le dark plus contrasté que le clair et transformerait chaque carte en boîte. La carte est un groupement : le texte qu'elle porte reste régi par 1.4.3, qui lui est tenu.             |
| La portance passe de l'ombre au contour **en dark uniquement**, via un token bimodal      | En clair l'ombre (noir 5 %) porte seule la séparation, le fond ne valant que 1,12:1. En dark cette ombre est noire sur `#121611` : morte. Un token `light: .clear / dark: outlineVariant` reprend exactement la forme de `homeZoneBoundaryShadow`, précédent déjà en place pour un cas symétrique.               |
| BudgetDetails est branché sur `pulpeRowCard()` au lieu d'être corrigé en parallèle        | Trois sites y recopient à la main le couple `background(surfaceContainerLowest)` + `shadow(.subtle)` que le modifier partagé encapsule déjà. Corriger sans fusionner laisserait deux implémentations de la même carte, donc deux endroits à corriger au prochain défaut.                                         |
| Le badge de compte sort du périmètre                                                     | Mesuré après coup : **1,04:1 en clair contre 1,15:1 en dark**. Il est déjà meilleur en dark qu'en clair, donc la parité est tenue sans rien changer. Le suivi initial le signalait à tort.                                                                                                                       |
| Chaque ombre restante est jugée sur son fond réel, jamais en bloc                        | Les 12 sites d'ombre ne partagent pas de fond : la liste des budgets est sur `appBackground`, l'onboarding sur un dégradé, les champs de saisie sur leur propre surface. Une ombre noire est morte sur du quasi-noir, pas sur un dégradé clair. Appliquer un contour partout « par cohérence » abîmerait les écrans sains. |

## Resources

<!-- Aucune source externe consultée : tout a été tranché sur le code du dépôt et sur le
     calcul de luminance relative appliqué aux tokens de Color+Pulpe.swift. -->

| Source                                        | Verified                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift` | Valeurs dark exactes : `appBackground` #121611, `surfaceContainerLowest` #1E1C1A, `outlineVariant` #3F493E    |
| `ios/Pulpe/Shared/Extensions/View+Extensions.swift` | `pulpeRowCard()` existe et couple déjà fond + ombre ; ses 7 consommateurs sont tous dans `CurrentMonth/` |
