# Breadcrumb Component - Documentation Technique

## 🎯 Vue d'ensemble

Le système de breadcrumb (fil d'Ariane) est composé de deux parties principales qui respectent l'architecture Angular Enterprise :

- **`BreadcrumbState`** (Core) : Service injectable qui gère la logique métier
- **`PulpeBreadcrumb`** (UI) : Composant générique d'affichage

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MainLayout    │───▶│ BreadcrumbState  │───▶│ PulpeBreadcrumb │
│   (Layout)      │    │     (Core)       │    │      (UI)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Flux de données
1. **Router Events** → `BreadcrumbState` écoute les changements de navigation
2. **Route Analysis** → Analyse la hiérarchie des routes actives 
3. **Data Extraction** → Extrait les métadonnées `breadcrumb` des routes
4. **Signal Emission** → Émet un signal réactif avec les items du breadcrumb
5. **UI Rendering** → Le composant affiche conditionnellement le breadcrumb

## 🔧 Fonctionnement Technique

### 1. Service BreadcrumbState (Core)

```typescript
@Injectable({ providedIn: 'root' })
export class BreadcrumbState {
  readonly breadcrumbs = toSignal(
    this.#router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.#buildBreadcrumbs())
    ),
    { initialValue: [] }
  );
}
```

#### Étapes de construction :

1. **Écoute des événements** : `Router.events` filtrés sur `NavigationEnd`
2. **Extraction de la chaîne de routes** : `#getRouteChain()` parcourt depuis la racine jusqu'à la feuille active
3. **Construction fonctionnelle** : `Array.reduce()` transforme les routes en breadcrumb items
4. **Génération d'URL robuste** : Utilise `Router.createUrlTree()` + `Router.serializeUrl()`

#### Logique de construction des URLs :

```typescript
const newPath = [...acc.currentPath, ...routeUrlSegments]; // Accumulation immutable
const urlTree: UrlTree = this.#router.createUrlTree(newPath); // Délégation au Router
const url: string = this.#router.serializeUrl(urlTree); // Sérialisation standard
```

**Avantages** :
- ✅ Gestion automatique de l'encodage des caractères spéciaux
- ✅ Support des paramètres de matrice
- ✅ Future-proof face aux évolutions Angular
- ✅ Immutabilité respectée

### 2. Composant PulpeBreadcrumb (UI)

```typescript
@Component({
  selector: 'pulpe-breadcrumb',
  template: `
    @if (items().length >= 2) {
      <!-- Affichage seulement si 2+ niveaux -->
    }
  `
})
export class PulpeBreadcrumb {
  readonly items = input.required<BreadcrumbItem[]>();
}
```

#### Logique d'affichage :
- **Condition d'affichage** : `items().length >= 2` (minimum 2 niveaux)
- **Dernière item** : Affichée comme `<span>` (non-cliquable, style `isActive`)
- **Autres items** : Affichées comme `<a [routerLink]>` (cliquables)
- **Séparateurs** : Icônes Material `chevron_right`

## 📝 Configuration des Routes

### Structure recommandée :

```typescript
// app.routes.ts
{
  path: 'app',
  component: MainLayout,
  // PAS de breadcrumb ici (niveau racine)
  children: [
    {
      path: 'budget-templates',
      data: { breadcrumb: 'Modèles de budget', icon: 'description' },
      loadChildren: () => import('./budget-templates.routes'),
    }
  ]
}

// budget-templates.routes.ts
{
  path: '',
  providers: [Services...],
  // PAS de breadcrumb sur les wrappers
  children: [
    {
      path: '',
      // PAS de breadcrumb sur la page liste
      loadComponent: () => import('./budget-templates'),
    },
    {
      path: 'add',
      data: { breadcrumb: 'Ajouter un modèle', icon: 'add' },
      loadComponent: () => import('./add-template'),
    }
  ]
}
```

### Règles de configuration :
1. **Routes principales** : Définissent les breadcrumbs (`budget-templates`, `current-month`)
2. **Routes wrapper** (`path: ''`) : N'ont PAS de `data.breadcrumb`
3. **Routes spécialisées** : Ajoutent des niveaux (`add`, `:id`)

## 🎨 Interface BreadcrumbItem

```typescript
export interface BreadcrumbItem {
  readonly label: string;      // Texte affiché
  readonly url: string;        // URL de navigation (/app/budget-templates)
  readonly icon?: string;      // Icône Material optional
  readonly isActive: boolean;  // true pour le dernier élément
}
```

## 📱 Exemples de Résultats

### URLs et breadcrumbs générés :

| Route | Breadcrumb affiché | URLs |
|-------|-------------------|------|
| `/app/current-month` | *Aucun* (1 seul niveau) | - |
| `/app/budget-templates` | *Aucun* (1 seul niveau) | - |
| `/app/budget-templates/add` | `📋 Modèles de budget > ➕ Ajouter un modèle` | `/app/budget-templates` → `/app/budget-templates/add` |
| `/app/budget-templates/123` | `📋 Modèles de budget > 👁️ Détail du modèle` | `/app/budget-templates` → `/app/budget-templates/123` |

## 🔄 Intégration dans MainLayout

```typescript
export class MainLayout {
  readonly #breadcrumb = inject(BreadcrumbState);
  
  readonly breadcrumbItems = computed<UIBreadcrumbItem[]>(() =>
    this.#breadcrumb.breadcrumbs().map(item => ({ ...item }))
  );
}
```

```html
<pulpe-breadcrumb 
  class="px-4 py-3 border-b border-outline-variant"
  [items]="breadcrumbItems()" />
```

## 🎯 Patterns Techniques Utilisés

### 1. **Séparation des préoccupations** (Separation of Concerns)
- **Core** : Logique métier pure (extraction des données, construction d'URLs)
- **UI** : Présentation pure (affichage conditionnel, styling)
- **Layout** : Orchestration (injection, conversion de types)

### 2. **Programmation fonctionnelle**
- `Array.reduce()` au lieu de boucles imperatives
- Immutabilité avec spread operator (`[...acc.currentPath, ...segments]`)
- Fonctions pure sans side-effects

### 3. **Signals Angular v20**
- `toSignal()` pour la conversion Observables → Signals
- `computed()` pour les transformations réactives
- `input.required<T>()` pour les props typées

### 4. **Délégation aux APIs natives**
- `Router.createUrlTree()` + `Router.serializeUrl()` au lieu de concaténation manuelle
- Material Design 3 avec variables CSS `--mat-sys-*`
- Angular Router pour la navigation

## 🛡️ Gestion d'erreurs

```typescript
try {
  // Logique de construction
  return breadcrumbs.items;
} catch (error) {
  console.warn("Erreur lors de la construction du fil d'Ariane:", error);
  return []; // Fallback graceful
}
```

**Stratégie** : Fallback graceful vers un breadcrumb vide plutôt que de crasher l'application.

## 🚀 Performance

- **`distinctUntilChanged`** : Évite les re-renders inutiles (comparaison par défaut de `toSignal`)
- **`OnPush`** : Change detection optimisée sur le composant UI
- **Lazy evaluation** : Construction seulement lors des changements de navigation
- **Signals** : Propagation réactive optimisée par Angular

---

## 📋 Checklist d'utilisation

- [ ] Route configurée avec `data: { breadcrumb: 'Label' }`
- [ ] Pas de `breadcrumb` sur les routes wrapper (`path: ''`)
- [ ] Icon Material Symbols si désiré (`data: { icon: 'add' }`)
- [ ] Test de navigation entre les niveaux
- [ ] Vérification de l'affichage conditionnel (2+ niveaux)