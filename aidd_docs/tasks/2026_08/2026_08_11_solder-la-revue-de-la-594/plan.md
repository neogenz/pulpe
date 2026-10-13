---
objective: "Le garde lexical couvre toute la copie affichée, le contour de carte n'a qu'un auteur, et chaque plan livré décrit l'écran livré."
status: implemented
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: solder la revue de la PR 594

## Overview

| Field      | Value                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Fermer les 13 findings de la revue de la PR 594 sans en laisser un seul en dette : chaque correctif traite la cause, pas le symptôme qui l'a révélée |
| **Source** | [`review.md`](../2026_08_09_vocabulaire-prevision-mouvement/review.md) — 0 critical, 6 warning, 7 minor                                              |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Le garde voit toute la copie affichée              | [`phase-1.md`](./phase-1.md) |
| 2   | Un seul auteur pour le contour de carte            | [`phase-2.md`](./phase-2.md) |
| 3   | Les fixtures de spread ne laissent plus de nu      | [`phase-3.md`](./phase-3.md) |
| 4   | La home dit la règle, plus le récit du défaut      | [`phase-4.md`](./phase-4.md) |
| 5   | Les plans décrivent ce qui a été livré             | [`phase-5.md`](./phase-5.md) |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le saut de `#Preview` passe de la ligne au bloc, et l'exemption de fichier disparaît.                           | Le garde déclare déjà l'intention — « un `#Preview` nomme une vignette du canvas Xcode, que l'app n'embarque pas » — mais ne saute que la ligne d'ouverture. `NOT_APP_COPY` est né de ce demi-saut : il exempte `WhatsNewSheet.swift` en entier pour taire une chaîne de vignette, en invoquant une note de version publiée qui ne vit pas dans ce fichier. Finir l'intention retire le besoin de l'exemption au lieu de l'entretenir. |
| Le contour est extrait en modifier propre, pas ajouté en paramètre à `pulpeRowCard()`.                          | Les trois sites manuels sont des cartes hero à 32pt et un squelette sans ombre ; `pulpeRowCard()` est une carte de ligne à 18pt qui porte toujours son ombre. Un paramètre de plus sur le modifier existant obligerait chaque appelant à désactiver ce qu'il ne veut pas. Le contour est la seule chose que les quatre partagent : c'est lui, et lui seul, qui devient partagé.                                                |
| « Déjà pointé » reste sur les deux formulaires de prévision ; ce sont les deux wireframes qui sont corrigés.    | Décision produit rendue en session. Web et iOS portent déjà le contrôle et sont d'accord entre eux, donc la parité — l'objectif du plan d'origine — est tenue. Le retirer casserait la saisie d'une prévision déjà passée sur le compte en un seul geste, pour aligner le code sur un croquis. Le croquis est le moins cher des deux à corriger, et c'est lui qui décrit un écran qui n'a jamais existé.                       |
| Les commentaires de la home sont élagués du récit, jamais de la règle.                                          | Un commentaire qui énonce l'invariant régissant encore le code se lit à chaque passage ; un commentaire qui raconte le défaut d'avant se lit une fois puis se contourne. À 25 % du fichier, le second noie le premier. La coupe porte sur la narration de symptôme, et aucun corps de `computed` ne bouge — c'est ce qui rend la phase vérifiable par les tests existants.                                                     |
| Le chantier « home » n'obtient pas de dossier de plan rétroactif.                                               | Écrire après coup les critères d'acceptation de 90 commits produirait un document calqué sur le diff : il ne prouverait rien, puisqu'il serait déduit de ce qui a été livré. La description de la PR dit à sa place d'où vient le travail, ce qui est la vérité vérifiable et coûte deux phrases.                                                                                                                             |
