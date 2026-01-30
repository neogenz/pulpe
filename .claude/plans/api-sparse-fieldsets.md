# Plan: Sparse Fieldsets pour l'API Budgets

## Contexte

### Problème actuel
Le dashboard iOS utilise `GET /budgets/export` qui retourne **TOUS** les budgets avec **TOUTES** leurs données (transactions, budget_lines) juste pour afficher :
- **Trends** : 3 mois de totaux agrégés
- **Épargne YTD** : 1 nombre

**Impact** : ~50KB transférés au lieu de ~500 bytes nécessaires.

### Solution proposée
Implémenter les **sparse fieldsets** (JSON:API standard) pour permettre au client de demander uniquement les champs nécessaires.

---

## Spécification API

### Endpoint existant enrichi

```
GET /budgets?fields=month,year,totalExpenses,totalSavings&limit=12
```

### Paramètres

| Param | Type | Description |
|-------|------|-------------|
| `fields` | string | Champs à retourner (comma-separated) |
| `limit` | number | Nombre de budgets (défaut: tous) |
| `year` | number | Filtrer par année (pour YTD) |

### Champs disponibles

| Champ | Type | Calcul |
|-------|------|--------|
| `id` | string | Direct |
| `month` | number | Direct |
| `year` | number | Direct |
| `totalExpenses` | number | Agrégé (sum budget_lines + transactions where kind=expense) |
| `totalSavings` | number | Agrégé (sum where kind=saving) |
| `totalIncome` | number | Agrégé (sum where kind=income) |
| `remaining` | number | Calculé |
| `rollover` | number | Direct |

### Exemples d'utilisation

**Pour les trends (3 derniers mois):**
```
GET /budgets?fields=month,year,totalExpenses&limit=3
```

**Réponse:**
```json
{
  "success": true,
  "data": [
    { "id": "...", "month": 12, "year": 2025, "totalExpenses": 3800 },
    { "id": "...", "month": 1, "year": 2026, "totalExpenses": 3500 },
    { "id": "...", "month": 2, "year": 2026, "totalExpenses": 4200 }
  ]
}
```

**Pour l'épargne YTD:**
```
GET /budgets?fields=totalSavings&year=2026
```

**Réponse:**
```json
{
  "success": true,
  "data": [
    { "id": "...", "totalSavings": 500 },
    { "id": "...", "totalSavings": 600 },
    { "id": "...", "totalSavings": 400 }
  ]
}
```
→ Client fait la somme : 1500 CHF

---

## Implémentation Backend

### 1. DTO de requête

```typescript
// budget/dto/list-budgets-query.dto.ts
import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

const BudgetFieldsEnum = z.enum([
  'month', 'year', 'totalExpenses', 'totalSavings',
  'totalIncome', 'remaining', 'rollover'
]);

export const ListBudgetsQuerySchema = z.object({
  fields: z.string().optional(), // "month,year,totalExpenses"
  limit: z.coerce.number().min(1).max(36).optional(),
  year: z.coerce.number().min(2020).max(2100).optional(),
});

export class ListBudgetsQueryDto extends createZodDto(ListBudgetsQuerySchema) {}
```

### 2. Controller

```typescript
// budget.controller.ts
@Get()
async list(
  @Query() query: ListBudgetsQueryDto,
  @User() user: AuthenticatedUser,
  @SupabaseClient() supabase: AuthenticatedSupabaseClient,
) {
  return this.budgetService.list(user, supabase, query);
}
```

### 3. Service

