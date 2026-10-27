---
status: done
---

# Instruction: Ne plus écrire de trou dans le cache

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/src/app/feature/budget/budget-details/store/
└── ✏️ budget-details-store.ts   # #updateDetails garde au lieu de caster
```

## Tasks to do

### `1)` Remonter le garde avant l'appel à `update()`

> `update()` exige un `T` en retour ; le cast actuel satisfait le compilateur en écrivant `undefined` dans un signal typé `T` — et le write-through l'écrit aussi dans le `DataCache`.

1. Dans `#updateDetails`, lire `this.#budgetDetailsResource.value()` d'abord et sortir sans rien faire quand la valeur est absente.
2. Appeler `update()` uniquement avec la valeur lue, de sorte que le updater rende toujours un `BudgetDetailsViewModel`.
3. Supprimer le `as unknown as BudgetDetailsViewModel` et le commentaire qui le justifiait : la contrainte de signature n'est plus rencontrée.
4. Ne pas ajouter de garde chez les appelants : les 17 mutations continuent d'appeler `#updateDetails` sans condition.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Sur un budget chargé, les mutations optimistes et leurs rollbacks se comportent exactement comme avant : la suite d'intégration passe inchangée |
| 1    | Quand la resource n'a pas de valeur, une mutation ne modifie ni le signal ni l'entrée de cache `['budget','details',id]` — aucune entrée `undefined` n'est écrite |
| 1    | `budget-details-store.ts` ne contient plus aucune assertion `as unknown as`                                                       |
