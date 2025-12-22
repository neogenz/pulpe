# Task: Refactor TemplateLineStore to use private signals

## Problem

Le `TemplateLineStore` expose des signals publics **mutables** (`isLoading = signal(false)`, `error = signal<string | null>(null)`). C'est un anti-pattern critique car n'importe quel composant peut modifier l'état interne du store.

## Proposed Solution

Refactorer pour rendre les signals privés (`#isLoading`, `#error`) et exposer des computed read-only. Ajouter `hasValue` pour compléter l'API standard.

## Dependencies

- Aucune (peut démarrer immédiatement)

## Context

- Fichier: `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-line-store.ts`
- L28-29: Signals publics mutables (anti-pattern)
- Usages internes: L75, L152-154, L180, L183
- Pattern à suivre: `STATE-PATTERN.md` - private state signal + public computed

## Success Criteria

- Signals rendus privés (`#isLoading`, `#error`)
- Computed publics read-only ajoutés
- `hasValue` ajouté
- Usages internes mis à jour
- Tests vérifient que les signals ne sont plus mutables de l'extérieur
- `pnpm quality` passe
