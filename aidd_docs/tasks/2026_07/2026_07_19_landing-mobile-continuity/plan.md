---
objective: "Sur mobile, la fin du hero, les trois preuves et le récit de PainPoints forment une séquence compacte portée par le même fondu diffus que Borumi, adapté aux couleurs Pulpe et sans bande blanche centrale."
status: implemented
---

# Plan: Reproduire le fondu mobile de Borumi sur la landing

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Reprendre fidèlement la mécanique de fond Borumi tout en resserrant la transition mobile entre le hero et le récit produit. |
| **Source** | Demande utilisateur du 19 juillet 2026 + capture `Screenshot 2026-07-19 at 18.58.19.png` + https://borumi.com/ |

## Phases

| #   | Phase                                           | File                         |
| --- | ----------------------------------------------- | ---------------------------- |
| 1   | Continuité visuelle et narrative sur mobile     | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://borumi.com/ | En mobile, chaque section superpose deux ellipses hors-cadre de `40–60vw × 50–60vh`, tournées à `-30deg`, opacité `0.3–0.4` et `blur(150px)`, placées vers `top: 10%` et `top: 90%`; leur recouvrement produit le fondu continu. |
| https://pulpe-landing-git-preview-maximes-projects-56d66b35.vercel.app/ | La preview correspond à `origin/preview`; son accès automatisé redirige vers le SSO Vercel, donc la capture fournie reste la référence visuelle du défaut déployé. |

## Decisions

| Decision | Why |
| -------- | --- |
| Reprendre les dimensions, positions, rotation, opacités et flou de Borumi, mais remplacer son violet/corail par les tokens verts Pulpe | Le rendu demandé reste fidèle à la référence sans introduire des couleurs décoratives étrangères à la marque. |
| Appliquer la nouvelle mécanique sous 768 px et conserver le fond desktop actuel | Le défaut est mobile; cette limite évite une régression desktop et respecte la préférence exprimée. |
| Ne pas reprendre la grille décorative de Borumi | Le besoin porte sur le dégradé et le fondu; la grille contredit la règle landing qui l'interdit et n'aide pas la continuité narrative. |
