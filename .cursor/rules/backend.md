---
globs:
  - "backend/**/*.ts"
  - "backend/**/*.js"
description: Règles pour le projet backend
---

## Conventions Backend

### Architecture

- Utiliser des patterns RESTful ou RPC selon le contexte
- Structure modulaire par fonctionnalité
- Séparer la logique métier des controllers

### Style et formatting

- Utiliser kebab-case pour les noms de fichiers
- Utiliser camelCase pour les variables et fonctions
- Préférer `function foo()` à `const foo = () =>`
- Exports nommés plutôt que default exports

### Sécurité et validation

- Valider toutes les entrées utilisateur
- Utiliser des types stricts TypeScript
- Gérer les erreurs proprement

### Exemples

```typescript
// ✅ Bon
export function getUserById(id: string) {
  // implementation
}

// ❌ Éviter
export const getUserById = (id: string) => {
  // implementation
};
```
