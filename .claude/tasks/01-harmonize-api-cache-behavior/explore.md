# Task: Harmoniser le comportement de cache API entre les pages du menu

## Problème Signalé

L'utilisateur observe une incohérence dans les appels API lors de la navigation entre les pages:
- **Budget Template** : pas de nouvel appel (utilise le cache)
- **Current Months** : pas de nouvel appel (utilise le cache)
- **App Budget (Mes budgets)** : refait un appel API systématique

## Cause Racine

### Le Coupable: `BudgetListPage` (ligne 171)

Le composant `BudgetListPage` appelle explicitement `this.state.refreshData()` dans son constructeur:

```typescript
// budget-list-page.ts:169-171
constructor() {
  // Refresh data on init
  this.state.refreshData();
  // ...
}
```

Cette méthode force un `reload()` de la resource qui appelle `getAllBudgets$()`:

```typescript
// budget-list-store.ts:157-160
refreshData(): void {
  if (!this.isLoading()) {
    this.budgets.reload();
  }
}
```

### Pourquoi les autres pages n'ont pas ce problème

1. **Current Month** : Le `CurrentMonthStore` utilise aussi `resource()` mais sans appel explicite à `reload()` dans le composant - la resource charge les données une seule fois à l'initialisation.

2. **Budget Templates** : Utilise `BudgetTemplatesState` qui n'appelle pas du tout `BudgetApi` - c'est une API séparée.

### Le Guard n'est pas responsable

Le `hasBudgetGuard` fonctionne correctement:
- Fast path (ligne 24): utilise le cache si disponible
- Slow path (ligne 34): appel API uniquement si cache `null`

Le cache est pré-chargé au login (auth-api.ts:155) et reste valide pendant la session.

## Codebase Context

### Architecture des Routes

Toutes les routes protégées utilisent le même pattern:

```typescript
// app.routes.ts
{
  path: ROUTES.CURRENT_MONTH,    // ligne 55
  canActivate: [hasBudgetGuard],
  loadChildren: () => import('./feature/current-month/current-month.routes'),
},
{
  path: ROUTES.BUDGET,          // ligne 63
  canActivate: [hasBudgetGuard],
  loadChildren: () => import('./feature/budget/budget.routes'),
},
{
  path: ROUTES.BUDGET_TEMPLATES, // ligne 70
  canActivate: [hasBudgetGuard],
  loadChildren: () => import('./feature/budget-templates/budget-templates.routes'),
},
```

### Providers au niveau des Routes

Les stores sont fournis au niveau de la route, donc recréés à chaque navigation:

```typescript
// budget.routes.ts:10
providers: [BudgetListStore],

// current-month.routes.ts:8
providers: [CurrentMonthStore],

// budget-templates.routes.ts:10-13
providers: [BudgetTemplatesApi, BudgetTemplatesState, TransactionFormService],
```

### Méthodes API qui mettent à jour le cache

Seules certaines méthodes de `BudgetApi` mettent à jour le `HasBudgetCache`:

```typescript
// budget-api.ts:89
getAllBudgets$(): Observable<Budget[]> {
  return this.#httpClient.get<unknown>(this.#apiUrl).pipe(
    map((response) => {
      const budgets = budgetListResponseSchema.parse(response).data;
      this.#hasBudgetCache.setHasBudget(budgets.length > 0);  // <-- auto-sync
      return budgets;
    }),
  );
}

// budget-api.ts:105-120
checkBudgetExists$(): Observable<boolean> {
  // ... aussi auto-sync
}
```

Les autres méthodes (`getBudgetForMonth$`, `getBudgetById$`) ne mettent PAS à jour le cache.

## Key Files

| Fichier | Ligne | Rôle |
|---------|-------|------|
| `budget-list-page.ts` | 171 | Appel `refreshData()` qui force reload |
| `budget-list-store.ts` | 157-160 | Méthode `refreshData()` qui reload la resource |
| `budget-list-store.ts` | 26-28 | Définition de la resource avec `getAllBudgets$` |
| `budget-api.ts` | 85-99 | `getAllBudgets$` avec auto-sync du cache |
| `current-month-store.ts` | 72-84 | Resource sans reload forcé |
| `has-budget.guard.ts` | 15-48 | Guard avec fast/slow path |
| `has-budget-cache.ts` | 1-32 | Service de cache singleton |

## Options de Correction

### Option A: Supprimer le `refreshData()` de BudgetListPage

La `resource()` charge déjà les données automatiquement à l'initialisation. Le `refreshData()` explicite est redondant et cause le double appel.

**Fichier**: `budget-list-page.ts:171`
**Action**: Supprimer la ligne `this.state.refreshData();`

**Impact**: Comportement cohérent - toutes les pages utilisent le cache de leur resource.

### Option B: Ajouter `refreshData()` aux autres pages

Si le comportement souhaité est de toujours rafraîchir les données à chaque navigation.

**Fichiers à modifier**:
- `current-month.ts`: ajouter `this.store.refreshData()` dans le constructeur
- `template-list-page.ts`: ajouter refresh équivalent

**Impact**: Plus d'appels API mais données toujours fraîches.

### Recommandation

**Option A** est préférable:
1. Moins d'appels API (meilleure UX)
2. La resource d'Angular gère déjà le chargement initial
3. L'utilisateur peut toujours forcer un refresh via un bouton si nécessaire

## Dependencies

- Le `HasBudgetCache` est correctement pré-chargé au login
- Le guard fonctionne comme prévu
- Aucun changement nécessaire au système de cache

## Blockers

Aucun bloquant identifié. La correction est simple et localisée.
