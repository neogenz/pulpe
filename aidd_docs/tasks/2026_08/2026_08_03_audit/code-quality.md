# Codebase Audit: BudgetDetailsStore — loader `firstValueFrom` et cast `#updateDetails`

Les deux points sont réels et corrigeables en S ; aucun n'est un défaut de correction, les deux sont des écarts au pattern déjà appliqué ailleurs dans le même fichier.

- **Date**: 2026_08_03
- **Scope**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts` (2 sites nommés)
- **Health**: good
- **Findings**: 0 critical, 2 warning, 0 minor

Health: `good` = no critical findings; `fair` = critical findings exist but are isolated and addressable; `poor` = systemic or widespread critical findings.

## Findings

| Sev | Category     | Location                                                                                     | Issue                                                                                                                                                                                                                           | Suggested fix                                                                                                                                              | Effort |
| --- | ------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | code-quality | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts:243` | Seul loader des 4 resources du fichier à `await firstValueFrom(...)` au lieu de rendre l'Observable. La souscription appartient à la promesse : `abortSignal` n'est jamais honoré, le GET `/budgets/:id/details` d'un budget quitté continue jusqu'au bout, et son `logger.error` peut se déclencher pour une requête abandonnée. | Rendre l'Observable avec `.pipe(map(...))` — le `throw` dans le `map` conserve exactement la sémantique d'échec actuelle. Précédents : lignes 266, 275-278, 294 du même fichier, et `core/budget/budget-api.ts:169-175` sur cette méthode précise. | S      |
| 🟡  | code-quality | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts:1407` | `return details as unknown as BudgetDetailsViewModel` sur `details === undefined` : le cast ment au compilateur et fait écrire `undefined` dans un signal typé `T`, avec write-through vers le `DataCache`. Le commentaire dit « cast required by cachedResource.update() » — la contrainte est réelle (`update(updater: (value: T \| undefined) => T)`), mais le cast n'est pas la seule sortie. | Garder au lieu de caster : lire `value()` d'abord, sortir si absent, sinon appeler `update()`. Type-safe, sans cast, et « rien à mettre à jour → ne rien faire » est la bonne sémantique. Voir Top actions #2. | S      |

## Top actions

1. **Rendre l'Observable dans le loader de `#budgetDetailsResource`** (résout la ligne 243). Aligne le dernier loader du fichier sur les trois autres et rétablit l'annulation au changement de budget — utile ici parce que la navigation mois-à-mois et le prefetch adjacent changent `budgetId` pendant qu'un chargement peut être en vol.

   ```ts
   loader: ({ params }) =>
     this.#budgetApi.getBudgetWithDetails$(params.budgetId).pipe(
       map((response) => {
         if (!response.success || !response.data) {
           this.#logger.error('Failed to fetch budget details', {
             budgetId: params.budgetId,
           });
           throw new Error('Failed to fetch budget details');
         }
         return {
           ...response.data.budget,
           budgetLines: response.data.budgetLines,
           transactions: response.data.transactions,
         };
       }),
     ),
   ```

2. **Supprimer le cast dans `#updateDetails`** (résout la ligne 1407). Le `if (!details)` existe déjà pour couvrir le cas « pas de valeur » ; le déplacer avant l'appel à `update()` le rend exprimable sans cast.

   ```ts
   #updateDetails(
     fn: (details: BudgetDetailsViewModel) => BudgetDetailsViewModel,
   ): void {
     const current = this.#budgetDetailsResource.value();
     if (!current) return;
     this.#budgetDetailsResource.update(() => fn(current));
   }
   ```

3. Aucune troisième action : le périmètre demandé est couvert par les deux précédentes. Pour appliquer, passer la main à `refactor` — les deux changements sont couverts par la suite d'intégration existante du store, sans nouveau test à écrire.

## Coverage

- **Scanned**: code-quality
- **Skipped**: architecture, security, dependencies, performance, tests, ui — hors du périmètre demandé (deux sites de code nommés, pas un audit de pilier)

### Notes de vérification

- `ngx-ziflux@0.2.0`, `types/ngx-ziflux.d.ts:259-262` : `loader: (context: { params; abortSignal: AbortSignal }) => Observable<T> | Promise<T>` — la forme Observable est supportée nativement, pas de wrapper à écrire.
- `types/ngx-ziflux.d.ts:248` : `update(updater: (value: T | undefined) => T): void` — confirme que le updater doit rendre `T`, donc que le cast actuel n'est pas gratuit ; c'est bien la signature qui force la main, seule la sortie choisie est discutable.
- `core/budget/budget-api.ts:125-130` : `getBudgetWithDetails$` passe par `ApiClient.get$` → `HttpClient`, donc Observable froid qui annule bien son XHR au désabonnement. La fuite décrite est réelle, pas théorique.
- Les deux sites sont antérieurs à la PR courante (`git show f075d7567:` les contient déjà) : dette existante, pas régression introduite.
