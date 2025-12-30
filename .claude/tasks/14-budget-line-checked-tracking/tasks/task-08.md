# Task: Current-month UI - Checkbox et Solde réalisé

## Problem

La page current-month n'affiche pas de checkbox pour les lignes budgétaires récurrentes et n'affiche pas le solde réalisé. Les utilisateurs doivent pouvoir marquer leurs opérations comme réalisées depuis cette vue également.

## Proposed Solution

Activer le checkbox existant (commenté) dans le composant financial-entry, connecter l'output au store, et ajouter l'affichage du solde réalisé dans la page current-month.

## Dependencies

- Task #5: Frontend Data Layer (API client, calculator)
- Task #6: Budget-table Checkbox (pattern à suivre)

## Context

- Financial-entry: `frontend/.../current-month/components/financial-entry.ts`
- Checkbox commenté: lignes 59-64 (déjà présent, à décommenter/adapter)
- Current-month: `frontend/.../current-month/current-month.ts`
- Mapping: lignes 257-269 (FinancialEntryModel)
- Pattern date existant: ligne 88 `{{ data().createdAt | date: 'dd.MM.yyyy' : '' : 'fr-CH' }}`

## Success Criteria

- Checkbox fonctionnel dans financial-entry
- Output `check = output<boolean>()` créé
- Styling conditionnel: `opacity-60` + `line-through` si coché
- Date de coche affichée au format `dd.MM`
- Current-month: mapping `checkedAt` dans FinancialEntryModel
- Current-month: connexion output check au store/API
- Current-month: affichage solde réalisé (computed signal)
