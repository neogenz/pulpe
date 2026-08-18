---
objective: "Sur /calculateur-budget, chaque poste ajouté par une puce apparaît comme une ligne nommée, éditable et retirable, et le disponible ne compte chaque poste qu’une fois."
status: in-progress
---

# Plan: retaper le calculateur landing en lignes nommées

## Overview

| Field      | Value                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Remplacer les seaux invisibles `extra`/`savings` par le même contrat que l’onboarding : une puce bascule une ligne nommée, visible, éditable, retirable.       |
| **Source** | Texte utilisateur du 18 août 2026 + capture de `/calculateur-budget` : les puces « Ajouter d’un geste » bougent le disponible sans aucune ligne à éditer. |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Modèle : lignes nommées à la place des seaux | [`phase-1.md`](./phase-1.md) |
| 2   | Formulaire : rangées visibles et puces toggle | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                                          | Verified                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [landing/DESIGN.md](../../../../landing/DESIGN.md)                                              | Cibles tactiles min-h-11, déficit en `accent` pas en rouge, registre tu, apostrophe suisse.       |
| Onboarding web `complete-profile-store.ts` (`toggleSuggestion`)                                 | Identité = id de puce, pas le nom ni le montant ; re-tap retire ; édition du montant ne duplique pas. |
| Onboarding iOS `OnboardingState+Suggestions.swift`                                              | Mêmes montants (600 / 150 / 100 / 500 / 587) ; label pilier CHF « 3ème pilier », EUR « Épargne retraite ». |
| [formula-mirrors-ts-swift.md](../../../../.claude/rules/00-architecture/formula-mirrors-ts-swift.md) | Le calculateur landing n’est pas une formule `shared/` : pas de jumeau Swift.                     |

## Decisions

| Decision                                                                                                                                 | Why                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Une puce insère ou retire une ligne `{ id, label, kind, amount }`. Plus aucun accumulateur `extra` / `savings`.                          | C’est exactement le bug : un montant sans objet. Revenir aux seaux recréerait l’invisibilité.            |
| Identité de puce = `id` stable (comme `__suggestionId` onboarding). Un second tap retire la ligne, il n’additionne pas.                  | Un tap répété gonfle aujourd’hui le disponible sans que l’utilisateur puisse le voir.                    |
| Pas de « ajouter une ligne libre » sur la landing.                                                                                       | Lead magnet d’un mois, pas l’onboarding. Les sept champs fixes + cinq puces suffisent.                   |
