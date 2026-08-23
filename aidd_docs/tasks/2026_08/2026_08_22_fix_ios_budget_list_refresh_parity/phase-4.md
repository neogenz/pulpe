---
status: done
---

# Instruction: Isoler les publications périmées et dédupliquer les ajouts
## Architecture projection
`ios/Pulpe/Domain/Store/{BudgetListStore,CurrentMonthStore}.swift` · tests de store existants
## Tasks to do
| # | Task |
| - | ---- |
| 1 | Conditionner chargement, publication et erreurs de la liste à la génération courante. |
| 2 | Remplacer par identifiant avant d'ajouter une transaction au budget courant. |
## Test acceptance criteria
| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | L'ancien fetch terminé laisse le nouveau en chargement et ne publie aucune erreur. |
| 2 | Nil/mismatch restent absents ; deux callbacks du même identifiant produisent un seul élément et notifient chaque mutation. |
