---
status: done
---

# Instruction: Rendre le no-op visible depuis l'appelant

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/src/app/feature/budget/budget-details/
├── store/
│   ├── ✏️ budget-details-store.ts                        # type CheckOutcome + 3 méthodes
│   └── ✏️ budget-details-store-integration.spec.ts       # assertions des 3 méthodes + table partagée
└── components/
    ├── ✏️ budget-items-container.ts                      # 3 sites d'appel
    └── ✏️ budget-items-container.spec.ts                 # stubs + test de régression
```

## Tasks to do

### `1)` Exporter le type à trois états depuis le store

> Union discriminée, pas deux booléens : `{ applied: true, error: 'x' }` ne doit pas être représentable.

```typescript
/** Ce qu'une mutation de pointage a fait : elle a tourné, une garde l'a court-circuitée, ou elle a échoué. */
export type CheckOutcome =
  | { readonly status: 'applied' }
  | { readonly status: 'skipped' }
  | { readonly status: 'failed'; readonly reason: string };
```

Le déclarer dans `budget-details-store.ts`, à côté des trois méthodes concernées. Ne pas créer de fichier pour six lignes.

### `2)` Basculer les trois méthodes de pointage sur `CheckOutcome`

Concerne `toggleCheck`, `toggleTransactionCheck`, `checkAllAllocatedTransactions`.

1. Chaque `return null` de garde devient `return { status: 'skipped' }`.
2. Le retour terminal projette `#runMutation` : la raison remplit `failed`, son absence donne `applied`.
3. Mettre à jour le commentaire `/** Returns the localized error message... */` de chacune : il décrit l'ancien contrat.
4. Ne toucher à aucune des 14 autres mutations, ni à `#runMutation`.

### `3)` Consommer les trois états dans le conteneur

Dans `budget-items-container.ts`, `handleToggleCheck` (L684 et L692) et `handleToggleTransactionCheck` (L709) :

1. `failed` → `openMutationErrorSnackbar(outcome.reason, …)` puis sortie, comme aujourd'hui.
2. `skipped` → sortie silencieuse, sans toast de confirmation.
3. `applied` → le toast de confirmation existant.
4. Dans `handleToggleCheck`, la cascade `checkAllAllocatedTransactions` ne doit pas transformer un `skipped` en échec : elle n'a rien à pointer quand tout l'est déjà, et le `toggleCheck` qui la précède, lui, a bien eu lieu.

### `4)` Rattacher les tests existants au nouveau contrat

1. `budget-details-store-integration.spec.ts` : les assertions `expect(error).toBeNull()` / `toBeTruthy()` sur les trois méthodes lisent désormais `status`. Le cas « envelope does not exist » attend `skipped`, pas un succès.
2. La table `No mutation reports its refusal on the page error signal` type ses entrées `run: () => Promise<string | null>` : adapter les trois entrées concernées comme les quatre qui rendent déjà un wrapper (`… .reason ?? null`).
3. `budget-items-container.spec.ts` : les stubs `toggleCheck` / `toggleTransactionCheck` / `checkAllAllocatedTransactions` rendent `{ status: 'applied' }` par défaut, et `{ status: 'failed', reason: … }` dans la table des toasts d'erreur.

### `5)` Ajouter le test de régression

Un seul test dans `budget-items-container.spec.ts` : quand `toggleCheck` répond `skipped`, aucun toast n'est ouvert.

Le falsifier en retirant la branche `skipped` de `handleToggleCheck` — il doit passer au rouge.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2    | Une garde des trois méthodes rend `{ status: 'skipped' }` et n'appelle aucune méthode d'API                                                              |
| 2    | Un pointage réussi rend `{ status: 'applied' }`, un échec rend `{ status: 'failed' }` portant le message localisé — et `error()` de la page reste vide   |
| 3    | Quand le store répond `skipped`, `MatSnackBar.open` n'est pas appelé ; falsifié en retirant la branche, le test passe au rouge                           |
| 3    | Quand le store répond `applied`, le toast de confirmation s'ouvre comme avant                                                                            |
| 3    | Quand le store répond `failed`, le toast d'erreur s'ouvre avec `reason`                                                                                  |
| 4    | `pnpm quality` sort en 0, et la suite frontend passe entièrement (aucun test existant laissé rouge ou supprimé)                                          |
