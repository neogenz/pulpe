---
objective: "La PR #522 rend chaque commande de publication autonome et sûre, distingue explicitement une projection iOS omise d'une release silencieuse, valide toutes les versions What's New et exécute les tests de contrat avant le commit de release."
status: in-progress
---

# Plan: Fermer les gaps adversariaux du workflow release

## Overview

| Field      | Value                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Corriger les quatre défauts confirmés sans élargir le modèle de release                                            |
| **Source** | Review adversariale fournie le 2026-07-20 et vérifiée contre la branche `maximedesogus/whats-new-ios-contract` |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Rendre chaque bloc de publication sûr et autonome            | [`phase-1.md`](./phase-1.md) |
| 2   | Enregistrer explicitement les releases iOS silencieuses      | [`phase-2.md`](./phase-2.md) |
| 3   | Valider la version affichée par le toast                      | [`phase-3.md`](./phase-3.md) |
| 4   | Exécuter les contrats What's New avant le commit de release  | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision                                                                 | Why                                                                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Conserver un registre iOS silencieux versionné à côté des projections    | Le mode `silent` reste légitime, mais son absence de projection doit être explicite, motivée et vérifiable dans le temps |
| Considérer chaque bloc shell du Step 9 comme une nouvelle session         | Les agents et shells ne garantissent pas la persistance des variables entre deux appels d'outil                         |
