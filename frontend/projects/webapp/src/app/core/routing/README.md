# Gestion des titres de page dans Pulpe

Ce module fournit une gestion centralisée et simplifiée des titres de page dans l'application Pulpe.

## Vue d'ensemble

Le système de gestion des titres est composé de trois éléments principaux :

1. **PulpeTitleStrategy** : Stratégie personnalisée qui étend `TitleStrategy` d'Angular pour la gestion automatique
2. **Title** : Service unifié pour binding et mise à jour programmatique des titres
3. **PAGE_TITLES** : Constantes centralisées pour les titres statiques

## Utilisation dans les routes

### Titres statiques

```typescript
{
  path: 'dashboard',
  title: PAGE_TITLES.DASHBOARD,
  component: DashboardComponent
}
```

### Titres dynamiques avec paramètres

```typescript
{
  path: 'product/:id',
  title: 'Produit {{id}}', // Sera remplacé par "Produit 123 • Pulpe"
  component: ProductDetailComponent
}
```

## Binding des titres dans les templates

### Injection du Title

```typescript
export class MyComponent {
  protected readonly title = inject(Title);
}
```

### Affichage du titre dans le template

```typescript
@Component({
  template: `
    <header>
      <h1>{{ title.currentTitle() }}</h1>
    </header>
  `,
})
export class MyComponent {
  protected readonly title = inject(Title);
}
```

### Titre avec fallback

```html
<h1>{{ title.currentTitle() || 'Titre par défaut' }}</h1>
```

## Utilisation programmatique

### Mise à jour simple du titre de l'onglet

```typescript
export class MyComponent {
  #title = inject(Title);

  updateTitle() {
    this.#title.setTitle("Mon nouveau titre");
  }
}
```

## Utilisation avec des données asynchrones

```typescript
export class TemplateDetail {
  #title = inject(Title);

  data = resource({
    loader: async () => this.loadTemplateData(),
  });

  constructor() {
    // Mise à jour automatique du titre quand les données changent
    effect(() => {
      const template = this.data.value();
      if (template?.name) {
        this.#title.setTitle(template.name);
      }
    });
  }
}
```

## Bonnes pratiques

1. **Centralisation** : Utilisez toujours les constantes `PAGE_TITLES` pour les titres statiques
2. **Cohérence** : Gardez le format "Titre • Pulpe" pour la majorité des pages
3. **Clarté** : Les titres doivent être descriptifs et aider l'utilisateur à comprendre où il se trouve
4. **Performance** : Utilisez `effect()` pour les mises à jour basées sur des signals/ressources
5. **Accessibilité** : Les titres aident les utilisateurs de lecteurs d'écran à naviguer
6. **Binding** : Utilisez `title.currentTitle()` pour afficher les titres dans vos templates
7. **Protection** : Marquez les propriétés du service comme `protected readonly` pour la sécurité
8. **YAGNI** : Supprimez les fonctionnalités inutilisées

## API du Title

```typescript
class Title {
  // Signal pour binding dans les templates
  readonly currentTitle: Signal<string>;

  // Méthode pour mise à jour programmatique
  setTitle(title: string): void;
}
```

## Structure des fichiers

```
core/routing/
├── index.ts                 # Exports publics
├── title.ts                 # Service unifié pour gestion des titres
├── routes-constants.ts      # Constantes des routes et titres
├── title-strategy.ts        # Stratégie Angular personnalisée
└── README.md               # Cette documentation
```
