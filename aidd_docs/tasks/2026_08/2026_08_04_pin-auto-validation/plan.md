---
objective: "La saisie d'un code PIN se valide seule au dernier chiffre, avec un retour haptique distinct selon l'issue, sur les quatre écrans PIN."
status: in-progress
---

# Plan: Auto-validation du code PIN

## Overview

| Field      | Value                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| **Goal**   | Supprimer la touche « valider » du pavé PIN : la saisie part au dernier chiffre, avec haptique différenciée |
| **Source** | Demande orale — création et confirmation du code PIN, « ça s'auto-valide avec un petit retour haptique et un retour haptique différent si jamais ça correspond pas » |

## Phases

| #   | Phase                          | File                         |
| --- | ------------------------------ | ---------------------------- |
| 1   | Auto-validation et haptique    | [`phase-1.md`](./phase-1.md) |

## Decisions

| Decision                                                                                       | Why                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Étendre l'auto-validation aux quatre écrans PIN, pas seulement à la création                    | `NumpadView` est partagé. Faire disparaître la touche de validation sur un seul écran laisserait le même pavé se comporter de deux façons. Une fois les quatre écrans alignés, la touche devient du code mort. |
| Un impact ferme (`.impact(flexibility: .rigid)`) pour le passage d'étape, pas la triade succès  | La triade `.success` reste réservée à la fin de parcours. Trois sensations distinctes : tape douce à chaque chiffre, impact ferme au passage d'étape, buzz d'erreur quand les codes divergent.                 |
| Une temporisation courte entre le dernier chiffre et la transition                              | Sans elle, le dernier point se remplit et disparaît dans la même image : l'utilisateur ne voit jamais sa saisie complète. C'est le seul endroit où l'auto-validation peut sembler moins fiable que le bouton.  |
