# Plan d'Action : Refactoring du Système de Gestion d'Erreur

## 📊 Analyse de l'État Actuel

### Points Forts Existants
- ✅ Service Logger basique avec niveaux de log et sanitisation des données sensibles
- ✅ Utilisation de `provideBrowserGlobalErrorListeners()` pour les erreurs globales
- ✅ Composants UI pour l'affichage d'erreurs (ErrorCard)
- ✅ Pattern resource() d'Angular 20 avec gestion d'état d'erreur intégrée

### Lacunes Identifiées
- ❌ Absence d'ErrorHandler global personnalisé
- ❌ Gestion d'erreur dispersée dans le code (try-catch locaux)
- ❌ Pas de catégorisation des erreurs
- ❌ Absence de tracking et d'analytics
- ❌ Pas de mécanisme de retry automatique
- ❌ Messages d'erreur techniques non adaptés aux utilisateurs
- ❌ Pas de source maps pour le debugging en production

## 🎯 Objectifs

1. **Simplicité (KISS)** : Un système centralisé, léger et maintenable
2. **Conformité Angular 20** : Utilisation des dernières best practices
3. **Observabilité** : Intégration PostHog pour tracking et analytics
4. **UX Optimale** : Messages clairs et actions de récupération

## 📋 Plan de Refactoring en 4 Phases

### Phase 1 : Infrastructure de Base (2-3 jours)

#### 1.1 Créer un ErrorHandler Global
```typescript
// core/error/error-handler.ts
@Injectable()
export class PulpeErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // Catégorisation et traitement
  }
}
```

#### 1.2 Système de Catégorisation d'Erreurs
```typescript
// core/error/error-types.ts
export enum ErrorCategory {
  NETWORK = 'network',        // Erreurs réseau/API
  VALIDATION = 'validation',   // Erreurs de validation
  BUSINESS = 'business',       // Règles métier
  SYSTEM = 'system',          // Erreurs système
  UNKNOWN = 'unknown'         // Non catégorisées
}

export interface PulpeError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  retryable: boolean;
}
```

#### 1.3 Service de Traduction d'Erreurs
```typescript
// core/error/error-translator.ts
@Injectable()
export class ErrorTranslator {
  translate(error: unknown): PulpeError {
    // Logique de traduction selon le type d'erreur
  }
}
```

### Phase 2 : Amélioration UX (2 jours)

#### 2.1 Messages Utilisateur Contextualisés
```typescript
const USER_MESSAGES = {
  [ErrorCategory.NETWORK]: {
    default: 'Problème de connexion. Veuillez réessayer.',
    timeout: 'La requête prend trop de temps. Veuillez réessayer.',
    offline: 'Vous êtes hors ligne. Vérifiez votre connexion.'
  },
  [ErrorCategory.VALIDATION]: {
    default: 'Les données saisies ne sont pas valides.',
    required: 'Ce champ est obligatoire.',
    format: 'Le format n\'est pas correct.'
  }
};
```

#### 2.2 Mécanisme de Retry Intelligent
```typescript
// core/error/retry-strategy.ts
@Injectable()
export class RetryStrategy {
  shouldRetry(error: PulpeError): boolean {
    return error.retryable && error.category === ErrorCategory.NETWORK;
  }
  
  async retry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
    // Logique de retry avec backoff exponentiel
  }
}
```

#### 2.3 Composants d'Erreur Améliorés
```typescript
// ui/error-boundary.ts
@Component({
  selector: 'pulpe-error-boundary',
  template: `
    @if (error()) {
      <div class="error-container">
        <mat-card>
          <h3>{{ error().userMessage }}</h3>
          @if (error().retryable) {
            <button mat-button (click)="retry()">Réessayer</button>
          }
        </mat-card>
      </div>
    }
    @else {
      <ng-content />
    }
  `
})
export class ErrorBoundary {
  error = signal<PulpeError | null>(null);
  retry = output<void>();
}
```

### Phase 3 : Intégration PostHog (2 jours)

#### 3.1 Installation et Configuration
```bash
pnpm add posthog-js
```

#### 3.2 ErrorHandler avec PostHog
```typescript
// core/error/posthog-error-handler.ts
@Injectable()
export class PostHogErrorHandler extends PulpeErrorHandler {
  #posthog = inject(PostHogService);
  
  override handleError(error: unknown): void {
    const pulpeError = this.translate(error);
    
    // Log local (dev)
    super.handleError(pulpeError);
    
    // Envoi à PostHog (prod)
    if (environment.production) {
      this.#posthog.captureException(pulpeError, {
        category: pulpeError.category,
        context: pulpeError.context,
        userId: this.#getCurrentUserId()
      });
    }
  }
}
```

