# Architecture Backend - Deep Dive 🏗️

Guide complet de l'architecture backend NestJS pour comprendre la structure, les patterns et les bonnes pratiques appliquées.

## 🎯 **Principes Architecturaux**

### **Séparation des Responsabilités**

- **Controllers** : Gestion HTTP uniquement (routing, validation, réponses)
- **Services** : Logique métier et orchestration
- **Guards** : Authentification et autorisation
- **DTOs** : Contrats d'interface entre couches

### **Type Safety Complète**

- **Compile-time** : Types TypeScript stricts
- **Runtime** : Validation Zod des données
- **Database** : Types auto-générés depuis Supabase

### **Shared Contracts**

- **DTOs REST** : Package `pulpe-shared` pour cohérence frontend/backend
- **Types Supabase** : Isolés dans le backend (`src/types/`)

## 📁 **Structure du Projet**

```
backend-nest/src/
├── modules/              # 🎯 Modules métier par domaine
│   ├── auth/            # Authentification JWT
│   ├── budget/          # Gestion des budgets
│   ├── transaction/     # Gestion des transactions
│   ├── budget-template/ # Templates de budgets
│   ├── user/            # Profils utilisateurs
│   ├── supabase/        # Service Supabase
│   └── debug/           # Endpoints de debug
├── common/              # 🛠️ Composants transversaux
│   ├── guards/          # AuthGuard
│   ├── decorators/      # @User(), @SupabaseClient()
│   ├── interceptors/    # Response formatting
│   ├── filters/         # Exception handling global
│   ├── middleware/      # Request ID tracking
│   ├── pipes/           # Validation pipes
│   ├── dto/             # DTOs communs (ErrorResponse, etc.)
│   └── logger/          # Service de logging
├── types/               # 🔒 Types Supabase (backend only)
│   ├── database.types.ts    # Types auto-générés
│   └── supabase-helpers.ts  # Helpers de types
├── config/              # ⚙️ Configuration environnement
├── test/                # 🧪 Utilitaires de test
├── app.module.ts        # Module racine
└── main.ts              # Bootstrap application
```

## 🎮 **Architecture d'un Module**

### **Structure Standard**

```typescript
modules/budget/
├── budget.controller.ts     # Routes HTTP + validation
├── budget.service.ts        # Logique métier
├── budget.module.ts         # Configuration module
├── budget.mapper.ts         # Transformation DTO ↔ Entity
├── dto/                     # DTOs NestJS
│   ├── budget-swagger.dto.ts    # DTOs Swagger avec createZodDto
│   └── index.ts
├── entities/                # Entités métier
│   ├── budget.entity.ts
│   └── index.ts
└── schemas/                 # Schemas Zod locaux
    └── budget.db.schema.ts
```

### **Controller Pattern**

```typescript
@Controller('budgets')
@UseGuards(AuthGuard) // 🔐 Protection globale
@ApiBearerAuth() // 📚 Doc Swagger
export class BudgetController {
  @Get()
  @ApiOperation({ summary: 'List all budgets' })
  @ApiResponse({ type: BudgetListResponseDto })
  async findAll(
    @User() user: AuthenticatedUser, // 👤 Injection utilisateur
    @SupabaseClient() supabase: AuthenticatedSupabaseClient, // 🗄️ Client DB
  ): Promise<BudgetListResponse> {
    return this.budgetService.findAll(supabase);
  }

  @Post()
  async create(
    @Body() createDto: BudgetCreateDto, // ✅ Validation automatique
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    return this.budgetService.create(createDto, user, supabase);
  }
}
```

### **Service Pattern**

```typescript
@Injectable()
export class BudgetService {
  constructor(private readonly budgetMapper: BudgetMapper) {}

  async findAll(supabase: AuthenticatedSupabaseClient): Promise<BudgetListResponse> {
    // 1. Récupération données
    const { data: budgetsDb, error } = await supabase
      .from('budgets')
      .select('*')
      .order('year', { ascending: false });

    // 2. Gestion erreurs
    if (error) {
      this.logger.error('Erreur récupération budgets:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération');
    }

    // 3. Validation et transformation
    const validBudgets = this.filterValidBudgets(budgetsDb || []);
    const apiData = this.budgetMapper.toApiList(validBudgets);

    // 4. Réponse typée
    return { success: true, data: apiData };
  }

  // Méthodes privées pour logique métier
  private filterValidBudgets(rawBudgets: unknown[]): Budget[] { ... }
  private validateCreateBudgetDto(dto: BudgetCreate): BudgetCreate { ... }
}
```

## 🔐 **Système d'Authentification**

### **Architecture Sécurisée**

```
Frontend ←--JWT Bearer--> Backend ←--Auth Client--> Supabase
   ↓                         ↓                        ↓
AuthGuard              AuthGuard                   RLS Policies
AuthAPI               User Decorator               auth.uid()
Signals               SupabaseClient              row-level filtering
```

### **AuthGuard Implementation**

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromHeader(request);

    if (!accessToken) {
      throw new UnauthorizedException("Token d'accès requis");
    }

    // Validation JWT avec Supabase
    const supabase =
      this.supabaseService.createAuthenticatedClient(accessToken);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }

    // Injection dans la requête pour les decorators
    request.user = {
      id: user.id,
      email: user.email!,
      firstName: user.user_metadata?.firstName,
      lastName: user.user_metadata?.lastName,
    };
    request.supabase = supabase;

    return true;
  }
}
```

### **Custom Decorators**

```typescript
// Injection de l'utilisateur authentifié
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Injection du client Supabase authentifié
export const SupabaseClient = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.supabase;
  },
);
```

## ✅ **Système de Validation**

### **Architecture en Couches**

```
Frontend DTO (Zod) → Backend DTO (createZodDto) → Service (Business Logic) → Database (RLS)
```

### **DTOs avec createZodDto**

```typescript
// Import du schema partagé
import { budgetCreateSchema } from 'pulpe-shared';
import { createZodDto } from 'nestjs-zod';

