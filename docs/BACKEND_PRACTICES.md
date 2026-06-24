# 🏗️ Backend Practices - NestJS & Error Handling

> **Guidelines complètes** pour développement backend NestJS : error handling, logging, patterns, et bonnes pratiques

## 🚀 TLDR - Patterns Essentiels

### ⚡ Pattern Error Handling Standard
```typescript
// ✅ Pattern recommandé - Service
async findOne(id: string): Promise<Budget> {
  const { data, error } = await supabase
    .from('budget')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
      { id },
      { operation: 'findOne', entityId: id },
      { cause: error }  // ✅ TOUJOURS utiliser cause
    );
  }
  return data;
}
```

### ⚡ Logging Structure Recommandée
```typescript
// ✅ Pattern recommandé - Logging
@Injectable()
export class BudgetService {
  constructor(
    @InjectInfoLogger(BudgetService.name)
    private readonly logger: InfoLogger,
  ) {}

  async createBudget(dto: CreateBudgetDto): Promise<Budget> {
    const startTime = Date.now();

    this.logger.info(
      {
        operation: 'create_budget',
        userId: dto.userId,
        templateId: dto.templateId,
        duration: Date.now() - startTime,
      },
      'Budget created successfully'
    );
  }
}
```

## 📋 Principe Fondamental : "Log ou Throw"

### Règle d'Or
> **Dans un `catch`, soit tu gères et logues, soit tu relances, mais tu ne fais pas les deux.**

### Pourquoi ce principe ?
1. **Évite logs dupliqués** : Une erreur = un seul log
2. **Simplifie debugging** : Stack traces propres
3. **Performance** : Élimine opérations redondantes
4. **Responsabilité claire** : Chaque couche a un rôle défini

### Patterns Corrects {#error-patterns}

#### Pattern 1 : Throw Seulement (Standard)
```typescript
// ✅ Service - Throw uniquement
async findBudget(id: string): Promise<Budget> {
  const { data, error } = await supabase
    .from('budget')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
      { id },
      { operation: 'findOne', entityId: id },
      { cause: error }
    );
  }
  return data;
}
```

#### Pattern 2 : Log et Gérer (Sans Relancer)
```typescript
// ✅ Erreurs non-bloquantes
private logDataFetchErrors(results: any, id: string): void {
  if (results.transactionsResult.error) {
    this.logger.error(
      { err: results.transactionsResult.error, budgetId: id },
      'Failed to fetch transactions for budget'
    );
  }
  // Continue l'exécution même si certaines données manquent
}
```

#### Pattern 3 : "Enrichir et Relancer" (Conversion d'Erreurs)
```typescript
// ✅ Conversion erreur technique → erreur métier
private handleBudgetCreationError(error: unknown, userId: string): never {
  // 1. Log erreur technique (niveau bas)
  this.logger.error(
    {
      err: error,
      userId,
      operation: 'create_budget_rpc',
      postgresError: error,
    },
    'Supabase RPC failed at database level'
  );

  // 2. Throw erreur métier (niveau haut)
  const errorMessage = (error as { message?: string })?.message;
  if (errorMessage?.includes('23505')) { // unique_violation
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
      { month: dto.month, year: dto.year }
    );
  }

  throw new BusinessException(
    ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
    undefined,
    { userId },
    { cause: error }
  );
}
```

## ⚠️ BusinessException Usage

### Structure Complète
```typescript
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,     // Definition avec code + message
  { id: budgetId },                       // Details pour message client
  { userId: user.id, operation: 'find' }, // Context pour logs
  { cause: originalError }                // ✅ Chaîne causale
);
```

### IMPORTANT : Utilisation Exclusive de `cause`
```typescript
// ❌ MAUVAIS - N'utilisez PAS originalError dans loggingContext
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id },
  { originalError: error } // ❌ Ambigu et non standard
);

// ✅ BON - Utilisez le paramètre cause (standard ES2022)
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id },
  { operation: 'findOne', entityId: id }, // Contexte métier uniquement
  { cause: error } // ✅ Standard pour chaîne causale
);
```

### ERROR_DEFINITIONS - Source de Vérité
```typescript
// config/error-definitions.ts
BUDGET_NOT_FOUND: {
  code: 'ERR_BUDGET_NOT_FOUND',
  message: (details) => details?.id
    ? `Budget with ID '${details.id}' not found`
    : 'Budget not found',
  httpStatus: HttpStatus.NOT_FOUND,
}
```

## 📊 Logging Structured (Pino) {#logging}

### Configuration Pino
- **Développement** : Pretty-printed coloré avec `pino-pretty`
- **Production** : JSON structuré pour observabilité
- **Auto-correlation** : Request IDs générés automatiquement

### Niveaux de Log
- **error** : Erreurs serveur (5xx), exceptions critiques
- **warn** : Erreurs client (4xx), situations anormales
- **info** : Opérations métier importantes, audit, métriques
- **debug** : Détails techniques (développement uniquement)

### Pattern Logging Recommandé
```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectInfoLogger(UserService.name)
    private readonly logger: InfoLogger,
  ) {}

  async updateUser(userId: string, data: UpdateUserDto): Promise<User> {
    const startTime = Date.now();

    try {
      const result = await this.userRepository.update(userId, data);

      this.logger.info(
        {
          operation: 'update_user',
          userId,
          fieldsUpdated: Object.keys(data),
          duration: Date.now() - startTime,
        },
        'User updated successfully'
      );

      return result;
    } catch (error) {
      // Pattern "Enrichir et Relancer"
      this.logger.error(
        {
          err: error,
          operation: 'update_user',
          userId,
          duration: Date.now() - startTime,
        },
        'Failed to update user'
      );

      throw new BusinessException(
        ERROR_DEFINITIONS.USER_UPDATE_FAILED,
        { userId },
        { operation: 'update', fieldsUpdated: Object.keys(data) },
        { cause: error }
      );
    }
  }
}
```

