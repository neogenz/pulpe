---
globs: 
  - "frontend/**/*.ts"
  - "frontend/**/*.html"
description: Règles pour le projet frontend Angular
---

## Conventions Frontend Angular

### Architecture
- Utiliser l'architecture standalone components (Angular 20)
- Pas de suffixes `.component`, `.service`, etc. (nouveau style guide Angular)
- Structure de dossiers : `feature/`, `ui/`, `core/`, `layout/`, `pattern/`

### Style et formatting
- Utiliser Tailwind CSS pour le styling
- Utiliser Angular Material pour les composants UI
- Préférer les `@if`, `@for` aux directives structurelles
- Import standalone dans les composants

### ESLint & Boundaries
- Respecter les règles `eslint-plugin-boundaries`
- Les features ne peuvent importer que du `core/`, `ui/`, `pattern/`
- Les layouts peuvent importer de `core/`, `ui/`, `pattern/`

### Exemples
```typescript
// ✅ Bon - Component standalone
@Component({
  selector: 'pulpe-main-layout',
  imports: [MatToolbarModule, RouterModule],
  template: `...`
})
export class MainLayoutComponent {}

// ❌ Éviter - Suffixes
export class MainLayoutComponentOld {}
``` 