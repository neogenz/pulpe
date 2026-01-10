# Task: Frontend Transaction API Search Method

## Problem

Le service `TransactionApi` du frontend ne dispose pas de méthode pour appeler l'endpoint de recherche backend. Il faut ajouter une méthode qui effectue la requête HTTP et parse la réponse avec le schéma Zod.

## Proposed Solution

Ajouter une méthode `search$(query: string)` dans `TransactionApi` qui effectue un GET vers `/transactions/search` avec le paramètre de requête et valide la réponse avec le schéma partagé.

## Dependencies

- Task #1: TransactionSearchResult schema (pour import du schema de validation)
- Task #2: Backend endpoint (pour fonctionnement E2E, mais pas bloquant pour le développement)

## Context

- Fichier cible: `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts`
- Position: après `toggleCheck$()` (~ligne 66)

**Pattern à suivre:**
```typescript
// Exemple existant (findByBudget$)
findByBudget$(budgetId: string): Observable<TransactionListResponse> {
  return this.#http
    .get<unknown>(`${this.#apiUrl}/budget/${budgetId}`)
    .pipe(map((response) => transactionListResponseSchema.parse(response)));
}
```

## Success Criteria

- Méthode `search$(query: string): Observable<TransactionSearchResponse>` exportée
- Import du `transactionSearchResponseSchema` depuis `@pulpe/shared`
- Requête GET vers `${this.#apiUrl}/search` avec params `{ q: query }`
- Réponse validée avec le schéma Zod
- Build frontend réussit
