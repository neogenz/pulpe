# Review: Sûreté de la resource BudgetDetails

- **Verdict**: changes-requested
- **Diff**: `0b18b43ce...d51a5b453`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_03
- **Findings**: 0 critical, 1 warning, 3 minor

## Phases

### Phase 1 — Annuler les chargements de détail abandonnés

- [x] Un chargement réussi produit le même view-model qu'avant : la suite d'intégration passe sans qu'aucun de ses stubs soit modifié — `budget-details-store-integration.spec.ts` ne modifie aucun stub `of(...)` existant ; `vitest run` → 201 fichiers / 2557 tests verts
- [x] Une réponse `success: false` laisse la resource en erreur et journalise une seule fois, comme avant — garde déplacée verbatim dans le `map`, `budget-details-store.ts:247-252` ; `ngx-ziflux.mjs:164` applique `take(1)`, donc une seule émission consommée comme avec `firstValueFrom`. Aucun test n'exerce cette branche (voir finding `code` / vacuité de couverture)
- [x] Changer de budget pendant un chargement en vol ferme la souscription au premier GET au lieu de l'attendre — `budget-details-store-integration.spec.ts:236-259` ; falsifié : le test échoue `expected false to be true` sur l'ancien loader

### Phase 2 — Ne plus écrire de trou dans le cache

- [x] Sur un budget chargé, les mutations optimistes et leurs rollbacks se comportent exactement comme avant : la suite d'intégration passe inchangée — `vitest run` → 2557 tests verts, aucun test de mutation existant modifié
- [x] Quand la resource n'a pas de valeur, une mutation ne modifie ni le signal ni l'entrée de cache `['budget','details',id]` — `budget-details-store.ts:1408-1413` (garde) ; `budget-details-store-integration.spec.ts:799-828` ; falsifié : `expected undefined to be defined` sur l'ancien cast. Assertion verte vacante, voir finding 🟡
- [x] `budget-details-store.ts` ne contient plus aucune assertion `as unknown as` — `grep -c "as unknown as"` → `0`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | 2 | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store-integration.spec.ts:824` | L'assertion vit dans un `for` sur `cache.set.mock.calls`, et le correctif ramène ce tableau à 0 élément (sonde : `expected +0 to be -1`). La boucle ne s'exécute jamais : le vert du test est vacant. Il ne garde la régression que par son rouge, vérifié séparément ; si un refactor sans rapport cesse d'appeler `cache.set`, le test reste vert sans rien prouver | Remplacer la boucle par `expect(mockBudgetApi.cache.set).not.toHaveBeenCalled()` : une seule assertion, non vacante, et toujours rouge sur l'ancien cast (qui produisait un appel) |
| 🟢 | rot | 2 | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts:1413` | `update(() => fn(current))` déclare un updater dont l'argument est ignoré : la forme suggère une lecture de l'état courant qui n'a pas lieu, et invite le lecteur à se demander si `current` peut être périmé entre les deux appels | `set()` existe et fait le même write-through (`types/ngx-ziflux.d.ts:246`) : écrire `this.#budgetDetailsResource.set(fn(current))` dit exactement ce qui se passe |
| 🟢 | code | 1 | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store-integration.spec.ts:238` | `isCancelled` porte deux sens : `has(id)` signifie « souscription ouverte » et `get(id)` signifie « souscription fermée ». Les deux `waitFor` lisent donc le nom à contresens de ce qu'ils attendent | Renommer en `subscriptionClosedById`, ou séparer un `Set` des souscriptions ouvertes de la map des fermetures |
| 🟢 | conform | 1, 2 | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts` | Le fichier passe de 1476 à 1481 lignes, contre un plafond déclaré de 300 (`.claude/rules/01-standards/clean-code.md`, « File lines 300 »). Violation préexistante (~5×), que ce diff aggrave marginalement | Hors périmètre de ce correctif : découper le store (mutations, resources, sélecteurs) dans un chantier dédié plutôt que dans un fix de 2 lignes |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (6/6)                                        |
| Files checked | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`, `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store-integration.spec.ts` |
| Unchecked     | none                                              |
| Unplanned     | `budget-details-store-integration.spec.ts:8` ajoute `Observable` aux imports rxjs (requis par le test de la phase 1) ; `:815` passe `isManuallyAdjusted: false` au DTO, imposé par `typecheck:spec` et absent du plan |
