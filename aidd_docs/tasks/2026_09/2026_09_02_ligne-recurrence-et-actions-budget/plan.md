---
objective: "Chaque ligne de prévision porte sa récurrence sous forme de glyphe, chaque transaction libre de l'Accueil se dit « Hors prévision », et les deux actions du détail budget quittent la barre de navigation pour une carte visible dans la zone de contenu."
status: in-progress
---

# Plan: Récurrence sur la ligne et actions du détail budget

## Overview

| Field      | Value                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre lisible d'où vient une ligne (récurrente, ponctuelle, hors prévision) et rendre trouvables les deux actions du détail budget.        |
| **Source** | Brainstorm validé en session + canvas de maquettes <https://claude.ai/code/artifact/acd64a6d-6a3c-435f-84e7-18347a68ac0d>                   |

## Phases

| #   | Phase                                          | File                         |
| --- | ---------------------------------------------- | ---------------------------- |
| 1   | Glyphe de récurrence sur le détail budget      | [`phase-1.md`](./phase-1.md) |
| 2   | Glyphe de récurrence sur l'Accueil             | [`phase-2.md`](./phase-2.md) |
| 3   | « Hors prévision » sur les transactions libres | [`phase-3.md`](./phase-3.md) |
| 4   | Actions du détail budget hors de la barre      | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                | Verified                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| <https://claude.ai/code/artifact/acd64a6d-6a3c-435f-84e7-18347a68ac0d> | Les rendus comparés et validés : glyphe plutôt que mot, placement des actions, et les trois traitements de la carte. |

## Decisions

| Decision                                                                                       | Why                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La récurrence est portée par un glyphe (`repeat` / `1.circle`), jamais par un mot               | `TransactionRecurrence.oneOff.label` vaut « Prévu » et `amountSuffix` écrit « prévu » sur la même ligne : le mot se dédoublerait avec deux sens. Le glyphe existe déjà (`TransactionEnums.swift:103`) et coûte une largeur fixe là où le mot fait sauter le segment actionnable. |
| La périodicité vit dans la ligne de métadonnée à gauche, jamais sous le montant                 | Une info consultative ne prend pas la colonne du montant, réservée aux nombres actionnables (« restant sur X », « de dépassement »).                                                                                                                                             |
| Le mot pour une transaction libre reste « Hors prévision », pas « Imprévu »                     | « Imprévus » est déjà le libellé de la métrique de variance du hero de l'Accueil (`HomeHeroCard.swift:140`) — même écran, deux sens. « Hors prévisions » est le terme livré sur iOS (2 endroits) et sur la webapp (`fr.json:538`).                                                |
| Aucun badge sur les lignes de la section « Hors prévisions » du détail budget                   | Le titre de section porte déjà l'information ; la répéter à chaque ligne est du bruit et coûte la date.                                                                                                                                                                          |
| Les deux actions quittent la barre de navigation et ne coexistent pas avec elle                 | Une même action à deux endroits sur un écran contredit l'objectif de clarté. Les glyphes de barre ont leurs labels VoiceOver mais aucune découvrabilité visuelle.                                                                                                                |
| Les actions se posent en tête de la zone de contenu, au-dessus du rail `BudgetTypeFilter`       | Le hero porte déjà figure + 3 tuiles + barre + verdict ; une seconde rangée de tuiles translucides y empilerait la même grammaire pour deux rôles différents (métrique vs action).                                                                                               |
| Le traitement visuel retenu est **I-1** — deux cartes de 64 pt côte à côte, disque 36 pt puis label | Choisi par Maxime. Le plus discret des trois traitements : il annonce les deux actions sans peser autant qu'une ligne du ledger juste en dessous. Les deux cartes prennent `CornerRadius.card` (18 pt), le rayon exact des cartes de section du ledger, pour que les formes se répondent en descendant la page. |
| Le renommage « Récurrent »/« Prévu » → « Mensuel »/« Ponctuel » n'est PAS dans ce plan          | Terme de lexique verrouillé sur 6 surfaces (`CLAUDE.md`, iOS, webapp ×2, Android `vocabulary.spec.ts`, landing) et 4 locales. Changement séparé, avec sa propre vérification cross-plateforme.                                                                                   |
| La troncature de la ligne de consommation sur l'Accueil est acceptée telle quelle               | Constatée sur maquette (elle tient déjà tout juste à 390 pt, tronque en xxLarge) et validée. La sortie connue — retirer « 72 % utilisé », que la barre de progression porte déjà — reste hors périmètre.                                                                          |
