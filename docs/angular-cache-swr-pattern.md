# Cache SWR Angular

Le frontend utilise `ngx-ziflux` pour ajouter un cache stale-while-revalidate aux resources
Angular. La version installée et son API publique sont définies dans
`frontend/package.json`; ne maintenir aucune implémentation locale parallèle.

## Responsabilités

```text
Component → Store route-scoped → API singleton → ApiClient → HTTP
                                  └─ DataCache
```

- L'API de domaine possède le `DataCache`, afin qu'il survive à la navigation.
- Le store possède les resources, les sélecteurs et les mutations de l'écran.
- `ApiClient` reste l'unique frontière HTTP et valide les réponses avec Zod.

```typescript
@Service()
export class OrdersApi {
  readonly cache = new DataCache({
    name: 'orders',
    staleTime: 30_000,
    expireTime: 300_000,
  });
}

@Service({ autoProvided: false })
export class OrdersStore {
  readonly #api = inject(OrdersApi);

  readonly orders = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['orders', 'list'],
    loader: () => this.#api.getAll$(),
  });
}
```

## Fraîcheur

- Frais : rendre immédiatement, sans requête.
- Périmé : rendre la valeur en cache et rafraîchir en arrière-plan.
- Expiré : évincer puis charger comme une première visite.

`invalidate(prefix)` marque les clés correspondantes comme périmées ; il ne les supprime
pas. `clear()` est réservé au vidage complet. Les clés suivent
`['domain', 'scope', ...identifiers]`.

Afficher un spinner uniquement pour `isInitialLoading()`. Une revalidation SWR conserve les
données visibles.

## Mutations

Utiliser `cachedMutation()` lorsque l'écriture et ses invalidations tiennent dans ce contrat.
`mutate()` ne rejette pas : le résultat vaut `undefined` en cas d'erreur et le détail se lit
dans le signal `error`. Une mise à jour optimiste doit restaurer ou recharger l'état en cas
d'échec.

Une invalidation transversale doit viser le préfixe réellement partagé. Ne pas recréer de
service d'invalidation ou de signal de version autour de `DataCache`.

## Exceptions

Une resource Angular nue reste adaptée à une recherche ponctuelle ou à un flux qui ne doit
pas survivre à la navigation. Un store de données métier persistant utilise le cache.

Les règles d'édition détaillées vivent dans
`.claude/rules/03-frameworks-and-libraries/angular-cache-swr.md` et
`angular-store-pattern.md`; les définitions TypeScript installées de `ngx-ziflux` tranchent
en cas de divergence.
