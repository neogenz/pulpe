---
objective: "Un pointage qui n'a rien fait ne déclenche plus le toast de confirmation : les trois mutations de pointage distinguent « appliqué » de « ignoré »."
status: implemented
---

# Plan: Distinguer le no-op du succès sur les mutations de pointage

## Overview

| Field      | Value                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | `toggleCheck`, `toggleTransactionCheck` et `checkAllAllocatedTransactions` rendent un résultat à trois états au lieu de `string \| null` |
| **Source** | Fil de revue claude[bot] sur [`budget-items-container.ts:703`](https://github.com/neogenz/pulpe/pull/570#discussion_r3701737785) — leurs gardes rendent `null`, que l'appelant lit comme un succès |

## Problème

Les trois méthodes portent une garde silencieuse (`#mutatingIds`, `!details`, ligne inconnue, rien à pointer) qui sort en `return null`. `null` est aussi la valeur du succès, donc l'appelant affiche `#showEnvelopeSnackbar` / `#showTransactionSnackbar` pour une action qui n'a pas eu lieu.

Les 14 autres mutations du store gardent `Promise<string | null>` : elles n'ont pas de garde no-op, `null` y signifie sans ambiguïté « c'est passé ». Le contrat n'est élargi que là où il ment.

## Phases

| #   | Phase                                                            | File                         |
| --- | ---------------------------------------------------------------- | ---------------------------- |
| 1   | Rendre le no-op visible depuis l'appelant                        | [`phase-1.md`](./phase-1.md) |

## Hors périmètre

- Migrer les 14 autres mutations vers le même type. Elles n'ont pas de garde no-op ; le jour où l'une en gagne une, elle rejoindra ce type.
- Le découpage de `budget-details-store.ts` (1481 lignes contre un plafond de 300), déjà noté hors périmètre dans la revue précédente.
