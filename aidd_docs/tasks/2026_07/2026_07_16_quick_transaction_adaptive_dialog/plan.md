---
objective: "Sur tablette et desktop, l’ajout rapide d’une transaction s’ouvre dans un dialog centré, compact et accessible, tandis que le mobile conserve son bottom sheet et le même résultat métier."
status: in-progress
---

# Plan: Adapter l’ajout rapide de transaction aux grands écrans

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Remplacer la feuille mobile étroite sur tablette et desktop par un dialog adaptatif qui exploite l’espace sans rallonger le parcours. |
| **Source** | Demande utilisateur et capture `/var/folders/th/8y0_0gcn4jz28x2y9gn3h2x80000gp/T/TemporaryItems/NSIRD_screencaptureui_ojYKKA/Screenshot 2026-07-16 at 16.06.25.png` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Livrer et vérifier la surface adaptative d’ajout rapide | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://material.angular.dev/components | Le bottom sheet est une surface principalement mobile, tandis que le dialog est la primitive modale configurable adaptée aux grands écrans. |
| https://material.angular.dev/components/dialog/styling | Les dimensions et la forme du conteneur peuvent être ajustées avec un override Material scoped, sans `::ng-deep`. |
| https://material.angular.dev/cdk/layout/api | `BreakpointObserver` permet de tester le breakpoint courant et de garder la bifurcation dialog/bottom sheet alignée sur le layout. |

## Decisions

| Decision | Why |
| --- | --- |
| Partager un seul composant de formulaire entre un wrapper bottom sheet mobile et un wrapper dialog tablette/desktop | La présentation devient réellement adaptative sans dupliquer les validations, la conversion de devise ni le payload de transaction. |
| Utiliser `Breakpoints.Handset` comme frontière de présentation | Le shell principal utilise déjà cette définition CDK ; reprendre la même frontière évite une zone où navigation et modale classeraient différemment le même viewport. |