```typescript
// budget.service.ts
async list(
  user: AuthenticatedUser,
  supabase: AuthenticatedSupabaseClient,
  query: ListBudgetsQueryDto,
): Promise<BudgetListResponse> {
  const requestedFields = query.fields?.split(',') ?? [];
  const needsAggregates = requestedFields.some(f =>
    ['totalExpenses', 'totalSavings', 'totalIncome', 'remaining'].includes(f)
  );

  // Fetch budgets with optional limit/year filter
  let budgetsQuery = supabase
    .from('monthly_budget')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (query.limit) {
    budgetsQuery = budgetsQuery.limit(query.limit);
  }
  if (query.year) {
    budgetsQuery = budgetsQuery.eq('year', query.year);
  }

  const { data: budgets } = await budgetsQuery;

  // Si agrégats demandés, calculer pour chaque budget
  if (needsAggregates) {
    return this.enrichWithAggregates(budgets, supabase, requestedFields);
  }

  // Sinon, retourner les champs demandés directement
  return this.projectFields(budgets, requestedFields);
}

private async enrichWithAggregates(
  budgets: Budget[],
  supabase: AuthenticatedSupabaseClient,
  fields: string[],
) {
  // Pour chaque budget, charger budget_lines + transactions
  // et calculer les agrégats demandés
  // Optimisation possible : batch query au lieu de N+1
}
```

### 4. Optimisation : Agrégats côté DB

Pour éviter de charger toutes les transactions, créer une **view SQL** :

```sql
CREATE VIEW budget_aggregates AS
SELECT
  mb.id,
  mb.month,
  mb.year,
  COALESCE(SUM(CASE WHEN bl.kind = 'expense' THEN bl.amount ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
  COALESCE(SUM(CASE WHEN bl.kind = 'saving' THEN bl.amount ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN t.kind = 'saving' THEN t.amount ELSE 0 END), 0) as total_savings,
  COALESCE(SUM(CASE WHEN bl.kind = 'income' THEN bl.amount ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE 0 END), 0) as total_income
FROM monthly_budget mb
LEFT JOIN budget_line bl ON bl.budget_id = mb.id
LEFT JOIN transaction t ON t.budget_id = mb.id
GROUP BY mb.id, mb.month, mb.year;
```

Puis query simple :
```typescript
const { data } = await supabase
  .from('budget_aggregates')
  .select('month, year, total_expenses')
  .order('year', { ascending: false })
  .limit(3);
```

---

## Implémentation iOS

### DashboardStore modifié

```swift
// DashboardStore.swift
func loadTrendsData() async {
    // Avant: exportAllBudgets() → charge tout
    // Après: appel léger
    let trends = try await budgetService.getTrends(months: 3)
    // trends = [{ month, year, totalExpenses }]
}

func loadSavingsYTD() async {
    let currentYear = Calendar.current.component(.year, from: Date())
    let savings = try await budgetService.getSavingsForYear(year: currentYear)
    // savings = [{ totalSavings }] → sum côté client
}
```

### BudgetService iOS

```swift
// BudgetService.swift
func getTrends(months: Int) async throws -> [MonthlyExpense] {
    // GET /budgets?fields=month,year,totalExpenses&limit=3
}

func getSavingsForYear(year: Int) async throws -> Decimal {
    // GET /budgets?fields=totalSavings&year=2026
    // → sum des résultats
}
```

---

## Migration

### Phase 1 : Backend (non-breaking)
1. Ajouter les query params `fields`, `limit`, `year` au endpoint existant
2. Si `fields` absent → comportement actuel (rétrocompatible)
3. Créer la view SQL pour les agrégats

### Phase 2 : iOS
1. Créer les nouvelles méthodes dans `BudgetService`
2. Modifier `DashboardStore` pour utiliser les nouveaux appels
3. Supprimer l'appel à `exportAllBudgets` pour le dashboard

### Phase 3 : Cleanup
1. Déprécier `exportAllBudgets` pour usage dashboard
2. Le garder uniquement pour l'export réel

---

## Bénéfices

| Métrique | Avant | Après |
|----------|-------|-------|
| Data transférée | ~50KB | ~500 bytes |
| Requêtes DB | N+1 (tous budgets) | 1 (view agrégée) |
| Temps réponse | ~500ms | ~50ms |
| RESTful | ✅ | ✅ (sparse fieldsets = standard) |

---

## Références

- [JSON:API Sparse Fieldsets](https://jsonapi.org/format/#fetching-sparse-fieldsets)
- [REST API Design: Filtering, Sorting, Paging](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Filtering-Sorting-and-Pagination/)
