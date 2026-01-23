# Implementation Plan: Stale-While-Revalidate Pattern pour Navigation

## Overview

Implémenter le pattern "stale-while-revalidate" sur les trois pages principales:
1. Afficher les données en cache immédiatement
2. Déclencher un refresh en background
3. Afficher la loading bar pendant le refresh
4. Mettre à jour l'UI quand les nouvelles données arrivent

**Approche**: Rendre les stores globaux (`providedIn: 'root'`) pour persister les données entre navigations, et appeler `refreshData()` à chaque navigation pour rafraîchir en background.

## Dependencies

Ordre d'exécution requis:
1. Services API (stateless) - peuvent être rendus globaux en premier
2. State/Store services - dépendent des APIs
3. Routes - supprimer les providers
4. Composants - ajouter refreshData() et LoadingIndicator

## File Changes

### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.ts`

- Action: Rendre le service global
- Modifier ligne 18: `@Injectable()` → `@Injectable({ providedIn: 'root' })`
- Impact: Les données de la liste des budgets persistent entre navigations

### `frontend/projects/webapp/src/app/feature/budget/budget.routes.ts`

- Action: Supprimer BudgetListStore des providers
- Modifier ligne 10: supprimer `providers: [BudgetListStore],`
- Conserver la structure des routes enfants sans changement

### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

- Aucun changement nécessaire
- Le composant appelle déjà `this.state.refreshData()` (ligne 171)
- Le composant utilise déjà `LoadingIndicator` pour le status "reloading" (lignes 174-175)
- Comportement attendu: données affichées immédiatement + refresh background + loading bar

---

### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

- Action: Rendre le service global
- Modifier ligne 38: `@Injectable()` → `@Injectable({ providedIn: 'root' })`
- Note: La resource a des `params` qui changent selon la période - Angular gère automatiquement le rechargement

### `frontend/projects/webapp/src/app/feature/current-month/current-month.routes.ts`

- Action: Supprimer CurrentMonthStore des providers
- Modifier ligne 8: supprimer `providers: [CurrentMonthStore],`
- Conserver la structure des routes enfants sans changement

### `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

- Action: Ajouter refreshData() dans le constructeur et LoadingIndicator effect
- Dans le constructeur (après ligne 244):
  1. Appeler `this.store.refreshData()` pour déclencher le refresh background
  2. Ajouter un effect qui active le LoadingIndicator quand status === 'reloading'
  3. Ajouter cleanup dans DestroyRef pour reset le LoadingIndicator
- Pattern à suivre: voir `budget-list-page.ts:169-180`
- Imports à ajouter: `LoadingIndicator`, `effect`, `DestroyRef`

---

### `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-api.ts`

- Action: Rendre le service global
- Modifier ligne 20: `@Injectable()` → `@Injectable({ providedIn: 'root' })`

### `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-state.ts`

- Action: Rendre le service global
- Modifier ligne 12: `@Injectable()` → `@Injectable({ providedIn: 'root' })`

### `frontend/projects/webapp/src/app/feature/budget-templates/services/transaction-form.ts`

- Action: Rendre le service global
- Modifier ligne 33: `@Injectable()` → `@Injectable({ providedIn: 'root' })`

### `frontend/projects/webapp/src/app/feature/budget-templates/budget-templates.routes.ts`

- Action: Supprimer tous les providers de la route racine
- Modifier lignes 10-14: supprimer le bloc `providers: [...]`
- Conserver la structure des routes enfants sans changement

### `frontend/projects/webapp/src/app/feature/budget-templates/list/template-list-page.ts`

- Action: Ajouter refreshData() dans le constructeur et LoadingIndicator effect
- Ajouter dans le constructeur:
  1. Appeler `this.state.refreshData()` pour déclencher le refresh background
  2. Ajouter un effect qui active le LoadingIndicator quand status === 'reloading'
  3. Ajouter cleanup dans DestroyRef pour reset le LoadingIndicator
- Pattern à suivre: voir `budget-list-page.ts:169-180`
- Imports à ajouter: `LoadingIndicator`, `effect`, `DestroyRef`

---

## Testing Strategy

### Tests unitaires à mettre à jour

- `budget-list-store.spec.ts`: Pas de changement nécessaire (providedIn n'affecte pas les tests)
- `current-month-store.spec.ts`: Pas de changement nécessaire
- `budget-templates-store.spec.ts`: Pas de changement nécessaire
- `current-month.spec.ts`: Ajouter test pour vérifier l'appel à refreshData() au constructor
- `template-list-page.ts` tests: Ajouter test pour vérifier l'appel à refreshData() au constructor

### Vérification manuelle

1. **Budget List (Mes budgets)**:
   - Naviguer vers la page → voir les données immédiatement (si déjà visitée)
   - Observer la loading bar en haut pendant le refresh
   - Vérifier que les données se mettent à jour si changement serveur

2. **Current Month (Mois en cours)**:
   - Même comportement que Budget List
   - Tester le changement de mois → nouvelles données chargées

3. **Budget Templates (Modèles)**:
   - Même comportement que Budget List

4. **Navigation inter-pages**:
   - Naviguer rapidement entre les 3 pages
   - Vérifier que chaque page affiche ses données en cache immédiatement
   - Vérifier que la loading bar apparaît pendant le refresh

## Rollout Considerations

- **Breaking change**: Non - le comportement visible est amélioré (plus rapide)
- **Migration**: Aucune migration de données nécessaire
- **Rollback**: Simple - revenir aux providers au niveau des routes

## Risques Identifiés

1. **Mémoire**: Les stores globaux conservent les données en mémoire
   - Mitigation: Les données sont petites (liste de budgets < 100 items max)
   - Le logout efface les données via le système d'auth existant

2. **Données stales prolongées**: Si l'utilisateur reste longtemps sur une page sans naviguer
   - Mitigation: Chaque navigation déclenche un refresh
   - Les mutations (create/update/delete) reloadent déjà les données
