# Breadcrumb Component - Documentation Technique

## 🎯 Vue d'ensemble

Le système de breadcrumb (fil d'Ariane) est composé de deux parties principales qui respectent l'architecture Angular Enterprise :

- **`BreadcrumbState`** (Core) : Service injectable qui gère la logique métier
- **`PulpeBreadcrumb`** (UI) : Composant générique d'affichage avec support pour le content projection
- **`PulpeBreadcrumbNew`** (UI) : Nouveau composant utilisant des directives pour plus de flexibilité

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

Le composant principal a été refactorisé pour utiliser le nouveau système basé sur des directives :

```typescript
@Component({
  selector: 'pulpe-breadcrumb',
  template: `
    @if (items().length >= 2) {
      <pulpe-breadcrumb-new>
        @for (item of items(); track item.url; let isLast = $last) {
          <!-- Contenu des items utilisant les directives -->
        }
      </pulpe-breadcrumb-new>
    }
  `
})
export class PulpeBreadcrumb {
  readonly items = input.required<BreadcrumbItemViewModel[]>();
}
```

### 3. Nouveau système avec directives

#### Directives disponibles :

- **`BreadcrumbItemDirective`** (`*pulpeBreadcrumbItem`) : Marque un élément comme item du breadcrumb
- **`BreadcrumbSeparatorDirective`** (`*pulpeBreadcrumbSeparator`) : Permet de personnaliser le séparateur

#### Composant PulpeBreadcrumbNew :

```typescript
@Component({
  selector: 'pulpe-breadcrumb-new',
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <ol class="flex items-center list-none p-0 m-0 flex-wrap text-sm">
        @for (item of items(); track item; let last = $last) {
          <li>
            <ng-template [ngTemplateOutlet]="item.templateRef"></ng-template>
          </li>
          @if (!last) {
            <li aria-hidden="true">
              <!-- Séparateur personnalisable -->
            </li>
          }
        }
      </ol>
    </nav>
  `
})
export class PulpeBreadcrumbNew {
  ariaLabel = input<string>('Breadcrumb');
  items = contentChildren<BreadcrumbItemDirective>(BreadcrumbItemDirective);
  separatorTemplateRef = contentChild<BreadcrumbSeparatorDirective>(
    BreadcrumbSeparatorDirective
  );
}
```

## 📝 Utilisation

### Utilisation basique (rétrocompatibilité)

```typescript
// Dans MainLayout
<pulpe-breadcrumb [items]="breadcrumbItems()" />
```

### Utilisation avancée avec directives

```typescript
// Breadcrumb simple
<pulpe-breadcrumb-new>
  <a mat-button *pulpeBreadcrumbItem routerLink="/home">Home</a>
  <a mat-button *pulpeBreadcrumbItem routerLink="/products">Products</a>
  <span *pulpeBreadcrumbItem class="font-medium">Current Page</span>
</pulpe-breadcrumb-new>

// Avec icônes
<pulpe-breadcrumb-new>
  <a mat-button *pulpeBreadcrumbItem routerLink="/dashboard">
    <mat-icon class="mr-1">dashboard</mat-icon>
    Dashboard
  </a>
  <a mat-button *pulpeBreadcrumbItem routerLink="/settings">
    <mat-icon class="mr-1">settings</mat-icon>
    Settings
  </a>
</pulpe-breadcrumb-new>

// Séparateur personnalisé
<pulpe-breadcrumb-new>
  <a mat-button *pulpeBreadcrumbItem routerLink="/home">Home</a>
  <a mat-button *pulpeBreadcrumbItem routerLink="/docs">Docs</a>
  
  <!-- Séparateur personnalisé -->
  <span *pulpeBreadcrumbSeparator class="mx-2">/</span>
</pulpe-breadcrumb-new>

// Contenu dynamique
<pulpe-breadcrumb-new>
  <a mat-button *pulpeBreadcrumbItem [routerLink]="['/users', userId]">
    {{ userName }}
  </a>
  <span *pulpeBreadcrumbItem class="flex items-center">
    <mat-chip-set>
      <mat-chip>{{ userRole }}</mat-chip>
    </mat-chip-set>
  </span>
