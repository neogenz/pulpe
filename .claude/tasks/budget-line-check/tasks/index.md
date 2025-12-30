# Tasks: Budget Line Check (Suivi des lignes réalisées)

## Overview
Permettre aux utilisateurs de cocher/décocher les lignes budgétaires pour marquer qu'elles ont été réellement effectuées, avec affichage de la date et calcul d'un solde réalisé.

## Task List

- [x] **Task 1**: Ajouter le champ checked_at en DB - `task-01.md`
- [x] **Task 2**: Créer l'endpoint API toggle - `task-02.md` (dépend de Task 1)
- [x] **Task 3**: Ajouter la checkbox UI - `task-03.md` (dépend de Task 2)
- [x] **Task 4**: Style visuel lignes cochées - `task-04.md` (dépend de Task 3)
- [x] **Task 5**: Calcul du solde réalisé - `task-05.md` (dépend de Task 1)
- [x] **Task 6**: Afficher solde dans budget-table - `task-06.md` (dépend de Tasks 3, 5)
- [x] **Task 7**: Afficher solde dans current-month - `task-07.md` (dépend de Tasks 3, 5)

## Execution Order

```
Task 1 (DB)
    ├── Task 2 (API) → Task 3 (Checkbox UI) → Task 4 (Styles)
    │                         │
    └── Task 5 (Calcul) ──────┼── Task 6 (Solde budget-table)
                              └── Task 7 (Solde current-month)
```

### Parallélisation possible
- **Phase 1** : Task 1 seule (fondation)
- **Phase 2** : Tasks 2 et 5 en parallèle
- **Phase 3** : Task 3 (après Task 2)
- **Phase 4** : Tasks 4, 6, 7 en parallèle (après Task 3 et 5)

## User Stories Coverage

| User Story | Tasks |
|------------|-------|
| US-1: Cocher une ligne | Tasks 1, 2, 3 |
| US-2: Décocher une ligne | Tasks 2, 3 |
| US-3: Afficher la date | Task 4 |
| US-4: Solde dans budget-table | Tasks 5, 6 |
| US-5: Solde dans current-month | Tasks 5, 7 |
