---
objective: "La landing suit une séquence continue : fondu Borumi adapté aux couleurs Pulpe sur mobile, aucune coupure de fond, preuves rattachées au dashboard, rythme inter-sections non doublé et texte secondaire final lisible sur le champ ambiant."
status: implemented
---

# Plan: Reproduire le fondu mobile de Borumi sur la landing

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Reprendre fidèlement la mécanique de fond Borumi tout en resserrant la transition mobile entre le hero et le récit produit. |
| **Source** | Demande utilisateur du 19 juillet 2026 + captures de 18:58, 19:44 et 20:21 + https://borumi.com/ |

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
| Reprendre les dimensions, positions, rotation, opacités et flou de Borumi, mais remplacer son violet/corail par des tokens mobiles Pulpe plus denses | Le flou reste fidèle à la référence sans laver les couleurs ni introduire des teintes décoratives étrangères à la marque. |
| Appliquer la nouvelle mécanique sous 768 px, conserver le fond desktop et resserrer uniquement son raccord dashboard → preuves | Le contrôle visuel final a confirmé le besoin d'un fondu mobile non coupé et d'un espacement desktop moins détaché, sans redessiner le reste du desktop. |
| Renforcer uniquement le texte secondaire du CTA final au lieu de modifier le token global | Le texte passe déjà AA ailleurs; le champ ambiant du CTA exige une densité supérieure sans aplatir toute la hiérarchie secondaire. |
| Partager l'espacement de frontière entre deux sections adjacentes | La primitive appliquait `80/120 px` sur chaque côté, créant `160/240 px` entre contenus alors que le contrat désigne la distance cumulée; Borumi utilise lui aussi des respirations cumulées, pas deux marges pleines. |
| Ne pas reprendre la grille décorative de Borumi | Le besoin porte sur le dégradé et le fondu; la grille contredit la règle landing qui l'interdit et n'aide pas la continuité narrative. |
