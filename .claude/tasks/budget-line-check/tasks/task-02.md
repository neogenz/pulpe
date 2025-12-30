# Task: Créer l'endpoint API pour cocher/décocher une ligne

## Problem
Le frontend a besoin d'un endpoint pour basculer le statut coché d'une ligne budgétaire.

## Proposed Solution
Ajouter un endpoint POST `/v1/budget-lines/:id/toggle-check` qui toggle le champ `checked_at`. Si `null` → met `now()`, si non-null → met `null`.

## Dependencies
- Task #1: Le champ `checked_at` doit exister en DB

## Context

### Structure backend existante
- **Controller**: `backend-nest/src/modules/budget-line/budget-line.controller.ts`
- **Service**: `backend-nest/src/modules/budget-line/budget-line.service.ts`
- **Mappers**: `backend-nest/src/modules/budget-line/budget-line.mappers.ts`
- **DTOs**: `backend-nest/src/modules/budget-line/dto/budget-line-swagger.dto.ts`

### Endpoints existants
- `GET /v1/budget-lines/budget/:budgetId` - Liste
- `POST /v1/budget-lines` - Création
- `PATCH /v1/budget-lines/:id` - Mise à jour
- `POST /v1/budget-lines/:id/reset-from-template` - Reset template
- `DELETE /v1/budget-lines/:id` - Suppression

### Pattern à suivre (reset-from-template)
```typescript
// Controller
@Post(':id/toggle-check')
@ApiOperation({ summary: 'Toggle check state of a budget line' })
@ApiParam({ name: 'id', description: 'Budget line ID' })
@ApiResponse({ status: 200, type: BudgetLineResponseDto })
async toggleCheck(
  @Param('id') id: string,
  @User() user: AuthenticatedUser,
  @SupabaseClient() supabase: AuthenticatedSupabaseClient,
): Promise<BudgetLineResponse> {
  return this.budgetLineService.toggleCheck(id, user, supabase);
}

// Service
async toggleCheck(
  id: string,
  user: AuthenticatedUser,
  supabase: AuthenticatedSupabaseClient,
): Promise<BudgetLineResponse> {
  const budgetLine = await this.fetchBudgetLineById(id, user, supabase);

  const updateData = {
    checked_at: budgetLine.checked_at ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const updatedBudgetLine = await this.updateBudgetLineInDb(
    id, updateData, supabase, user
  );

  return {
    success: true,
    data: budgetLineMappers.toApi(updatedBudgetLine),
  };
}
```

### Error handling
Utiliser les définitions existantes:
- `ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND` (404)
- `ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED` (500)

### Fichiers à modifier
1. `backend-nest/src/modules/budget-line/budget-line.controller.ts` - Ajouter endpoint
2. `backend-nest/src/modules/budget-line/budget-line.service.ts` - Ajouter méthode `toggleCheck()`

## Success Criteria
- [ ] Endpoint `POST /v1/budget-lines/:id/toggle-check` accessible
- [ ] Toggle fonctionne : null → date, date → null
- [ ] RLS vérifie que l'utilisateur est propriétaire du budget
- [ ] Réponse retourne la ligne mise à jour avec `checkedAt`
- [ ] Tests backend passent
