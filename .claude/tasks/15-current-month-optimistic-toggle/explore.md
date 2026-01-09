# Task: Current Month - Optimistic Toggle + Replace Checkbox with Slide Toggle

## Problème Identifié

### 1. Rechargement de la page à chaque toggle de checkbox
À chaque sélection d'une case à cocher, la page `current-month` se recharge complètement car la méthode `toggleCheck` appelle `refreshData()`.

### 2. Demande de remplacement UI
Remplacer tous les `mat-checkbox` par des `mat-slide-toggle` dans la feature current-month.

---

## Codebase Context

### Cause racine du rechargement

**Fichier** : `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts:386-390`

```typescript
async toggleCheck(budgetLineId: string): Promise<void> {
  const apiUrl = `${this.#appConfig.backendApiUrl()}/budget-lines/${budgetLineId}/toggle-check`;
  await firstValueFrom(this.#httpClient.post(apiUrl, {}));
  this.refreshData();  // <-- PROBLÈME : recharge toutes les données !
}
```

### Pattern existant pour optimistic updates

Le store a déjà des méthodes pour les mises à jour optimistic :
- `#performOptimisticUpdate<T>()` - lignes 250-314
- `#performOptimisticUpdateDelete()` - lignes 319-380

Ces méthodes :
1. Sauvegardent les données originales pour rollback
2. Exécutent l'opération backend
3. Mettent à jour localement avec `this.#dashboardResource.set()`
4. Recalculent les métriques avec `BudgetFormulas`
5. Synchronisent avec le backend pour les valeurs précises
6. Rollback en cas d'erreur

### Fichiers utilisant mat-checkbox dans current-month

| Fichier | Lignes | Usage |
|---------|--------|-------|
| `financial-entry.ts` | 13, 37, 60-65 | Import + template checkbox |

### Flow actuel du toggle

1. `current-month.ts:445-454` → `handleToggleBudgetLineCheck(budgetLineId)`
2. → `store.toggleCheck(budgetLineId)`
3. → `current-month-store.ts:386-390` → POST API + `refreshData()` (reload complet)

---

## Documentation Insights

### Angular Material Slide Toggle

**Import** :
```typescript
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
```

**Template** :
```html
<mat-slide-toggle
  [checked]="isChecked"
  (change)="onToggle($event)"
  (click)="$event.stopPropagation()">
</mat-slide-toggle>
```

**Event** : `(change)` émet un `MatSlideToggleChange` avec `{ checked: boolean, source: MatSlideToggle }`

---

## Key Files

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `current-month-store.ts:386-390` | toggleCheck | Méthode à modifier pour optimistic update |
| `current-month-store.ts:80-82` | budgetLines | Computed signal des budget lines |
| `current-month-store.ts:170-174` | realizedBalance | Dépend de `checkedAt` des budget lines |
| `financial-entry.ts:13,37,60-65` | - | Import et usage mat-checkbox → mat-slide-toggle |
| `financial-entry.ts:241` | toggleCheck | Output pour émettre l'événement |
| `financial-accordion.ts:136` | toggleCheck | Relay de l'événement |

---

## Patterns to Follow

### 1. Optimistic Update Pattern (existant dans le store)

```typescript
async #performOptimisticUpdate<T>(
  operation: () => Observable<{ data: T }>,
  updateData: (currentData: DashboardData, response: { data: T }) => DashboardData,
): Promise<void> {
  const originalData = this.#dashboardResource.value();
  try {
    const response = await firstValueFrom(operation());
    const currentData = this.#dashboardResource.value();
    if (currentData && currentData.budget) {
      const updatedData = updateData(currentData, response);
      // Recalculate metrics locally
      const metrics = BudgetFormulas.calculateAllMetrics(...);
      this.#dashboardResource.set({...});
    }
  } catch (error) {
    // Rollback on error
    if (originalData) {
      this.#dashboardResource.set(originalData);
    }
    throw error;
  }
}
```

### 2. BudgetFormulas pour les calculs

```typescript
import { BudgetFormulas } from 'pulpe-shared';

// Calcul du solde réalisé (dépend de checkedAt)
BudgetFormulas.calculateRealizedBalance(budgetLines, transactions);
```

---

## Dependencies

- `@angular/material/slide-toggle` - MatSlideToggleModule
- `pulpe-shared` - BudgetFormulas pour recalcul local
- API endpoint existant : `POST /budget-lines/{id}/toggle-check`

---

## Implementation Strategy

### Étape 1 : Optimistic Update pour toggleCheck

Modifier `current-month-store.ts:toggleCheck()` pour :
1. Sauvegarder l'état original pour rollback
2. Mettre à jour localement le `checkedAt` de la budget line ciblée
3. Recalculer `realizedBalance` avec BudgetFormulas
4. Appeler l'API POST toggle-check
5. En cas d'erreur, rollback à l'état original

### Étape 2 : Remplacer mat-checkbox par mat-slide-toggle

Dans `financial-entry.ts` :
1. Changer l'import `MatCheckboxModule` → `MatSlideToggleModule`
2. Mettre à jour le template : `<mat-checkbox>` → `<mat-slide-toggle>`
3. Adapter les bindings si nécessaire

---

## Risques et Considérations

1. **Synchronisation** : En cas d'erreur API après mise à jour locale, le rollback doit restaurer l'état exact
2. **Calculs** : Le `realizedBalance` dépend de `checkedAt` - s'assurer que BudgetFormulas.calculateRealizedBalance fonctionne correctement avec les données locales modifiées
3. **UX** : Le slide-toggle a une taille différente du checkbox - vérifier le rendu mobile/desktop
