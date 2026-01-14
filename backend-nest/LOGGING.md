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

### **Architecture Split Logger**

Le système utilise deux types de loggers :

| Type | Usage | Méthodes disponibles |
|------|-------|---------------------|
| **InfoLogger** | Services métier | `info`, `debug`, `warn`, `trace` |
| **ErrorLogger** | GlobalExceptionFilter uniquement | `error`, `fatal` |

**Principe fondamental** : Les services ne peuvent PAS utiliser `logger.error()`. Ceci est garanti au compile-time par TypeScript.

### **Pattern Standard (InfoLogger)**

```typescript
import { type InfoLogger, InjectInfoLogger } from '@common/logger';

@Injectable()
export class MyService {
  constructor(
    @InjectInfoLogger(MyService.name)
    private readonly logger: InfoLogger, // ← Pas de méthode error !
  ) {}

  async businessMethod(user: User, data: SomeData) {
    const startTime = Date.now();

    // Business logic...
    const result = await this.repository.create(data);

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
  }
}
```

### **Injection par Token**

L'injection utilise des tokens spécifiques :

| Logger | Token | Usage |
|--------|-------|-------|
| **InfoLogger** | `INFO_LOGGER:ServiceName` | Services métier |
| **PinoLogger** | `PinoLogger:ServiceName` | Legacy, GlobalExceptionFilter |

**Tests** : Utiliser le token correct dans les mocks :

```typescript
import { INFO_LOGGER_TOKEN } from '@common/logger';

// Pour InfoLogger (services migrés)
{
  provide: `${INFO_LOGGER_TOKEN}:${MyService.name}`,
  useValue: mockLogger,
}

// Pour PinoLogger (legacy)
{
  provide: `PinoLogger:${MyService.name}`,
  useValue: mockPinoLogger,
}
```

## 🚫 **Anti-Patterns : Log or Throw, Never Both**

### **Principe Fondamental**

> **Log OR Throw, Never Both**

Les services métier **NE DOIVENT JAMAIS** logger une erreur puis la throw. Le logging des erreurs est la responsabilité **exclusive** du `GlobalExceptionFilter`.

### **❌ Anti-Pattern : Double Logging**

```typescript
// ❌ MAUVAIS : Log + Throw = logs dupliqués !
async create(dto: TransactionCreate) {
  try {
    return await this.repository.insert(dto);
  } catch (error) {
    this.logger.error({ err: error }, 'Failed to create');  // ❌ Log
    throw new BusinessException(                            // ❌ Et throw
      ERROR_DEFINITIONS.CREATE_FAILED,
      undefined,
      { operation: 'create' },
      { cause: error },
    );
  }
}
```

### **✅ Pattern Correct : Throw avec contexte**

```typescript
// ✅ BON : Throw uniquement, le filtre log !
async create(dto: TransactionCreate) {
  try {
    return await this.repository.insert(dto);
  } catch (error) {
    throw new BusinessException(
      ERROR_DEFINITIONS.CREATE_FAILED,
      undefined,
      { operation: 'create', userId: dto.userId },  // Contexte pour le log
      { cause: error },                              // Cause chain préservée
    );
  }
}
```

### **Garanties TypeScript**

Le type `InfoLogger` n'expose PAS la méthode `error` :

```typescript
export type InfoLogger = Pick<PinoLogger, 'info' | 'debug' | 'warn' | 'trace'>;

// Dans un service avec InfoLogger :
this.logger.error({ err }, 'msg');  // ❌ Erreur TypeScript !
//         ~~~~~ Property 'error' does not exist on type 'InfoLogger'
```

### **Cas d'Usage pour warn**

`logger.warn()` est approprié pour les situations **non-bloquantes** :

```typescript
// ✅ Warning pour situation anormale mais gérée
if (!this.config.externalApiKey) {
  this.logger.warn({}, 'External API key not configured, using fallback');
}

// ✅ Warning pour dégradation gracieuse
this.logger.warn(
  { err: networkError },  // err: pour la stack trace
  'External service unreachable, returning cached data',
);
```

### **Le champ `err` pour les objets Error**

Pino sérialise automatiquement les erreurs via le champ `err` :

```typescript
// ✅ BON : Pino extraira message, stack, name automatiquement
this.logger.warn({ err: error }, 'Connection failed');

// ❌ MAUVAIS : Perd la stack trace
this.logger.warn({ error: error.message }, 'Connection failed');
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

## 🌐 **Auto-Logging HTTP**

### **Logs Automatiques des Requêtes**

Pino HTTP génère automatiquement des logs pour chaque requête :

- **Incoming** : Method, URL, User-Agent, Request ID
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

### **Mocks pour InfoLogger**

```typescript
import { INFO_LOGGER_TOKEN } from '@common/logger';

// Mock InfoLogger (sans error/fatal)
const mockInfoLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  trace: jest.fn(),
};

// Dans le TestingModule
{
  provide: `${INFO_LOGGER_TOKEN}:${MyService.name}`,
  useValue: mockInfoLogger,
}
```

### **Mocks pour PinoLogger (legacy)**

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
// Vérifier qu'un log info a été émis
expect(mockInfoLogger.info).toHaveBeenCalledWith(
  expect.objectContaining({
    operation: 'expected_operation',
    userId: 'expected-user-id',
  }),
  'Expected success message',
);

// Vérifier que AUCUN error log n'a été émis (pattern Log or Throw)
// Note: Si le mock inclut `error` pour vérification
expect(mockLogger.error).not.toHaveBeenCalled();
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

### **Service Business (avec InfoLogger)**

```typescript
import { type InfoLogger, InjectInfoLogger } from '@common/logger';

@Injectable()
export class TransactionService {
  constructor(
    @InjectInfoLogger(TransactionService.name)
    private readonly logger: InfoLogger,
  ) {}

  async create(dto: TransactionCreate, user: User) {
    const startTime = Date.now();

    try {
      const result = await this.repository.insert(dto);

      // ✅ Log success avec métriques
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

      return result;
    } catch (error) {
      // ✅ Throw avec contexte complet, PAS de log error
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        { operation: 'create_transaction', userId: user.id },
        { cause: error },
      );
    }
  }
}
```

### **GlobalExceptionFilter (seul à utiliser error)**

```typescript
// GlobalExceptionFilter - SEUL autorisé à utiliser logger.error()
@Catch()
export class GlobalExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // ... extraction des données

    if (statusCode >= 500) {
      this.logger.error(
        {
          operation: 'handle_exception',
          requestId: context.requestId,
          ...serviceContext,  // Contexte mergé depuis BusinessException
          err: rootCause,     // Stack trace complète
          causeChain,         // Chaîne des causes
        },
        'SERVER ERROR: Internal server error',
      );
    } else {
      this.logger.warn(
        { ... },
        'CLIENT ERROR: Resource not found',
      );
    }
  }
}
```

### **Guard/Service avec dégradation gracieuse**

```typescript
// ✅ warn approprié pour situation non-bloquante
this.logger.warn(
  {
    operation: 'authenticate_user',
    requestId: req.headers['x-request-id'],
    ip: req.ip,
    err: networkError,  // Stack trace préservée avec err:
  },
  'External auth service unreachable, using cached session',
);
```

## 📦 **Module Configuration**

### **Ajouter InfoLogger à un Module**

```typescript
import { createInfoLoggerProvider } from '@common/logger';

@Module({
  providers: [
    MyService,
    createInfoLoggerProvider(MyService.name),  // ← Ajouter le provider
  ],
})
export class MyModule {}
```

---

**💡 Ce système garantit un logging centralisé, sans duplication, avec validation au compile-time grâce au pattern Split Logger.**