### Sécurité & Redaction
Champs automatiquement masqués :
- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`
- `req.body.token`
- `res.headers["set-cookie"]`

## 🔐 Authentication & Security {#auth}

### AuthGuard Pattern
```typescript
@Controller('budgets')
@UseGuards(AuthGuard)  // Protection globale
export class BudgetController {
  @Get()
  async getBudgets(@User() user: AuthenticatedUser) {
    // user automatiquement injecté et validé
    return this.findAllBudgets.execute(user);
  }
}
```

### Custom Decorators
```typescript
// @User() decorator injecte utilisateur authentifié
// @SupabaseClient() decorator fournit client DB authentifié

@Get(':id')
async getBudget(
  @Param('id') id: string,
  @User() user: User,
  @SupabaseClient() supabase: SupabaseClient
) {
  // RLS automatiquement appliqué via supabase client
}
```

### Row Level Security (RLS)
```sql
-- Database enforce sécurité regardless of application bugs
ALTER TABLE monthly_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own budgets" ON monthly_budget
    FOR ALL TO authenticated
    USING (auth.uid() = user_id);
```

## 🛠️ Architecture des Modules (Clean Architecture)

3 couches par module, règle de dépendance `infrastructure → application → domain`. Détails complets : [ARCHITECTURE.md](../backend-nest/docs/ARCHITECTURE.md).

### Structure
```
src/modules/[domain]/
├── domain/             # Entities, invariants, ports (Symbol tokens) — TS pur
├── application/        # *.use-case.ts — @Injectable, un seul execute()
├── infrastructure/     # http/ (controller, dto), persistence/ (repository, schemas RPC), mappers/
├── [domain].module.ts
└── [domain].tokens.ts  # Re-exports des ports publics
```

La logique métier vit dans `application/*.use-case.ts` (**pas** de service). Les appels cross-module passent par des ports + Symbol tokens, jamais par import direct.

### Controller Pattern
```typescript
@Controller('budgets')
@ApiTags('budgets')
@UseGuards(AuthGuard)
export class BudgetController {
  constructor(
    private readonly createBudget: CreateBudgetUseCase,
    private readonly budgetMapper: BudgetMapper,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new budget' })
  @ApiResponse({ status: 201, type: BudgetResponseDto })
  async create(
    @Body() dto: CreateBudgetDto,
    @User() user: AuthenticatedUser,
  ): Promise<BudgetResponseDto> {
    const budget = await this.createBudget.execute(dto, user);
    return this.budgetMapper.toApi(budget);
  }
}
```

### Use Case Pattern
```typescript
@Injectable()
export class CreateBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @InjectInfoLogger(CreateBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(dto: BudgetCreate, user: AuthenticatedUser): Promise<Budget> {
    BudgetInvariants.validateCreate(dto);
    const budget = await this.repo.insert(dto, user); // nombres en clair ; le repo chiffre
    this.logger.info({ operation: 'budget.create', userId: user.id }, 'Budget created');
    return budget;
  }
}
```

> Le repository injecte `AuthenticatedSupabaseProvider` (client lu depuis le CLS) + `ENCRYPTION_PORT` : chiffre à l'écriture, déchiffre à la lecture. Les use cases ne voient jamais de ciphertext.

## 🔧 Troubleshooting Backend

### Database Connection Issues
```bash
# Test connexion Supabase
cd backend-nest
bun run generate-types:local

# Variables critiques
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### RLS Policy Issues
```bash
# Symptômes: 403 Forbidden, unauthorized access
# Solution: Vérifier policies dans Supabase Dashboard
# Tables → [table] → RLS → Policies
# Policy doit inclure auth.uid() check
```

### JWT Validation Errors
```bash
# Check logs pour "JWT validation failed"
# Vérifier SUPABASE_URL et SUPABASE_ANON_KEY cohérents
# Frontend et Backend doivent pointer même instance Supabase
```

### Performance Issues
```bash
# Tests de charge avec métriques
DEBUG_PERFORMANCE=true bun test:performance

# Monitoring request correlation
# Check logs pour request-id et duration
```

## 📚 Anti-Patterns à Éviter

### ❌ Log + Throw Redondant
```typescript
// ❌ MAUVAIS
catch (error) {
  this.logger.error({ err: error }, 'Failed to fetch budget');
  throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND);
}
```

### ❌ Exception Sans Contexte
```typescript
// ❌ MAUVAIS
throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND);

// ✅ BON
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id: budgetId },
  { userId: user.id, operation: 'findOne' }
);
```

### ❌ BadRequestException pour Validation Métier
```typescript
// ❌ MAUVAIS
throw new BadRequestException('Amount cannot exceed 10000');

// ✅ BON
throw new BusinessException(
  ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
  { reason: 'Amount cannot exceed 10000' }
);
```

## 📊 Format Réponse d'Erreur Standard

```json
{
  "success": false,
  "statusCode": 404,
  "timestamp": "2025-08-02T10:00:00Z",
  "path": "/api/v1/budgets/123",
  "method": "GET",
  "message": "Budget with ID '123' not found",
  "error": "BusinessException",
  "code": "ERR_BUDGET_NOT_FOUND",
  "details": { "id": "123" },
  "context": {
    "requestId": "abc-def-ghi",
    "userId": "user-123"
  }
}
```

---

**Resources** :
- **Troubleshooting** : [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#database--auth)
- **API Documentation** : http://localhost:3000/api/docs (Swagger)