# Task: Add hasValue signal to TemplateDetailsStore

## Problem

Le `TemplateDetailsStore` expose `isLoading` et `error` mais manque le signal `hasValue` qui est le type guard idiomatique Angular pour vérifier si des données sont disponibles.

## Proposed Solution

Ajouter un computed signal `hasValue` qui délègue à `this.#templateDetailsResource.hasValue()` pour aligner avec l'API native Angular `resource()`.

## Dependencies

- Aucune (peut démarrer immédiatement)

## Context

- Fichier: `frontend/projects/webapp/src/app/feature/budget-templates/details/services/template-details-store.ts`
- Pattern existant à L42-47: `isLoading` et `error` sont déjà des computed qui délèguent au resource
- L'API `resource()` expose nativement `.hasValue()` - il suffit de l'exposer

## Success Criteria

- Signal `hasValue` ajouté au store
- `hasValue()` retourne `false` initialement, `true` après chargement réussi
- Tests unitaires passent
- Aucun breaking change (ajout uniquement)
