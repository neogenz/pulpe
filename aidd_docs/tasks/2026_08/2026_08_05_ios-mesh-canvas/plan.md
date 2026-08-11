---
objective: "Le canvas de l'app iOS authentifiée est un MeshGradient statique aux verts pastel Pulpe (light + dark), le scope non-authentifié reste inchangé."
status: pending
---

# Plan: iOS mesh canvas (background authentifié)

## Overview

| Field      | Value                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Remplacer le canvas plat `appBackground` du scope authentifié par un mesh gradient pastel dérivé du vert Pulpe (#006E25)         |
| **Source** | Demande utilisateur + screenshot de référence (mesh pastel sur base quasi-blanche, analysé par script : lavande/violet/bleu/crème) |

Contraintes posées par l'utilisateur :
- Mesh gradient façon screenshot, mais en **verts pastel Pulpe** (pas de violet).
- **Scope authentifié uniquement** — login, onboarding, PIN/lock, force-update gardent leur background actuel.
- Variante **dark mode** (taches vertes sombres sur le near-black #121611).

## Phases

| #   | Phase                            | File                         |
| --- | -------------------------------- | ---------------------------- |
| 1   | Tokens + composant mesh          | [`phase-1.md`](./phase-1.md) |
| 2   | Câblage canvas + exclusions lock | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                      | Verified                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| https://developer.apple.com/documentation/swiftui/meshgradient              | `MeshGradient(width:height:points:colors:background:smoothsColors:)`, iOS 18+, est une `View` — compatible avec le deployment target 18.0 du projet et utilisable directement dans un `.background { }` |

## Decisions

| Decision                                                                                          | Why                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le mesh vit dans `PulpeBackgroundModifier` (`.pulpeBackground()`), pas un nouveau modifier global | 49 call sites existants : changer le modifier une seule fois propage le canvas partout sans toucher les features. Les écrans du scope non-authentifié qui utilisent `.pulpeBackground()` (PIN entry/recovery, force-update) basculent sur une variante flat explicite. |
| Mesh **statique** (points fixes, aucune animation)                                                | DA Pulpe = calm naturalism + motion restraint ; un mesh animé en canvas permanent fatiguerait et coûte du GPU en continu.                                                                     |
