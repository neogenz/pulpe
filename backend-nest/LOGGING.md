# Logging System - NestJS Pino 📋

Documentation technique du système de logging unifié basé sur **NestJS Pino** avec logs structurés.

## 🎯 **Architecture**

### **Stack Utilisé**

- **nestjs-pino** : Intégration NestJS + Pino
- **Pino** : Logger JSON haute performance
- **pino-pretty** : Format lisible en développement

### **Configuration Centralisée**

Configuration dans `src/app.module.ts` avec factory pattern :

```typescript
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: createPinoLoggerConfig,
});
```

## 🔧 **Configuration par Environnement**

### **Développement**

- **Format** : Pretty print coloré via `pino-pretty`
- **Niveau** : `debug`
- **Transport** : Console avec formatage lisible

### **Production**

- **Format** : JSON structuré
- **Niveau** : `info`
- **Transport** : stdout (JSON) pour collecte par l'infrastructure
- **Redaction** : Champs sensibles masqués automatiquement

## 🏗️ **Utilisation dans les Services**

### **Pattern Standard**

```typescript
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(
    @InjectPinoLogger(MyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async businessMethod(user: User, data: SomeData) {
    const startTime = Date.now();

    try {
      // Business logic...

      // ✅ Success logging with metrics
      this.logger.info(
        {
          operation: 'business_method',
          userId: user.id,
          entityId: result.id,
          duration: Date.now() - startTime,
        },
        'Business operation completed successfully',
      );

      return result;
    } catch (error) {
      // ✅ Error logging with context
      this.logger.error(
        {
          operation: 'business_method',
          userId: user.id,
          err: error, // Pino automatically handles Error objects
          duration: Date.now() - startTime,
        },
        'Business operation failed',
      );
      throw error;
    }
  }
}
```

### **Injection par Token**

L'injection utilise des tokens spécifiques : `PinoLogger:ServiceName`

**Tests** : Utiliser le token correct dans les mocks :

```typescript
{
  provide: `PinoLogger:${MyService.name}`,
  useValue: mockPinoLogger,
}
```

## 📊 **Standards de Logging**

### **Niveaux de Log**

- **`error`** : Erreurs serveur (5xx), exceptions critiques
- **`warn`** : Erreurs client (4xx), situations anormales
- **`info`** : Opérations business importantes, audit, métriques
- **`debug`** : Informations techniques, validation

### **Structure des Logs**

```typescript
// ✅ Template recommandé
logger.[level]({
  operation: 'operation_name',        // OBLIGATOIRE : nom de l'opération
  userId: user?.id,                   // SI DISPONIBLE : contexte utilisateur
  requestId: context.requestId,       // AUTO : correlation ID des requêtes
  entityId: entity.id,                // SI APPLICABLE : ID de l'entité concernée
  entityType: 'transaction',          // SI APPLICABLE : type d'entité
  duration: Date.now() - startTime,   // POUR PERFORMANCE : durée d'exécution
  err: error,                        // POUR ERREURS : objet Error (format Pino)
  // ... contexte métier spécifique
}, 'English message describing what happened');
```

### **Messages en Anglais**

Tous les messages de log doivent être en anglais pour faciliter la recherche et l'indexation :

```typescript
// ✅ Bon
'Transaction creation failed';
'User authentication successful';
'Budget validation error';

// ❌ À éviter
'Erreur création transaction';
'Authentification réussie';
```

### **Objets d'Erreur**

Pino gère automatiquement les objets `Error` via le champ `err` :

```typescript
// ✅ Pino extraira automatiquement message, stack, etc.
logger.error({ err: error }, 'Operation failed');

// ❌ Éviter
logger.error({ error: error.message }, 'Operation failed');
```

## 🔒 **Sécurité et Redaction**

### **Champs Automatiquement Masqués**

Configuration dans `createPinoLoggerConfig()` :

- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`
- `req.body.token`
- `res.headers["set-cookie"]`

### **Custom Redaction**

Pour masquer des champs spécifiques dans vos logs :

```typescript
// ✅ Ne pas logger directement des données sensibles
logger.info(
  {
    operation: 'user_login',
    userId: user.id,
    // email: user.email,  ← Éviter si sensible
  },
  'User logged in successfully',
);
```

### **GDPR Compliance**

Les logs HTTP sont automatiquement anonymisés pour respecter le RGPD :

- **IP Address** : Masquée partiellement (`192.168.1.100` → `192.168.x.x`)
- **User-Agent** : Simplifié en type de device (`mobile`, `tablet`, `desktop`, `unknown`)

**Données à NE JAMAIS logger :**

- Adresses IP brutes (non anonymisées)
- Chaînes User-Agent complètes
- Montants financiers (soldes, valeurs de transactions)
- Identifiants personnels (email, nom, téléphone) - utiliser uniquement les UUIDs

## 🌐 **Auto-Logging HTTP**

### **Logs Automatiques des Requêtes**

Pino HTTP génère automatiquement des logs pour chaque requête :

- **Incoming** : Method, URL, Device Type (anonymisé), IP (anonymisée), Request ID
- **Outgoing** : Status code, Response time, Content-Length

### **Correlation IDs**

Génération automatique d'IDs de corrélation :

- **Header** `X-Request-Id` si fourni
- **Auto-généré** sinon (UUID)
- **Propagé** dans tous les logs de la requête

### **Exclusions**

Les endpoints de health check sont exclus :

```typescript
autoLogging: {
  ignore: (req) => req.url?.includes('/health') ?? false,
}
```

## 🧪 **Testing**

### **Mocks dans les Tests**

```typescript
const mockPinoLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
};

// Dans le TestingModule
{
  provide: `PinoLogger:${ServiceName.name}`,
  useValue: mockPinoLogger,
}
```

### **Vérification des Logs**

```typescript
expect(mockPinoLogger.error).toHaveBeenCalledWith(
  expect.objectContaining({
    operation: 'expected_operation',
    userId: 'expected-user-id',
    err: expect.any(Error),
  }),
  'Expected error message',
);
```

## 📈 **Monitoring et Observabilité**

### **Métriques Automatiques**

- **Duration** : Temps d'exécution des opérations
- **Request ID** : Traçabilité des requêtes
- **User Context** : Qui fait quoi
- **Error Context** : Stack traces et contexte d'erreur

### **Collecte des Logs en Production**

En production, les logs JSON sont émis sur stdout et peuvent être collectés par :

- **Docker/Kubernetes** : Collecteurs de logs natifs
- **PM2** : Logs management intégré
- **Systemd** : journald pour logs système
- **Cloud Providers** : AWS CloudWatch, Azure Monitor, GCP Logging
- **Solutions tierces** : ELK Stack, Grafana Loki, etc.

### **Query Examples (pour systèmes de log)**

```bash
# Rechercher les erreurs d'un utilisateur spécifique
operation:"create_transaction" AND userId:"abc-123" AND level:"error"

# Analyser les performances d'une opération
operation:"find_all_budgets" AND duration:>1000

# Tracer une requête complète
requestId:"550e8400-e29b-41d4-a716-446655440000"
```

## 🚀 **Performance**

### **Async Logging**

Pino utilise des workers pour les logs asynchrones, minimisant l'impact performance.

### **JSON Parsing**

Logs JSON natifs évitent le parsing côté monitoring.

### **Transport Optimisé**

- **Développement** : Formatage pretty pour lisibilité
- **Production** : JSON brut sur stdout pour performance maximale

## 📋 **Exemples Concrets**

### **Service Business**

```typescript
// Transaction creation avec audit complet
this.logger.info(
  {
    operation: 'create_transaction',
    userId: user.id,
    budgetId: dto.budgetId,
    transactionType: dto.type,
    amount: dto.amount,
    duration: Date.now() - startTime,
  },
  'Transaction created successfully',
);
```

### **Exception Filter**

```typescript
// Erreur globale avec contexte de requête
this.logger.error(
  {
    operation: 'handle_exception',
    requestId: context.requestId,
    userId: context.userId,
    method: request.method,
    url: request.url,
    statusCode: errorData.status,
    err: errorData.originalError,
  },
  'Server error occurred',
);
```

### **Guard Authentication**

```typescript
// Échec d'authentification
// Note: ip et deviceType sont anonymisés automatiquement par les serializers HTTP
this.logger.warn(
  {
    operation: 'authenticate_user',
    requestId: req.headers['x-request-id'],
    // ip et deviceType sont ajoutés automatiquement par pino-http
  },
  'Authentication failed - invalid token',
);
```

---

**💡 Ce système offre une observabilité complète avec des performances optimales et une sécurité renforcée.**
