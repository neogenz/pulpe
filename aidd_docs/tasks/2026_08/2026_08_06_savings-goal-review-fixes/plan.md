---
objective: "Les quatre défauts relevés par la revue du retrait annoncé sont corrigés : une source orpheline ne se déguise plus en réalisation, le panneau de détail dit d'où vient l'argent, le verrou de saisie du simulateur distingue ses deux champs, et le contrat de mise à jour iOS ne porte plus de champ mort."
status: reviewed
---

# Plan: Correctifs de la revue du retrait annoncé

## Overview

| Field      | Value                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Solder les 4 findings de la revue (2 warning, 2 minor) sans rouvrir le périmètre de PUL-329 v2.                  |
| **Source** | [`../2026_08_05_planned-savings-goal-withdrawals/review.md`](../2026_08_05_planned-savings-goal-withdrawals/review.md) — verdict `changes-requested` du 2026-08-06. |

## Phases

| #   | Phase                                                                    | File                         |
| --- | ------------------------------------------------------------------------ | ---------------------------- |
| 1   | La source orpheline ne se déguise plus, et le détail dit d'où vient l'argent | [`phase-1.md`](./phase-1.md) |
| 2   | Le verrou de saisie du simulateur distingue ses deux champs                | [`phase-2.md`](./phase-2.md) |
| 3   | Le contrat de mise à jour iOS perd son champ mort                          | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision                                                                                                                 | Why                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resserrer `WithdrawalRealizationContext.goalId` de `string \| null` à `string`, plutôt que de seulement corriger la garde. | Tant que le type accepte `null`, rien n'empêche de rebrancher un jour le chemin orphelin — la garde redeviendrait décorative. Une fois le champ non-nullable, le compilateur tient la règle « une source orpheline n'est pas réalisable » à la place d'un commentaire. Aucun spec ne construit ce cas. |
| Deux drapeaux nommés (`setGlobalAmountInvalid` / `setMonthAmountInvalid`) plutôt qu'un `setAmountInvalid(source, isInvalid)`. | `clean-code.md` proscrit le paramètre-drapeau qui aiguille le comportement ; un discriminant `'global' \| 'month'` en est un, avec en prime une chaîne à mal taper. Deux setters explicites suppriment le besoin d'un `Set` et rendent impossible qu'un champ efface le refus de l'autre.              |
| Afficher la source dans le panneau de détail sans la rendre cliquable.                                                     | Aucune surface web ne la rend cliquable aujourd'hui — ni la carte, ni la cellule, ni l'édition. Ajouter la navigation ici créerait la seule surface web divergente pour un défaut qui ne la demande pas. Le composant porte déjà l'état orphelin et son libellé.                                       |
