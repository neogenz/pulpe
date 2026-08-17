---
objective: "Les résumés de consommation Web affichent un dépassement et un disponible cohérents jusque dans les centimes, sans modifier les calculs financiers."
status: implemented
---

# Plan: Corriger le dépassement arrondi à zéro

## Overview

| Field      | Value                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Empêcher qu'une prévision réellement dépassée affiche simultanément un disponible nul et « Dépassé de 0 CHF ».                                                                                                                                                      |
| **Source** | [PUL-335](https://linear.app/pulpe/issue/PUL-335/corriger-les-depassements-de-prevision-arrondis-a-0-chf), demande utilisateur du 17 août 2026 et captures `Screenshot_20260817_090848_Samsung Browser.png` / `Screenshot_20260817_090912_Samsung Browser (2).png`. |

## Phases

| #   | Phase                                                          | File                         |
| --- | -------------------------------------------------------------- | ---------------------------- |
| 1   | Aligner l'état et la précision des résumés de consommation Web | [`phase-1.md`](./phase-1.md) |

## Resources

| Source                                                                                                                 | Verified                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PUL-276](https://linear.app/pulpe/issue/PUL-276/harmoniser-laffichage-des-decimales-des-montants-dans-toute-lapp-web) | La politique livrée garde les agrégats à zéro décimale ; ce bug nécessite une exception adaptative limitée aux montants qui déterminent l'état d'une prévision. |

## Decisions

| Decision                                                                                                                          | Why                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Afficher adaptativement sur 0 à 2 décimales les montants `consumed`, `remaining` et `exceededBy` comparés au sein d'une prévision | Une différence non nulle ne doit jamais devenir un faux zéro au moment même où elle déclenche l'état « dépassé » ; les montants ronds restent sans bruit décimal. |
