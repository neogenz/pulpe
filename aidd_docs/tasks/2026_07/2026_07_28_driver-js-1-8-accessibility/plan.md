---
objective: "Driver.js 1.8 remplace la version 1.4 sans refonte du product tour, avec une régression clavier automatisée et une validation visuelle locale reproductible."
status: implemented
---

# Plan: Mise à niveau Driver.js 1.8 et validation d’accessibilité

## Overview

| Field      | Value                                      |
| ---------- | ------------------------------------------ |
| **Goal**   | Mettre à niveau Driver.js sans changer l’expérience actuelle et verrouiller son accessibilité. |
| **Source** | Texte utilisateur du 28 juillet 2026      |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Mettre à niveau la dépendance sans refonte | [`phase-1.md`](./phase-1.md) |
| 2   | Verrouiller l’accessibilité réelle         | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://driverjs.com/docs/changelog | Driver.js 1.8.0 conserve les exports existants, ajoute des options sans migration obligatoire et documente les changements de style introduits depuis 1.5. |
| https://driverjs.com/docs/configuration | Le contrôle clavier reste activé par défaut et les hooks actuels `onNextClick` et `onDestroyed` restent supportés. |
| https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Le dialogue doit avoir un nom accessible, contenir le parcours de tabulation, se fermer avec Échap et restaurer le focus. |
| https://www.w3.org/TR/WCAG22/ | Les critères clavier, ordre du focus, focus visible et focus non masqué structurent la validation. |

## Decisions

| Decision | Why |
| -------- | --- |
| Conserver Driver.js, les textes, les étapes et le thème actuels. | Le besoin porte sur une maintenance de dépendance et une preuve d’accessibilité, pas sur une nouvelle conception ni un changement de librairie. |