#### 3.3 Configuration Source Maps
```json
// angular.json
{
  "configurations": {
    "production": {
      "sourceMap": {
        "scripts": true,
        "hidden": true
      }
    }
  }
}
```

#### 3.4 Script d'Upload des Source Maps
```typescript
// scripts/upload-sourcemaps.ts
import { uploadSourceMaps } from '@posthog/plugin-source-maps';

await uploadSourceMaps({
  apiKey: process.env.POSTHOG_API_KEY,
  appVersion: buildInfo.version,
  sourceMapsPath: 'dist/**/*.map'
});
```

### Phase 4 : Monitoring & Dashboards (1 jour)

#### 4.1 Métriques Clés
- Taux d'erreur par catégorie
- Temps de résolution moyen
- Erreurs les plus fréquentes
- Impact utilisateur (% sessions affectées)

#### 4.2 Alertes Automatiques
```typescript
// core/error/error-monitor.ts
@Injectable()
export class ErrorMonitor {
  #threshold = 10; // erreurs/minute
  
  checkErrorRate(): void {
    if (this.getErrorRate() > this.#threshold) {
      this.sendAlert('Taux d\'erreur critique détecté');
    }
  }
}
```

## 🏗️ Architecture Finale

```
frontend/projects/webapp/src/app/
├── core/
│   ├── error/
│   │   ├── error-handler.ts         # ErrorHandler principal
│   │   ├── error-types.ts           # Types et catégories
│   │   ├── error-translator.ts      # Traduction d'erreurs
│   │   ├── retry-strategy.ts        # Stratégie de retry
│   │   ├── posthog-error-handler.ts # Handler avec PostHog
│   │   └── error-monitor.ts         # Monitoring
│   └── analytics/
│       └── posthog.ts                # Service PostHog
├── ui/
│   ├── error-boundary.ts            # Composant boundary
│   ├── error-card.ts                # Carte d'erreur (existant)
│   └── error-fallback.ts            # UI de fallback
```

## 📦 Dépendances

```json
{
  "dependencies": {
    "posthog-js": "^1.140.0"
  },
  "devDependencies": {
    "@posthog/plugin-source-maps": "^1.0.0"
  }
}
```

## ⚙️ Configuration

### app.config.ts
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    // Remplacer ErrorHandler par défaut
    { provide: ErrorHandler, useClass: PostHogErrorHandler },
    
    // Garder les listeners globaux
    provideBrowserGlobalErrorListeners(),
    
    // Autres providers...
  ]
};
```

### environment.ts
```typescript
export const environment = {
  production: false,
  posthog: {
    apiKey: 'YOUR_API_KEY',
    apiHost: 'https://app.posthog.com',
    captureExceptions: true,
    sessionRecording: true
  }
};
```

## 🚀 Ordre d'Implémentation

1. **Semaine 1**
   - [ ] Phase 1 : Infrastructure de base
   - [ ] Tests unitaires de l'ErrorHandler
   - [ ] Migration progressive des try-catch existants

2. **Semaine 2**
   - [ ] Phase 2 : Amélioration UX
   - [ ] Phase 3 : Intégration PostHog
   - [ ] Tests d'intégration

3. **Semaine 3**
   - [ ] Phase 4 : Monitoring
   - [ ] Documentation
   - [ ] Déploiement progressif

## 📈 Métriques de Succès

- ✅ 100% des erreurs non gérées capturées
- ✅ Réduction de 50% du temps de résolution des bugs
- ✅ Messages d'erreur compréhensibles pour 95% des utilisateurs
- ✅ Source maps fonctionnelles en production
- ✅ Dashboard d'erreurs opérationnel

## ⚠️ Points d'Attention

1. **Performance** : L'ErrorHandler ne doit pas impacter les performances
2. **Sécurité** : Toujours sanitizer les données sensibles avant envoi
3. **GDPR** : S'assurer de la conformité pour le tracking utilisateur
4. **Budget** : Vérifier les limites du plan PostHog

## 🔄 Migration Progressive

### Étape 1 : Coexistence
- Garder le Logger existant
- Ajouter progressivement le nouvel ErrorHandler
- Tester sur un subset de fonctionnalités

### Étape 2 : Migration
- Remplacer les try-catch par le nouveau système
- Utiliser les ErrorBoundary dans les nouveaux composants
- Migrer les composants d'erreur existants

### Étape 3 : Nettoyage
- Supprimer l'ancien code de gestion d'erreur
- Unifier tous les messages d'erreur
- Optimiser les performances

## 📚 Ressources

- [Angular Error Handling Best Practices](https://angular.dev/best-practices/error-handling)
- [PostHog Angular Documentation](https://posthog.com/docs/libraries/angular)
- [Error Tracking Guide](https://posthog.com/docs/error-tracking)