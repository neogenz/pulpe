# Plan: Validation Zod sur toutes les réponses API

## Objectif

Ajouter une validation runtime Zod sur toutes les réponses HTTP pour garantir que les données reçues du backend correspondent au contrat attendu.

## Scope

| Fichier | Méthodes à valider | Schémas Zod requis |
|---------|-------------------|-------------------|
| `budget-api.ts` | 7 | `budgetResponseSchema`, `budgetListResponseSchema`, `budgetDetailsResponseSchema`, `budgetExportResponseSchema` |
| `template-api.ts` | 3 | `budgetTemplateListResponseSchema`, `budgetTemplateResponseSchema`, `templateLineListResponseSchema` |
| `transaction-api.ts` | 5 | `transactionListResponseSchema`, `transactionResponseSchema` |
| `demo-initializer.service.ts` | 1 | `demoSessionResponseSchema` |

**Total : 16 méthodes**

## Approche

### Pattern de validation

Utiliser `.pipe(map(...))` avec `schema.parse()` pour valider les réponses :

```typescript
// Avant
getBudgetById$(id: string): Observable<Budget> {
  return this.#httpClient.get<BudgetResponse>(`${url}/${id}`).pipe(
    map((response) => response.data),
  );
}

// Après
getBudgetById$(id: string): Observable<Budget> {
  return this.#httpClient.get<unknown>(`${url}/${id}`).pipe(
    map((response) => budgetResponseSchema.parse(response).data),
  );
}
```

### Gestion des erreurs

Les erreurs Zod seront capturées par le `catchError` existant et transformées en `BudgetApiError` / erreur métier appropriée.

### Cas particuliers

1. **Méthodes DELETE** : Pas de body à valider, garder `Observable<void>`
2. **Méthodes avec logique complexe** : Valider avant la logique métier
3. **localStorage** : Déjà validé avec `safeParse()` dans `budget-api.ts`

## Étapes d'implémentation

### 1. budget-api.ts

| Méthode | Schéma | Notes |
|---------|--------|-------|
| `createBudget$()` | `budgetResponseSchema` | Déjà valide l'input, ajouter validation response |
| `getAllBudgets$()` | `budgetListResponseSchema` | - |
| `getBudgetById$()` | `budgetResponseSchema` | - |
| `getBudgetWithDetails$()` | `budgetDetailsResponseSchema` | - |
| `updateBudget$()` | `budgetResponseSchema` | - |
| `deleteBudget$()` | N/A | Pas de body |
| `exportAllBudgets$()` | `budgetExportResponseSchema` | - |

### 2. template-api.ts

| Méthode | Schéma |
|---------|--------|
| `getAll$()` | `budgetTemplateListResponseSchema` |
| `getById$()` | `budgetTemplateResponseSchema` |
| `getTemplateLines$()` | `templateLineListResponseSchema` |

### 3. transaction-api.ts

| Méthode | Schéma |
|---------|--------|
| `findByBudget$()` | `transactionListResponseSchema` |
| `create$()` | `transactionResponseSchema` |
| `findOne$()` | `transactionResponseSchema` |
| `update$()` | `transactionResponseSchema` |
| `remove$()` | N/A (void) |

### 4. demo-initializer.service.ts

| Méthode | Schéma |
|---------|--------|
| `startDemoSession()` | `demoSessionResponseSchema` |

## Risques

1. **Performance** : Négligeable - validation Zod très rapide
2. **Schémas incomplets** : Vérifier que tous les schémas existent dans `pulpe-shared`
3. **Erreurs runtime** : Si le backend renvoie des données incorrectes, l'app plantera de façon explicite (comportement souhaité)

## Tests

- Build frontend doit passer
- Tests unitaires existants doivent passer
- Test manuel de chaque endpoint

## Décision

Validation avec `.parse()` (throw sur erreur) plutôt que `.safeParse()` car :
- Les erreurs sont déjà gérées par `catchError`
- Fail-fast est préférable pour détecter les régressions API
