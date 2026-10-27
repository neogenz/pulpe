---
objective: "Un utilisateur qui n'a jamais vu le tour sait ce qu'il crée avant d'ouvrir le formulaire, et le mot « transaction » a disparu de la surface web et iOS."
status: implemented
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: le verbe porte le temps, le nom porte la nature

## Overview

| Field      | Value                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre lisibles les deux natures — prévision (intention) et mouvement (fait) — que l'UI distingue aujourd'hui par le seul écran d'origine. |
| **Source** | Brief `/impeccable shape` confirmé en session, plus quatre décisions produit prises par l'utilisateur (voir Decisions).      |

## Phases

| #   | Phase                        | File                         |
| --- | ---------------------------- | ---------------------------- |
| 1   | Web — sweep lexical          | [`phase-1.md`](./phase-1.md) |
| 2   | Web — les deux formulaires   | [`phase-2.md`](./phase-2.md) |
| 3   | iOS — parité lexicale        | [`phase-3.md`](./phase-3.md) |
| 4   | iOS — les deux sheets        | [`phase-4.md`](./phase-4.md) |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision                                                                 | Why                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le verbe porte le temps, le nom porte la nature : « Prévoir une dépense » / « Noter une dépense ». | Une fois le temps et la nature séparés, « transaction » n'a plus de travail à faire. C'est ce qui rend sa disparition possible, et non l'inverse. Le porteur du verbe, lui, n'est pas figé : le titre d'abord, et si sa mutation se lit instable à l'écran, un titre fixe par écran avec le verbe sur le bouton de validation. La thèse tient dans les deux cas ; c'est la phase 2 qui tranche, au regard. |
| Aucun renommage dans le modèle, le wire, les types ou les tables.        | C'est une couche de présentation. `transaction` et `budget_line` restent les noms du domaine ; un renommage se propagerait à la DB, aux schémas Zod partagés et aux deux clients.            |
| « Mouvement » devient exclusif au côté événement, et ne sert que pour les collections. | Un mouvement est un déplacement d'argent ; une prévision est une intention. Le tour l'emploie aujourd'hui pour les deux, ce qui est la faute d'origine — c'est cette ligne qui se corrige.   |
| Le FAB de la homepage peut porter le verbe, y compris s'il s'étend.      | Décision révisée en session : l'occultation partielle du montant sous le FAB est acceptée. Un point d'entrée qui dit « Noter une dépense » vaut mieux qu'un « + » muet, puisque c'est le premier endroit où le verbe se lit. La forme est tranchée au regard en phase 2, comme le porteur du verbe. |
| Web et iOS livrent ensemble, en quatre commits et non en un.            | 49 chaînes web et 20 fichiers iOS qui divergeraient donneraient deux produits qui nomment différemment le même concept. Mais livrer ensemble interdit la divergence en production, pas la séquence : le web passe d'abord et se regarde, iOS suit une fois la structure vue à l'écran. Un commit par phase garde le repli chirurgical — le lexique et la structure ne voyagent jamais dans le même diff, et c'est la structure qui est risquée. |
