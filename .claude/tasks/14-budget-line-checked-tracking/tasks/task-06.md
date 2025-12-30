# Task: Budget-table UI - Checkbox et Styling

## Problem

Le composant budget-table n'affiche pas de checkbox pour marquer les lignes comme réalisées. Les utilisateurs ne peuvent pas cocher leurs lignes budgétaires ni voir visuellement lesquelles sont réalisées.

## Proposed Solution

Ajouter un checkbox Material dans la colonne actions de chaque ligne budgétaire, avec styling visuel pour les lignes cochées (opacity réduite + texte barré) et affichage de la date de coche.

## Dependencies

- Task #5: Frontend Data Layer (modèles et services prêts)

## Context

- Composant: `frontend/.../budget-table/budget-table.ts`
- Colonne actions desktop: lignes 494-592
- Vue mobile (cards): lignes 82-200
- Pattern opacity existant: `[class.opacity-50]="row.metadata.isLoading"` (ligne 602)
- Pattern mat-checkbox projet: `frontend/.../onboarding/steps/registration.ts:97-122`
- Format date projet: `dd.MM` avec locale `fr-CH`

## Success Criteria

- Checkbox visible dans zone actions (desktop et mobile)
- Output `checkBudgetLine = output<{ id: string; checked: boolean }>()` créé
- Méthode `onCheck(item, checked)` émet l'output
- Lignes cochées: `opacity-60` + `line-through` appliqués
- Date affichée au format `dd.MM` si ligne cochée
- Aria-label pour accessibilité
- Click sur checkbox ne déclenche pas d'autres actions (stopPropagation)
