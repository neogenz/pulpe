# Implementation Plan: Suivi des lignes budgétaires réalisées

## Overview

Ajouter la possibilité de cocher/décocher des lignes budgétaires pour marquer leur réalisation, avec affichage de la date et calcul d'un solde réalisé distinct du solde prévisionnel.

**Décisions utilisateur:**
- Format date: `dd.MM` (cohérent projet, ex: "15.01")
- Position solde réalisé: Nouvelle ligne dédiée sous le tableau
- Endpoint: `PATCH /budget-lines/:id/check` dédié

## Dependencies

Ordre strict d'implémentation:
1. Migration DB → Types auto-générés
2. Schéma Zod → Types partagés
3. Backend service/controller → API disponible
4. Frontend data layer → Modèles prêts
5. Frontend UI → Affichage fonctionnel

## File Changes

---

### Phase 1: Database & Types

#### `backend-nest/supabase/migrations/YYYYMMDDHHMMSS_add_checked_at_to_budget_line.sql` (CREATE)

- Action: Créer migration SQL pour ajouter colonne `checked_at`
- Contenu: `ALTER TABLE budget_line ADD COLUMN checked_at timestamp with time zone;`
- Note: Colonne nullable par défaut (null = non coché)
- Après création: Exécuter `supabase db push` localement

#### `backend-nest/src/types/database.types.ts` (AUTO-GENERATED)

- Action: Regénérer via `bun run generate-types:local`
- Vérification: Confirmer que `checked_at: string | null` apparaît dans Row, Insert, Update

---

### Phase 2: Shared Schemas & Formulas

#### `shared/schemas.ts`

- Action 1: Ajouter `checkedAt` au `budgetLineSchema` (ligne ~186)
  - Type: `z.iso.datetime().nullable()`
  - Position: Après `updatedAt`
- Action 2: Ne PAS ajouter à `budgetLineCreateSchema` (création = jamais coché)
- Action 3: Ne PAS ajouter à `budgetLineUpdateSchema` (endpoint dédié pour check)

#### `shared/src/calculators/budget-formulas.ts`

- Action 1: Étendre interface `FinancialItem` (ligne ~31)
  - Ajouter: `checkedAt?: string | null`
- Action 2: Ajouter méthode `calculateRealizedIncome` après `calculateTotalIncome` (~ligne 63)
  - Filtre: `items.filter(i => i.checkedAt !== null && i.kind === 'income')`
  - Pattern: Suivre `calculateTotalIncome` (lignes 49-62)
- Action 3: Ajouter méthode `calculateRealizedExpenses` après `calculateTotalExpenses` (~ligne 88)
  - Filtre: `items.filter(i => i.checkedAt !== null && (i.kind === 'expense' || i.kind === 'saving'))`
  - Pattern: Suivre `calculateTotalExpenses` (lignes 74-87)
- Action 4: Ajouter méthode `calculateRealizedBalance`
  - Formule: `realizedIncome - realizedExpenses`
- Action 5: Étendre `calculateAllMetrics` pour inclure `realizedBalance` dans le retour (~ligne 152)

#### `shared/src/calculators/budget-formulas.spec.ts` (si existe, sinon CREATE)

- Action: Ajouter tests pour les nouvelles méthodes
  - Test: `calculateRealizedIncome` avec lignes cochées et non cochées
  - Test: `calculateRealizedExpenses` idem
  - Test: `calculateRealizedBalance` avec mix revenus/dépenses cochés
  - Test: `calculateAllMetrics` retourne bien `realizedBalance`

---

### Phase 3: Backend API

#### `shared/schemas.ts` (complément)

- Action: Ajouter schéma de réponse pour check endpoint
  - `budgetLineCheckResponseSchema` = `budgetLineSchema` (retourne la ligne mise à jour)

#### `backend-nest/src/modules/budget-line/budget-line.mappers.ts`

- Action: Ajouter mapping pour `checked_at` → `checkedAt`
- Pattern: Suivre les mappings existants (snake_case DB → camelCase API)
- Vérifier fonction `toApi` et `toApiList`

#### `backend-nest/src/modules/budget-line/budget-line.service.ts`

