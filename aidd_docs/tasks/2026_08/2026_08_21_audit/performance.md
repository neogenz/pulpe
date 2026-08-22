# Audit Android — Performance

- Date : 2026-08-21
- Périmètre : requêtes/cache, listes, démarrage statique et export Expo
- Santé : **correcte aujourd'hui, avec deux coûts qui croissent avec l'usage**

## Findings

| Sev | Category        | Location                                                     | Issue                                                                                                                                                                                                                            | Suggested fix                                                                                                                      | Effort |
| --- | --------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Cache/network   | `android/src/core/user-settings/user-settings-queries.ts:13` | Après un changement de langue, `cacheUserSettings` invalide toutes les queries actives sans `queryKey`. Budgets, objectifs, tags et templates sont donc refetchés/déchiffrés alors que le catalogue local s'est déjà mis à jour. | Conserver le `setQueryData` et n'invalider que les ressources réellement localisées côté serveur, voire aucune si aucune ne l'est. | S      |
| 🟡  | Data scaling    | `android/src/features/budgets/budget-api.ts:23`              | Toute l'historique et tous les budgets futurs sont chargés dans une seule query puis rendus dans des `ScrollView`. Payload, validation Zod, cache et rendu croissent sans borne avec l'âge du compte.                            | Séparer le resolver du mois courant d'un historique paginé/cursored, en préservant les budgets futurs nécessaires.                 | M      |
| 🟢  | Background work | `android/src/core/system/system-store.ts:65`                 | Le budget de 3 s est un `Promise.race` qui n'annule pas la requête API. Celle-ci peut continuer jusqu'aux trois timeouts/retries de 30 s; plusieurs retours foreground peuvent empiler des checks devenus inutiles.              | Faire accepter un `AbortSignal`/timeout court au client ou dédupliquer le check en vol.                                            | S      |

## Top actions

1. Supprimer l'invalidation globale au changement de langue.
2. Bonder l'historique avant qu'un ancien compte ne rende le coût visible.
3. Annuler ou partager le check système en vol.

## Coverage

- Mesuré : export production réussi, 3 616 modules, bundle Hermes 9,5 Mo, dossier export 12 Mo.
- Inspectés : TanStack Query, invalidations, listes/ScrollView, refresh foreground et traitements de calcul principaux.
- Limites : aucun profiler CPU/mémoire, trace de démarrage, frame timing ou test sur appareil; les findings sont statiques, pas des régressions mesurées en production.
