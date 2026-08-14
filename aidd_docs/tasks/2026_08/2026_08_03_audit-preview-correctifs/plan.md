---
objective: "Les six défauts confirmés de l'audit v0.43.0..preview sont corrigés, l'en-tête épinglé du détail d'enveloppe iOS ne laisse plus passer les lignes, et chaque correctif est tenu par un test qui échouait avant lui."
status: implemented
---

# Plan: Correctifs de l'audit v0.43.0 → preview

## Overview

| Field      | Value                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Refermer les chemins retour de PUL-329 (édition, suppression, refus, offline), rendre lisible ce que l'écran affiche, et corriger le chevauchement de l'en-tête « Transactions » sur iOS |
| **Source** | Audit multi-agents du diff `v0.43.0..preview` (167 commits, 276 fichiers) + capture d'écran du détail d'enveloppe « Week-end Italie »        |

## Phases

| #   | Phase                                | File                         |
| --- | ------------------------------------ | ---------------------------- |
| 1   | Chemins retour du retrait (backend)  | [`phase-1.md`](./phase-1.md) |
| 2   | Un refus serveur atteint l'utilisateur | [`phase-2.md`](./phase-2.md) |
| 3   | Ce que l'écran dit (webapp)          | [`phase-3.md`](./phase-3.md) |
| 4   | Coût et calage de l'affichage iOS    | [`phase-4.md`](./phase-4.md) |
| 5   | Ce que plus personne ne lit          | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision                                                                                                       | Why                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La garde de solde défend un **prélèvement**, pas une écriture : `assertSufficient` sort tôt quand `debit <= 0`   | L'alternative (faire passer `creditBack` depuis `RemoveTransactionUseCase`) répare un appelant et laisse le prochain retomber dans le trou. L'invariant appartient à la policy, pas à ses appelants. |
| La timeline web s'aligne sur iOS : un mois qui ne porte qu'un retrait reste affiché                              | L'inverse (masquer ces lignes sur iOS aussi) rendrait invisible la chute du cumul que PUL-329 vient d'introduire. Revenir dessus plus tard veut dire retoucher les deux clients et le contrat du calculateur. |