</pulpe-breadcrumb-new>
```

## 📋 Configuration des Routes

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

## 🎨 Interfaces

```typescript
// Pour l'approche basée sur les données
export interface BreadcrumbItemViewModel {
  readonly label: string;      // Texte affiché
  readonly url: string;        // URL de navigation (/app/budget-templates)
  readonly icon?: string;      // Icône Material optional
  readonly isActive?: boolean; // true pour le dernier élément
}

// Pour l'approche avec directives
// Les items sont définis directement dans le template
```

## 📱 Exemples de Résultats

### URLs et breadcrumbs générés :

| Route | Breadcrumb affiché | URLs |
|-------|-------------------|------|
| `/app/current-month` | *Aucun* (1 seul niveau) | - |
| `/app/budget-templates` | *Aucun* (1 seul niveau) | - |
| `/app/budget-templates/add` | `📋 Modèles de budget > ➕ Ajouter un modèle` | `/app/budget-templates` → `/app/budget-templates/add` |
| `/app/budget-templates/123` | `📋 Modèles de budget > 👁️ Détail du modèle` | `/app/budget-templates` → `/app/budget-templates/123` |

## 🔄 Migration vers le nouveau système

### Étape 1 : Utilisation simple (automatique)
Le composant `PulpeBreadcrumb` existant utilise maintenant automatiquement le nouveau système tout en gardant la même API.

### Étape 2 : Utilisation directe (optionnel)
Pour plus de contrôle, utilisez directement `PulpeBreadcrumbNew` avec les directives :

```typescript
// Avant
<pulpe-breadcrumb [items]="breadcrumbItems()" />

// Après (avec plus de flexibilité)
<pulpe-breadcrumb-new>
  @for (item of breadcrumbItems(); track item.url) {
    <a mat-button *pulpeBreadcrumbItem [routerLink]="item.url">
      @if (item.icon) {
        <mat-icon>{{ item.icon }}</mat-icon>
      }
      {{ item.label }}
    </a>
  }
</pulpe-breadcrumb-new>
```

## 🎯 Patterns Techniques Utilisés

### 1. **Content Projection avec Directives**
- Utilisation de `contentChildren` et `contentChild` pour la projection de contenu
- Directives structurelles pour marquer les éléments
- `TemplateRef` pour capturer et projeter le contenu

### 2. **Séparation des préoccupations** (Separation of Concerns)
- **Core** : Logique métier pure (extraction des données, construction d'URLs)
- **UI** : Présentation pure (affichage conditionnel, styling)
- **Layout** : Orchestration (injection, conversion de types)

### 3. **Programmation fonctionnelle**
- `Array.reduce()` au lieu de boucles imperatives
- Immutabilité avec spread operator (`[...acc.currentPath, ...segments]`)
- Fonctions pure sans side-effects

### 4. **Signals Angular v20**
- `toSignal()` pour la conversion Observables → Signals
- `computed()` pour les transformations réactives
- `input.required<T>()` et `input<T>()` pour les props typées
- `contentChildren()` et `contentChild()` pour la projection de contenu

### 5. **Délégation aux APIs natives**
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
- **Content Projection** : Rendu optimisé avec `ng-template`

## ✅ Avantages du nouveau système

1. **Flexibilité** : Contrôle total sur le rendu de chaque item
2. **Personnalisation** : Séparateurs customisables, styles personnalisés
3. **Composabilité** : Peut inclure n'importe quel contenu Angular
4. **Type-safe** : Directives typées avec TypeScript
5. **Rétrocompatibilité** : L'ancien composant fonctionne toujours

---

## 📋 Checklist d'utilisation

- [ ] Route configurée avec `data: { breadcrumb: 'Label' }`
- [ ] Pas de `breadcrumb` sur les routes wrapper (`path: ''`)
- [ ] Icon Material Symbols si désiré (`data: { icon: 'add' }`)
- [ ] Test de navigation entre les niveaux
- [ ] Vérification de l'affichage conditionnel (2+ niveaux)
- [ ] Pour l'approche directive : import des directives nécessaires
- [ ] Pour l'approche directive : utilisation correcte de `*pulpeBreadcrumbItem`