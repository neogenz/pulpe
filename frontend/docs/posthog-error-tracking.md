# PostHog Error Tracking - Configuration

Configuration complète du tracking d'erreurs avec PostHog incluant sourcemaps et versioning.

## 🔧 Configuration actuelle

### Version tracking

La version de l'app est automatiquement incluse dans tous les événements PostHog :

```typescript
// Super Properties (tous les événements)
app_version: "2025.11.0"
app_commit: "abc123d"
deployment_date: "2025-09-17T10:30:00Z"
environment: "production"

// Person Properties (profil utilisateur)
first_app_version: "2025.11.0"  // Première version utilisée
first_commit: "abc123d"

// Événements d'erreur (contexte spécifique)
release: "2025.11.0"
commit: "abc123d"
build_date: "2025-09-17T10:30:00Z"
```

### Sourcemaps automatiques

Upload automatique lors de chaque déploiement Vercel :
- Symbol Sets conservés 90 jours
- Chaque version a ses propres Symbol Sets (pas d'écrasement)
- Stack traces lisibles en production

## 🎯 Dans le dashboard PostHog

### Filtres disponibles

```
app_version = "2025.11.0"           # Erreurs d'une version spécifique
environment = "production"          # Erreurs en production uniquement
error_type = "TypeError"           # Type d'erreur
```

### Événements d'erreur

Les erreurs sont capturées avec le contexte complet :
- Message d'erreur (sanitized)
- Stack trace (avec sourcemaps)
- URL de la page
- Version et commit
- Timestamp précis

## 🛠️ Utilisation

### Capture manuelle d'erreur

```typescript
// Dans un composant Angular
export class MyComponent {
  constructor(private postHog: PostHogService) {}

  onError(error: Error) {
    this.postHog.captureException(error, {
      component: 'MyComponent',
      action: 'user_action',
      // Contexte additionnel
    });
  }
}
```

### Capture automatique

Les erreurs non catchées sont automatiquement capturées via `GlobalErrorHandler`.

## 🔍 Debugging

### Identifier une erreur

1. **PostHog Dashboard** → Errors
2. Filtrer par `app_version` si nécessaire
3. Cliquer sur l'erreur pour voir :
   - Stack trace avec fichiers et lignes originaux
   - Version et commit exacts
   - Contexte utilisateur et page

### Corréler avec les déploiements

- Chaque version correspond à un commit Git
- Chaque déploiement a ses propres sourcemaps
- Timeline des erreurs visible par version

## 📊 Métriques utiles

- **Erreurs par version** : Impact des releases
- **Top erreurs** : Priorités de fix
- **Régression** : Nouvelles erreurs après déploiement
- **Adoption** : Répartition des versions en production

## 🔐 Sécurité

- **Données financières** : Automatiquement masquées
- **PII** : Emails et données sensibles redacted
- **Sourcemaps** : Non exposées publiquement (`hidden: true`)
- **API keys** : Variables d'environnement sécurisées

---

**Note** : Configuration automatique, aucune intervention manuelle requise.