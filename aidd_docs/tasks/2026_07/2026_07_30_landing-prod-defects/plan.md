---
objective: "The six defects the comparative critique found on the deployed landing are fixed in the main repo, without borrowing anything from the redesign branch, and the section that changed approach leaves no dead surface behind."
status: implemented
---

# Plan: Corriger les défauts de la landing en prod

## Overview

| Field      | Value                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Régler les 2 P1, 2 P2 et le lot de correctness relevés sur `landing/` @ `preview`, sans toucher au périmètre de sections ni au thème      |
| **Source** | `.impeccable/critique/2026-07-30T08-00-02Z__landing-app-page-tsx.md` (critique comparatif dual-agent prod vs `codex/landing-redesign`)    |

Hors périmètre, décidé explicitement : aucun emprunt à la refonte (hero split, mode sombre, canvas quasi-blanc), aucune section ajoutée ou retirée, aucun changement de police.

## Phases

| #   | Phase                                  | File                         |
| --- | -------------------------------------- | ---------------------------- |
| 1   | Sticky CTA lisible et non occultant    | [`phase-1.md`](./phase-1.md) |
| 2   | Preuve produit au-dessus de la ligne   | [`phase-2.md`](./phase-2.md) |
| 3   | Marqueur et flèche corrects sur mobile | [`phase-3.md`](./phase-3.md) |
| 4   | HowItWorks lisible dès 768px           | [`phase-4.md`](./phase-4.md) |
| 5   | Champ ambiant cohérent desktop/mobile  | [`phase-5.md`](./phase-5.md) |
| 6   | Lot de correctness                     | [`phase-6.md`](./phase-6.md) |
| 7   | Retirer la pile de captures morte      | [`phase-7.md`](./phase-7.md) |
| 8   | Graphe annuel accordé à la copie       | [`phase-8.md`](./phase-8.md) |

## Decisions

| Decision                                                                                              | Why                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Le champ ambiant se corrige en baissant le chroma desktop, jamais en montant l'opacité mobile          | `globals.css:316-331` documente que le `0.07` mobile est calibré par différence de pixels contre un rendu flouté, écart moyen sous 1,7/255. Monter cette valeur casserait une calibration mesurée  |
| Zéro emprunt à `codex/landing-redesign` dans ce plan                                                   | La refonte modifie aussi `PRODUCT.md` et le `DESIGN.md` racine, donc l'identité typographique. Mélanger les deux ferait de six correctifs ciblés une refonte de marque non décidée                |
| Les quatre acquis mesurés de la prod sont des invariants de sortie, pas des objectifs                  | Prod tient aujourd'hui 0 violation axe, 0 texte sous AA, 15/15 focus visible, 0 finding détecteur. Chaque phase doit les préserver, sinon le correctif coûte plus qu'il ne rapporte                |
| Les trois visuels de HowItWorks sont dessinés en code, plus des captures de l'app (décision de Maxime en cours d'implémentation) | La colonne plafonne à 341px : une capture de fenêtre y arrive à 0,24 et met son texte sous 4px, et le recadrage n'a fait que troquer ça contre des cartes amputées et des mois atténués, parce que les captures étaient cadrées pour un autre usage. Dessinés, les visuels restent nets à toute densité et portent une arithmétique cohérente. Contrepartie assumée : on passe de la preuve par capture à l'illustration |
| Les tâches de la phase 4 ont été réécrites après livraison, pour décrire l'approche retenue                                       | L'objectif de la phase et ses critères de lisibilité étaient fixés d'avance et ont été mesurés, mais ses tâches décrivaient des assets recadrés que le changement d'approche a rendus caducs. Le fichier de phase est le contrat de référence : le laisser décrire une implémentation abandonnée aurait trompé la prochaine lecture |
| La landing perd sa capacité d'afficher des captures produit, elle ne la met pas de côté                                          | `HowItWorks` était le seul appelant de `Screenshot`, donc de la lightbox et des quinze assets. Garder cette pile sans appelant coûte une lecture à chaque contributeur et 723 Ko de déploiement. La réintroduire un jour voudra de nouvelles captures cadrées pour leur emplacement, pas celles-ci |