- Action 1: Ajouter méthode `toggleCheck` (~après ligne 382)
  - Signature: `async toggleCheck(id: string, checked: boolean, user: AuthenticatedUser, supabase: AuthenticatedSupabaseClient): Promise<BudgetLineResponse>`
  - Logique:
    - Si `checked === true`: `checked_at = new Date().toISOString()`
    - Si `checked === false`: `checked_at = null`
  - Utiliser `updateBudgetLineInDb` existant (ligne 310)
  - Pas de recalcul de balances (checked_at n'affecte pas les totaux prévisionnels)

#### `backend-nest/src/modules/budget-line/dto/budget-line-swagger.dto.ts`

- Action 1: Ajouter `checkedAt` au `BudgetLineResponseDto`
  - Type: `@ApiProperty({ type: String, nullable: true, format: 'date-time' })`
- Action 2: Créer `BudgetLineCheckDto` pour le body de la requête check
  - Propriété: `checked: boolean`

#### `backend-nest/src/modules/budget-line/budget-line.controller.ts`

- Action: Ajouter endpoint `PATCH :id/check` (~après ligne 150)
  - Décorateurs: `@Patch(':id/check')`, `@ApiOperation`, `@ApiResponse`
  - Body: `BudgetLineCheckDto` avec propriété `checked: boolean`
  - Pattern: Suivre `resetFromTemplate` (lignes 152-182)
  - Appeler: `this.budgetLineService.toggleCheck(id, dto.checked, user, supabase)`

---

### Phase 4: Frontend Data Layer

#### `frontend/projects/webapp/src/app/core/budget/budget.api.ts` (ou équivalent)

- Action: Ajouter méthode `checkBudgetLine(id: string, checked: boolean)`
- Pattern: Suivre les autres méthodes API du fichier
- Endpoint: `PATCH /v1/budget-lines/:id/check`
- Body: `{ checked: boolean }`

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-models.ts`

- Action: Ajouter à `TableItem.metadata` (ligne ~41)
  - Propriété: `isChecked?: boolean`
  - Propriété: `checkedAt?: string | null`
- Consider: Ces propriétés viennent de `BudgetLine.checkedAt`

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-data-provider.ts`

- Action: Mapper `checkedAt` vers `metadata.isChecked` et `metadata.checkedAt`
- Logique: `isChecked: !!budgetLine.checkedAt`
- Pattern: Suivre le mapping existant pour `isLoading`, `isRollover`, etc.

#### `frontend/projects/webapp/src/app/core/budget/budget-calculator.ts`

- Action: Ajouter méthode `calculateRealizedBalance`
- Déléguer à: `BudgetFormulas.calculateRealizedBalance`
- Pattern: Suivre `calculatePlannedIncome` (ligne ~15)

---

### Phase 5: Frontend UI - budget-table

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`

- Action 1: Importer `MatCheckboxModule` si pas déjà fait
- Action 2: Ajouter output `checkBudgetLine = output<{ id: string; checked: boolean }>()`
- Action 3: Ajouter checkbox dans colonne "actions" (desktop, ~ligne 494-592)
  - Template: `<mat-checkbox [checked]="row.metadata.isChecked" (change)="onCheck(row, $event.checked)" (click)="$event.stopPropagation()" aria-label="Marquer comme réalisé"></mat-checkbox>`
  - Position: Avant le menu d'actions existant
- Action 4: Ajouter checkbox dans vue mobile (cards, ~ligne 82-200)
  - Même pattern que desktop
- Action 5: Ajouter méthode `onCheck(item: BudgetLineTableItem, checked: boolean)`
  - Émettre: `this.checkBudgetLine.emit({ id: item.data.id, checked })`
- Action 6: Ajouter styling conditionnel pour ligne cochée
  - Sur `<tr>` desktop (ligne ~602): `[class.opacity-60]="row.metadata.isChecked" [class.line-through]="row.metadata.isChecked"`
  - Sur card mobile (ligne ~132): Même pattern
- Action 7: Afficher date de coche si présente
  - Template: `@if (row.metadata.checkedAt) { <span class="text-xs text-gray-500 ml-2">{{ row.metadata.checkedAt | date:'dd.MM':'':'fr-CH' }}</span> }`
  - Position: Près du checkbox
- Action 8: Ajouter ligne "Solde réalisé" sous le tableau
  - Template: Nouvelle `<div>` après `</table>` avec computed `realizedBalance()`
  - Styling: Distinguer visuellement du solde prévisionnel (couleur différente, label "Réalisé:")
- Action 9: Ajouter computed signal pour solde réalisé
  - `readonly realizedBalance = computed(() => this.#budgetCalculator.calculateRealizedBalance(this.budgetLines()))`

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details.ts` (ou parent component)

- Action: Connecter l'output `checkBudgetLine` au store/service
- Pattern: Suivre comment `updateBudgetLine`, `deleteBudgetLine` sont connectés
- Appeler: API check puis rafraîchir les données

---

### Phase 6: Frontend UI - current-month

#### `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts`

- Action 1: Décommenter le mat-checkbox existant (lignes ~59-64)
- Action 2: Adapter le binding
  - `[checked]="!!data().checkedAt"`
  - `(change)="onCheck($event.checked)"`
- Action 3: Ajouter output `check = output<boolean>()`
- Action 4: Ajouter méthode `onCheck(checked: boolean)` qui émet l'output
- Action 5: Ajouter styling conditionnel
  - `[class.opacity-60]="!!data().checkedAt"`
  - `[class.line-through]="!!data().checkedAt"` (sur le texte, pas les montants)
- Action 6: Afficher date si cochée
  - `@if (data().checkedAt) { {{ data().checkedAt | date:'dd.MM':'':'fr-CH' }} }`

#### `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

- Action 1: Mapper `checkedAt` dans FinancialEntryModel (lignes ~257-269)
- Action 2: Connecter l'output `check` des financial-entry au store
- Action 3: Ajouter affichage du solde réalisé
  - Position: Sous la progress bar ou dans le header
  - Template: `<div class="realized-balance">Solde réalisé: {{ realizedBalance() | currency:'CHF' }}</div>`
- Action 4: Ajouter computed `realizedBalance` dans le component

---

### Phase 7: Store/State Management

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details.store.ts` (ou équivalent)

- Action 1: Ajouter méthode `checkBudgetLine(id: string, checked: boolean)`
- Action 2: Implémenter optimistic update
  - Mettre à jour immédiatement `checkedAt` localement
  - Appeler API
  - Rollback si erreur
- Pattern: Suivre les autres mutations du store

#### `frontend/projects/webapp/src/app/feature/current-month/store/current-month.store.ts` (ou équivalent)

- Action: Même pattern que budget-details store pour la méthode check

---

## Testing Strategy

### Backend Tests

#### `backend-nest/src/modules/budget-line/budget-line.service.spec.ts`

- Test: `toggleCheck` met à jour `checked_at` correctement
- Test: `toggleCheck` avec `checked: false` remet `checked_at` à null
- Test: `toggleCheck` sur ligne inexistante retourne 404

#### `backend-nest/src/modules/budget-line/budget-line.controller.spec.ts`

- Test: `PATCH :id/check` avec body valide
- Test: `PATCH :id/check` avec body invalide (400)

### Frontend Tests

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.spec.ts`

- Test: Checkbox affiche état correct (coché/non coché)
- Test: Click sur checkbox émet l'output avec bonnes valeurs
- Test: Ligne cochée a le style opacity-60 et line-through
- Test: Date s'affiche au bon format quand cochée

#### `shared/src/calculators/budget-formulas.spec.ts`

- Test: `calculateRealizedIncome` filtre correctement
- Test: `calculateRealizedExpenses` filtre correctement
- Test: `calculateRealizedBalance` calcule correctement

### Manual Verification

1. Créer un budget avec plusieurs lignes (revenus, dépenses, épargnes)
2. Cocher une ligne → vérifier style + date affichée
3. Décocher une ligne → vérifier retour style normal + date supprimée
4. Vérifier solde réalisé dans budget-table (sous le tableau)
5. Vérifier solde réalisé dans current-month
6. Tester sur mobile (responsive)

---

## Rollout Considerations

### Migration

- Migration DB est additive (nouvelle colonne nullable)
- Pas de breaking change API (nouveau endpoint)
- Rétrocompatibilité: lignes existantes ont `checked_at = null`

### Performance

- `calculateRealizedBalance` doit être memoized (computed signal)
- Pas de requête DB supplémentaire (checkedAt vient avec les données existantes)

### Feature Flag

- Non nécessaire (feature additive, pas de changement de comportement existant)

---

## Summary

| Phase | Fichiers | Complexité |
|-------|----------|------------|
| 1. DB | 1 migration | Simple |
| 2. Shared | schemas.ts, budget-formulas.ts | Moyenne |
| 3. Backend | service, controller, dto, mappers | Moyenne |
| 4. Frontend Data | models, data-provider, calculator | Simple |
| 5. Budget-table | budget-table.ts | Complexe |
| 6. Current-month | financial-entry.ts, current-month.ts | Moyenne |
| 7. Store | stores budget + current-month | Moyenne |

**Estimation totale**: ~15-20 fichiers à modifier/créer