// DTO NestJS généré automatiquement
export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}
```

### **Validation Pipeline**

```typescript
// 1. Global Validation Pipe (app.module.ts)
app.useGlobalPipes(new ZodValidationPipe());

// 2. Automatic DTO validation
@Post()
async create(@Body() dto: BudgetCreateDto) { // ✅ Auto-validation
  // dto est déjà validé et typé
}

// 3. Service layer validation
private validateCreateBudgetDto(dto: BudgetCreate): BudgetCreate {
  // Business rules validation
  if (dto.year < 2020 || dto.year > 2030) {
    throw new BadRequestException('Invalid year range');
  }
  return dto;
}
```

## 🗄️ **Intégration Supabase**

### **Service Architecture**

```typescript
@Injectable()
export class SupabaseService {
  createAuthenticatedClient(accessToken: string): AuthenticatedSupabaseClient {
    return createClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
  }
}
```

### **Types Safety avec Supabase**

```typescript
// Types auto-générés depuis Supabase
import type { Database } from '../../types/database.types';

// Helper types
type BudgetInsert = Database['public']['Tables']['budgets']['Insert'];
type BudgetRow = Database['public']['Tables']['budgets']['Row'];

// Utilisation dans services
async create(dto: BudgetCreate, userId: string) {
  const insertData: BudgetInsert = {
    month: dto.month,
    year: dto.year,
    description: dto.description,
    user_id: userId, // ✅ Type safety
  };

  const { data, error } = await supabase
    .from('budgets')
    .insert(insertData)
    .select()
    .single();

  return data; // ✅ Type: BudgetRow
}
```

## 🔄 **Data Transformation Pattern**

### **Mapper Architecture**

```typescript
@Injectable()
export class BudgetMapper {
  // Database → API transformation
  toApi(budgetDb: BudgetRow): Budget {
    return {
      id: budgetDb.id,
      month: budgetDb.month,
      year: budgetDb.year,
      description: budgetDb.description,
      createdAt: budgetDb.created_at, // snake_case → camelCase
      updatedAt: budgetDb.updated_at,
      userId: budgetDb.user_id,
    };
  }

  // API → Database transformation
  toDbInsert(dto: BudgetCreate, userId: string): BudgetInsert {
    return {
      month: dto.month,
      year: dto.year,
      description: dto.description,
      user_id: userId, // camelCase → snake_case
    };
  }

  // Batch transformation
  toApiList(budgetsDb: BudgetRow[]): Budget[] {
    return budgetsDb.map((budget) => this.toApi(budget));
  }
}
```

## 🛡️ **Error Handling Global**

### **Exception Filter**

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Déterminer le status code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Format de réponse standardisé
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: this.getErrorMessage(exception),
    };

    // Log des erreurs serveur
    if (status >= 500) {
      this.logger.error('Server Error:', exception);
    }

    response.status(status).json(errorResponse);
  }
}
```

## 📚 **Documentation OpenAPI**

### **Configuration Swagger**

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('Pulpe Budget API')
  .setDescription("API backend pour l'application de gestion de budget")
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
```

### **Controller Documentation**

```typescript
@ApiTags('Budgets')
@ApiBearerAuth()
export class BudgetController {
  @Get()
  @ApiOperation({
    summary: 'List all user budgets',
    description: 'Retrieves all budgets belonging to the authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Budget list retrieved successfully',
    type: BudgetListResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters',
    type: ErrorResponseDto,
  })
  async findAll() { ... }
}
```

## 🧪 **Testing Architecture**

### **Testing Strategy**

- **Unit Tests** : Services avec mocks Supabase
- **Integration Tests** : Controllers avec Supertest
- **Performance Tests** : Métriques de charge et latence

### **Mock System**

```typescript
// test-utils.ts
export function createMockSupabaseClient() {
  const mocks = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
  };

  mocks.from.mockReturnValue({
    select: mocks.select.mockReturnValue({
      insert: mocks.insert.mockReturnValue({
        single: mocks.single,
      }),
    }),
  });

  return { mocks, client: mocks as any };
}
```

## 🎯 **Bonnes Pratiques Appliquées**

### **NestJS Best Practices**

- ✅ **Feature modules** : Organisation par domaine métier
- ✅ **Dependency Injection** : Constructor injection systématique
- ✅ **Guards & Interceptors** : Séparation des préoccupations
- ✅ **Custom Decorators** : Abstraction des détails techniques
- ✅ **Exception Filters** : Gestion centralisée des erreurs

### **TypeScript Best Practices**

- ✅ **Strict Mode** : Configuration TypeScript stricte
- ✅ **Type Guards** : Validation runtime avec Zod
- ✅ **Interface Segregation** : DTOs spécifiques par use case
- ✅ **No Any** : Prohibition du type `any`

### **Security Best Practices**

- ✅ **JWT Validation** : Vérification systématique des tokens
- ✅ **RLS Integration** : Sécurité au niveau base de données
- ✅ **Input Validation** : Validation complète des entrées
- ✅ **Error Sanitization** : Pas d'exposition d'informations sensibles

## 🚀 **Performance & Monitoring**

### **Logging Strategy**

```typescript
// Structured logging avec Pino
this.logger.log('Budget created', {
  userId: user.id,
  budgetId: result.id,
  duration: Date.now() - start,
});
```

### **Request Tracking**

```typescript
// Middleware de correlation ID
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req.id = randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  }
}
```

---

🎯 **Cette architecture garantit maintenabilité, scalabilité et qualité de code pour le backend NestJS.**
