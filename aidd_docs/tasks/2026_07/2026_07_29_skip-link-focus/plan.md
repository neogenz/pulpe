---
objective: "Le lien d’évitement reste disponible au clavier sur l’accueil et Support sans demeurer affiché au-dessus du menu après activation."
status: implemented
---

# Plan: Corriger le focus du lien d’évitement

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Conserver « Aller au contenu » pour l’accessibilité, limiter son affichage au focus clavier et transférer le focus vers le contenu principal. |
| **Source** | Demande utilisateur et appshot Arc du 29 juillet 2026 montrant le lien bloqué au-dessus du header sur `/support#main-content`. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Fiabiliser le lien d’évitement partagé par les deux pages | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://www.w3.org/WAI/WCAG22/Techniques/general/G1 | Un lien d’évitement peut être masqué hors focus, mais son activation doit déplacer le focus vers le contenu principal. |
