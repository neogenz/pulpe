# Task: Harmonize Store Loading/Error API

## Executive Summary

10 stores avec **3 patterns distincts** pour exposer les états loading/error. La solution idiomatique Angular est d'aligner sur l'API native de `resource()`.

---

## Angular Resource API (Source of Truth)

La documentation Angular montre que `resource()` expose nativement:

| Signal | Type | Description |
|--------|------|-------------|
| `value()` | `T \| undefined` | Les données |
| `hasValue()` | `boolean` | **TYPE GUARD** - true si value disponible |
| `error()` | `Error \| undefined` | L'erreur ou undefined |
| `isLoading()` | `boolean` | true pendant le chargement |
| `status()` | `ResourceStatus` | Granulaire: 'idle' \| 'error' \| 'loading' \| 'reloading' \| 'resolved' \| 'local' |

### Template Pattern Recommandé par Angular

```typescript
@if(user.hasValue()) {
  <user-details [user]="user.value()">
} @else if (user.error()) {
  <div>Could not load user information</div>
} @else if (user.isLoading()) {
  <div>Loading user info...</div>
}
```

**Point clé:** Angular utilise `hasValue()` comme type guard principal, pas `!isLoading()`.

Source: https://angular.dev/guide/signals/resource#resource-status

---

## Analyse des Stores Actuels

| Store | Utilise resource() | API exposée | Problèmes |
|-------|-------------------|-------------|-----------|
| TemplateDetailsStore | ✅ | `isLoading`, `error` | ❌ Manque `hasValue` |
| BudgetDetailsStore | ✅ | `isLoading`, `hasError`, `error` | ⚠️ `hasError` au lieu de `hasValue` (inversé) |
| BudgetListStore | ✅ | `.status()` direct | ⚠️ Pas d'API unifiée |
| CurrentMonthStore | ✅ | `dashboardStatus` | ⚠️ Différent des autres |
| TemplateLineStore | ❌ Manual | `signal()` publics mutables | ❌❌ **Anti-pattern critique** |
| OnboardingStore | ❌ Manual | `isSubmitting`, `error` | ⚠️ Nommage différent |
| TemplateStore | ❌ Manual | `isLoadingTemplates`, `error` | ⚠️ Nommage différent |
| AuthApi | ❌ Manual | `isLoading` only | ❌ Manque `error` |

---

## Problème Critique: TemplateLineStore

```typescript
// ❌ Anti-pattern (template-line-store.ts:28-29)
readonly isLoading = signal(false);  // Mutable depuis l'extérieur!
readonly error = signal<string | null>(null);
```

Ces signals sont **publics et mutables** - n'importe quel consommateur peut les modifier. C'est contraire aux patterns Angular et STATE-PATTERN.md.

---

## Solution Idiomatique

### API Standardisée (alignée sur resource())

Chaque store expose **les mêmes signaux que resource():**

| Signal | Type | Description |
|--------|------|-------------|
| `isLoading` | `Signal<boolean>` | true pendant le chargement |
| `hasValue` | `Signal<boolean>` | **TYPE GUARD** - true si données disponibles |
| `error` | `Signal<Error \| null>` | erreur ou null |

### Pourquoi `hasValue` et pas `isReady` ou `hasError`

1. **`hasValue()`** est l'API Angular native
2. C'est un **TYPE GUARD** qui garantit que `value()` ne throw pas
3. Sémantiquement plus précis: "a une valeur" vs "est prêt"
4. Évite la double négation (`!hasError && !isLoading`)

### Pour stores basés sur resource()

```typescript
readonly isLoading = computed(() => this.#resource.isLoading());
readonly hasValue = computed(() => this.#resource.hasValue());
readonly error = computed(() => this.#resource.error());
```

### Pour stores manuels

```typescript
readonly #state = signal<State>({ isLoading: false, error: null, data: null });

readonly isLoading = computed(() => this.#state().isLoading);
readonly hasValue = computed(() => this.#state().data !== null);
readonly error = computed(() => this.#state().error);
```

---

## Fichiers Clés

| Fichier | Lignes | Action |
|---------|--------|--------|
| `template-details-store.ts` | 42-47 | Ajouter `hasValue` |
| `budget-details-store.ts` | 63-67 | Renommer `hasError` → `hasValue` |
| `budget-list-store.ts` | 26-29 | Ajouter `isLoading`, `hasValue`, `error` |
| `current-month-store.ts` | 109 | Remplacer `dashboardStatus` |
| `template-line-store.ts` | 28-29 | **Refactoring complet** |
| `onboarding-store.ts` | 77-78 | Aligner nommage |
| `template-store.ts` | 55-58 | Aligner nommage |
| `auth-api.ts` | 32-42 | Ajouter `hasValue`, `error` |

---

## Dépendances

- Aucune dépendance externe
- Changements uniquement internes aux stores
- Tests existants à mettre à jour

---

## Risques

| Risque | Mitigation |
|--------|------------|
| Breaking changes pour composants | Rechercher toutes les utilisations avant changement |
| Régression tests | Exécuter tests après chaque store |
