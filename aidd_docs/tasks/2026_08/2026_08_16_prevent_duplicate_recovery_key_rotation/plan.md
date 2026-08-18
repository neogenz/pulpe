---
objective: "Une recovery key confirmée n'est jamais remplacée par un double submit ou un retry local, sans casser la reprise sûre d'une réponse setup perdue."
status: implemented
---

# Plan: Empêcher la rotation dupliquée de recovery key

## Overview

| Field      | Value                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Reproduire le protocole fautif en TDD, corriger le setup du coffre avec le minimum d'état local, puis verrouiller les deux chemins de retry par des tests unitaires et Playwright. |
| **Source** | Incident observé sur la preview officielle le 16 août 2026, corrélé aux requêtes backend, puis rapproché du flux `SetupVaultCode` et de son test de retry existant.                |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Reproduire et corriger la double soumission en TDD           | [`phase-1.md`](./phase-1.md) |
| 2   | Verrouiller le parcours navigateur et documenter l'invariant | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                                                          | Why                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinguer un retry dans le composant après confirmation de la clé d'une reprise fraîche après réponse `setup-recovery` inconnue. | Le navigateur est seul à savoir qu'une clé a déjà été affichée et confirmée. Dans ce cas il doit seulement terminer la metadata; après reload, la clé brute n'est plus disponible et la validation suivie d'une régénération reste la reprise sûre. |
| Corriger le composant existant sans endpoint, abstraction ni état persistant supplémentaires.                                     | Le backend respecte son contrat; le défaut vient du cycle de soumission frontend. Un garde single-flight, l'attente de la navigation et un indicateur privé de confirmation couvrent la cause à la frontière commune.                               |
