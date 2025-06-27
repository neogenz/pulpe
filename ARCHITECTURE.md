# Guide d'Architecture - Règles pour Développeurs

## 🎯 **Principe fondamental**

**@pulpe/shared = DTOs REST uniquement** • **Types Supabase = backend uniquement** • **Simple > Complexe**

---

## 🏗️ **Structure du monorepo**

```
pulpe-workspace/
├── shared/              # 📡 Package @pulpe/shared - DTOs REST
├── backend-nest/        # 🚀 API NestJS + Types Supabase
└── frontend/           # 🎨 Interface Angular
```

---

## 📋 **Règles par dossier**

### **Rule #1 : @pulpe/shared - DTOs REST UNIQUEMENT**

#### ✅ **CE QUI VA dans @pulpe/shared**

- Schemas Zod pour DTOs REST (communication frontend ↔ backend)
- Types TypeScript inférés des schemas Zod
- **RIEN D'AUTRE !**

#### ❌ **CE QUI NE VA PAS dans @pulpe/shared**

- Types Supabase → vont dans backend/
- DTOs NestJS (`createZodDto`) → vont dans backend/
- Composants Angular → vont dans frontend/
- Logique métier → va dans backend/

#### 📁 **Structure @pulpe/shared**

```
shared/
├── dto/
│   ├── budget.dto.ts         # Schemas Zod pour API REST
│   ├── transaction.dto.ts    # Schemas Zod pour API REST
│   └── index.ts
└── index.ts                  # Export tout
```

#### 📝 **Exemple @pulpe/shared**

```typescript
// shared/dto/budget.dto.ts
import { z } from "zod";

// DTOs pour communication REST frontend ↔ backend
export const createBudgetDto = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
});

export const budgetResponseDto = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  createdAt: z.string(),
});

export type CreateBudgetDto = z.infer<typeof createBudgetDto>;
export type BudgetResponse = z.infer<typeof budgetResponseDto>;
```

---

### **Rule #2 : backend-nest/ - API + Base de données**

#### 📁 **Structure backend/**

```
src/
├── modules/
│   ├── budgets/
│   │   ├── budgets.controller.ts   # Routes HTTP
│   │   ├── budgets.service.ts      # Logique métier
│   │   ├── budgets.module.ts       # Configuration module
│   │   └── dto/                    # DTOs NestJS seulement
│   │       ├── create-budget.dto.ts
│   │       └── index.ts
├── types/
│   ├── database.types.ts           # Types Supabase (backend SEULEMENT)
│   └── supabase.types.ts
├── common/                         # Code transversal
│   ├── decorators/
│   ├── guards/
│   └── pipes/
└── app.module.ts                   # ZodValidationPipe global
```

#### 📝 **Workflow backend : Ajouter une feature**

1. **Créer le module** : `nest g module features/ma-feature`
2. **Créer le controller** : `nest g controller features/ma-feature`
3. **Créer le service** : `nest g service features/ma-feature`
4. **Créer les DTOs** à partir de @pulpe/shared :

   ```typescript
   // dto/create-ma-feature.dto.ts
   import { createZodDto } from "nestjs-zod";
   import { createMaFeatureDto } from "@pulpe/shared"; // ✅ DTO REST du package

   export class CreateMaFeatureDto extends createZodDto(createMaFeatureDto) {}
   ```

#### ✅ **Où mettre mon code backend ?**

| **Quoi**           | **Où**                    | **Exemple**                              |
| ------------------ | ------------------------- | ---------------------------------------- |
| Route HTTP         | `*.controller.ts`         | `@Post() create(@Body() dto: CreateDto)` |
| Logique métier     | `*.service.ts`            | `async create(dto, userId) { ... }`      |
| Validation DTO     | `dto/*.dto.ts`            | `extends createZodDto(dtoFromShared)`    |
| Guard/Interceptor  | `common/`                 | `auth.guard.ts`                          |
| **Types Supabase** | `types/database.types.ts` | `Database['public']['Tables']`           |
| **DTOs REST**      | `@pulpe/shared`           | `createBudgetDto`                        |

---

### **Rule #3 : frontend/ - Interface utilisateur**

#### 📁 **Structure frontend/**

```
src/app/
├── features/
│   ├── budget/
│   │   ├── components/
│   │   ├── services/
│   │   └── pages/
├── shared/
│   ├── components/
│   └── services/
└── core/
    ├── auth/
    └── layout/
```

#### ✅ **Où mettre mon code frontend ?**

| **Quoi**               | **Où**                   | **Exemple**                |
| ---------------------- | ------------------------ | -------------------------- |
| Page métier            | `features/*/pages/`      | `budget-list.page.ts`      |
| Composant métier       | `features/*/components/` | `budget-card.component.ts` |
| Service API            | `features/*/services/`   | `budget.service.ts`        |
| Composant réutilisable | `shared/components/`     | `button.component.ts`      |
| **Types REST**         | `@pulpe/shared`          | `CreateBudgetDto`          |

---

## 🔄 **Workflow : Ajouter une nouvelle feature**

### **1. Définir le contrat REST dans @pulpe/shared**

```typescript
// shared/dto/ma-feature.dto.ts
export const createMaFeatureDto = z.object({
  name: z.string().min(1),
});

export type CreateMaFeatureDto = z.infer<typeof createMaFeatureDto>;
```

### **2. Backend : Créer le module**

```typescript
// backend-nest/src/modules/ma-feature/dto/create-ma-feature.dto.ts
import { createZodDto } from "nestjs-zod";
import { createMaFeatureDto } from "@pulpe/shared";

export class CreateMaFeatureDto extends createZodDto(createMaFeatureDto) {}
```

```typescript
// backend-nest/src/modules/ma-feature/ma-feature.service.ts
import type { Database } from "../../types/database.types"; // ✅ Types Supabase backend
import { CreateMaFeatureDto } from "@pulpe/shared"; // ✅ Type REST shared

type MaFeatureInsert = Database["public"]["Tables"]["ma_features"]["Insert"];

@Injectable()
export class MaFeatureService {
  async create(dto: CreateMaFeatureDto): Promise<any> {
    // Mapping DTO REST → Supabase
    const insertData: MaFeatureInsert = {
      name: dto.name,
      user_id: "current-user-id",
    };

    return this.supabase.from("ma_features").insert(insertData);
  }
}
```

### **3. Frontend : Utiliser les types**

```typescript
// frontend/src/app/features/ma-feature/services/ma-feature.service.ts
import { CreateMaFeatureDto } from "@pulpe/shared"; // ✅ Type REST partagé

export class MaFeatureService {
  create(data: CreateMaFeatureDto): Observable<any> {
    return this.http.post("/api/ma-feature", data);
  }
}
```

---

## 🔐 **Authentification & Sécurité**

### **🎯 Principe de sécurité**

**JWT + RLS** • **Authentification Supabase** • **Zero Trust** • **Isolation par utilisateur**

### **🏗️ Architecture sécurisée**

```
Frontend ←--JWT Bearer--> Backend ←--Auth Client--> Supabase
   ↓                         ↓                        ↓
AuthGuard              AuthGuard                   RLS Policies
AuthAPI               User Decorator               auth.uid()
Signals               SupabaseClient              row-level filtering
```

---

### **Rule #4 : Frontend - Authentification Angular**

#### 📁 **Structure auth frontend**

```
core/auth/
├── auth-api.ts              # Service Supabase + Signals
├── auth-guard.ts           # Protection routes
├── auth-interceptor.ts     # Injection JWT automatique
├── auth-error-localizer.ts # Gestion erreurs i18n
└── public-guard.ts         # Routes publiques
```

#### 🔑 **AuthApi avec Signals**

```typescript
// core/auth/auth-api.ts
@Injectable({ providedIn: "root" })
export class AuthApi {
  #supabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey
  );
  #sessionSignal = signal<Session | null>(null);
  #isLoadingSignal = signal<boolean>(true);

  // Computed signals pour l'état dérivé
  readonly isAuthenticated = computed(
    () => !!this.#sessionSignal() && !this.#isLoadingSignal()
  );

  async signInWithEmail(email: string, password: string) {
    const { error } = await this.#supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    return { success: !error, error: error?.message };
  }

  async getCurrentSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await this.#supabaseClient.auth.getSession();
    return session;
  }
}
```

#### 🛡️ **AuthGuard réactif**

```typescript
// core/auth/auth-guard.ts
export const authGuard: CanActivateFn = () => {
  const authApi = inject(AuthApi);
  const router = inject(Router);

  return toObservable(authApi.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) => {
      if (state.isAuthenticated) return true;
      return router.createUrlTree([ROUTES.ONBOARDING]);
    })
  );
};
```

#### 🔧 **AuthInterceptor avec refresh automatique**

```typescript
// core/auth/auth-interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authApi = inject(AuthApi);

  return from(addAuthToken(req, authApi)).pipe(
    switchMap((authReq) => next(authReq)),
    catchError((error) => {
      if (error.status === 401) {
        // Token expiré, essayer de le rafraîchir
        return from(authApi.refreshSession()).pipe(
          switchMap((refreshSuccess) => {
            if (refreshSuccess) {
              // Réessayer avec nouveau token
              return from(addAuthToken(req, authApi)).pipe(
                switchMap((authReq) => next(authReq))
              );
            }
            // Déconnecter si impossible de rafraîchir
            authApi.signOut();
            return throwError(() => new Error("Session expirée"));
          })
        );
      }
      return throwError(() => error);
    })
  );
};

async function addAuthToken(req: HttpRequest<unknown>, authApi: AuthApi) {
  const session = await authApi.getCurrentSession();
  if (session?.access_token) {
    return req.clone({
      headers: req.headers.set(
        "Authorization",
        `Bearer ${session.access_token}`
      ),
    });
  }
  return req;
}
```

---

### **Rule #5 : Backend - Authentification NestJS**

#### 📁 **Structure auth backend**

```
common/
├── guards/
│   ├── auth.guard.ts           # Validation JWT obligatoire
│   └── optional-auth.guard.ts  # Validation JWT optionnelle
├── decorators/
│   └── user.decorator.ts       # Injection User + SupabaseClient
└── interceptors/
    └── response.interceptor.ts # Formatage réponses
```

#### 🛡️ **AuthGuard avec validation JWT**

```typescript
// common/guards/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromHeader(request);

    if (!accessToken) {
      throw new UnauthorizedException("Token d'accès requis");
    }

    const supabase =
      this.supabaseService.createAuthenticatedClient(accessToken);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new UnauthorizedException("Token invalide ou expiré");
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

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    const [type, token] = authHeader?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
```

#### 💉 **User Decorators**

```typescript
// common/decorators/user.decorator.ts
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);

export const SupabaseClient = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.supabase;
  }
);
```

#### 🔧 **SupabaseService**

```typescript
// modules/supabase/supabase.service.ts
@Injectable()
export class SupabaseService {
  createAuthenticatedClient(accessToken: string): AuthenticatedSupabaseClient {
    return createClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
}
```

#### 🎮 **Utilisation dans les Controllers**

```typescript
// modules/budgets/budgets.controller.ts
@Controller("budgets")
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BudgetsController {
  @Get()
  async findAll(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient
  ): Promise<BudgetListResponse> {
    return this.budgetService.findAll(supabase);
  }

  @Post()
  async create(
    @Body() createBudgetDto: BudgetCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient
  ): Promise<BudgetResponse> {
    return this.budgetService.create(createBudgetDto, user, supabase);
  }
}
```

---

### **Rule #6 : Database - Row Level Security (RLS)**

#### 🗄️ **Tables avec RLS activé**

```sql
-- Activation RLS sur toutes les tables
ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."budget_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template_transactions" ENABLE ROW LEVEL SECURITY;
```

#### 🔐 **Politiques par opération**

```sql
-- SELECT : Utilisateurs voient seulement leurs données
CREATE POLICY "Utilisateurs peuvent voir leurs budgets"
ON "public"."budgets" FOR SELECT
USING (auth.uid() = user_id);

-- INSERT : Utilisateurs créent seulement pour eux
CREATE POLICY "Utilisateurs peuvent créer leurs budgets"
ON "public"."budgets" FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE : Utilisateurs modifient seulement leurs données
CREATE POLICY "Utilisateurs peuvent modifier leurs budgets"
ON "public"."budgets" FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE : Utilisateurs suppriment seulement leurs données
CREATE POLICY "Utilisateurs peuvent supprimer leurs budgets"
ON "public"."budgets" FOR DELETE
USING (auth.uid() = user_id);
```

#### 🔗 **Politiques avec relations**

```sql
-- Templates publics ET privés
CREATE POLICY "Users can view own templates and public templates"
ON "public"."budget_templates" FOR SELECT
USING ((auth.uid() = user_id) OR (user_id IS NULL));

-- Transactions de templates basées sur l'accès au template
CREATE POLICY "Users can view template transactions based on template access"
ON "public"."template_transactions" FOR SELECT
USING (EXISTS (
  SELECT 1 FROM "public"."budget_templates"
  WHERE ("budget_templates"."id" = "template_transactions"."template_id")
  AND ((auth.uid() = "budget_templates"."user_id") OR ("budget_templates"."user_id" IS NULL))
));
```

#### 🔑 **Fonctions sécurisées**

```sql
-- Fonction pour créer budget + transactions atomiquement
CREATE OR REPLACE FUNCTION create_budget_from_onboarding_with_transactions(
  p_user_id uuid,
  p_month integer,
  p_year integer,
  p_description text,
  -- ... autres paramètres
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER  -- ✅ Exécution avec privilèges fonction
SET search_path TO 'public'        -- ✅ Sécurisation du search_path
AS $$
BEGIN
  -- Insertion budget avec user_id contrôlé
  INSERT INTO public.budgets (user_id, month, year, description)
  VALUES (p_user_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  -- Insertions transactions liées avec user_id contrôlé
  IF p_monthly_income > 0 THEN
    INSERT INTO public.transactions (user_id, budget_id, ...)
    VALUES (p_user_id, new_budget_id, ...);
  END IF;

  RETURN jsonb_build_object('budget', ...);
END;
$$;
```

#### 🔗 **Contraintes d'intégrité**

```sql
-- Foreign keys vers auth.users avec suppression en cascade
ALTER TABLE "public"."budgets"
ADD CONSTRAINT "budgets_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Index pour les performances des politiques RLS
CREATE INDEX "budgets_user_id_idx" ON "public"."budgets" USING btree ("user_id");
CREATE INDEX "transactions_user_id_idx" ON "public"."transactions" USING btree ("user_id");

-- Contrainte unique par utilisateur
ALTER TABLE "public"."budgets"
ADD CONSTRAINT "unique_month_year_per_user"
UNIQUE ("month", "year", "user_id");
```

---

### **🔒 Checklist Sécurité**

#### **✅ Frontend**

- [ ] **AuthGuard** sur toutes les routes privées
- [ ] **AuthInterceptor** configuré pour ajouter JWT automatiquement
- [ ] **Refresh automatique** des tokens expirés
- [ ] **Signals** pour l'état d'authentification réactif
- [ ] **Localisation** des erreurs d'authentification
- [ ] **Nettoyage** du localStorage à la déconnexion

#### **✅ Backend**

- [ ] **AuthGuard** sur tous les controllers privés
- [ ] **@User()** decorator pour injection utilisateur authentifié
- [ ] **@SupabaseClient()** decorator pour client authentifié
- [ ] **Validation JWT** avec `supabase.auth.getUser()`
- [ ] **Mapping** DTO REST → Types Supabase sécurisé
- [ ] **Gestion d'erreurs** d'authentification appropriée

#### **✅ Database**

- [ ] **RLS activé** sur toutes les tables
- [ ] **Politiques** pour chaque opération (SELECT, INSERT, UPDATE, DELETE)
- [ ] **auth.uid()** dans toutes les politiques
- [ ] **Foreign keys** vers auth.users avec CASCADE
- [ ] **Index** sur user_id pour les performances
- [ ] **SECURITY DEFINER** sur les fonctions sensibles

#### **🎯 Principes de sécurité**

1. **"Zero Trust"** → Valider chaque requête avec JWT
2. **"Least Privilege"** → RLS isole automatiquement par utilisateur
3. **"Defense in Depth"** → Frontend + Backend + Database layers
4. **"Fail Secure"** → Erreur d'auth = accès refusé
5. **"Audit Trail"** → Logs des tentatives d'authentification

---

## 🚫 **Anti-patterns à éviter**

### ❌ **NE PAS FAIRE**

```typescript
// ❌ Types Supabase dans @pulpe/shared
// shared/types/database.types.ts
export type Database = { ... }; // ❌ VA DANS BACKEND !

// ❌ DTO NestJS dans @pulpe/shared
// shared/dto/budget.dto.ts
export class CreateBudgetDto extends createZodDto(schema) {} // ❌ DÉPENDANCE NESTJS !

// ❌ Logique métier dans controller
@Post()
async create(@Body() dto) {
  const result = await this.supabase.insert(...); // ❌ VA DANS SERVICE !
  return result;
}
```

### ✅ **FAIRE**

```typescript
// ✅ DTOs REST dans @pulpe/shared
// shared/dto/budget.dto.ts
export const createBudgetDto = z.object({ name: z.string() });
export type CreateBudgetDto = z.infer<typeof createBudgetDto>;

// ✅ Types Supabase dans backend seulement
// backend-nest/types/database.types.ts
export type Database = { ... };

// ✅ Service avec mapping DTO → Supabase
async create(dto: CreateBudgetDto) {
  const insertData: BudgetInsert = {
    name: dto.name,
    user_id: currentUserId
  };
  return this.supabase.insert(insertData);
}
```

---

## 📊 **Checklist avant commit**

### **✅ J'ai respecté les règles ?**

- [ ] **DTOs REST SEULEMENT** dans `@pulpe/shared`
- [ ] **Types Supabase** dans `backend-nest/types/`
- [ ] DTOs NestJS dans `backend-nest/modules/*/dto/`
- [ ] Logique métier dans les services, pas les controllers
- [ ] Validation automatique via `ZodValidationPipe` global
- [ ] `@pulpe/shared` ne contient AUCUN type Supabase

### **🎯 Questions à se poser**

1. **"Où va mon DTO REST ?"** → `@pulpe/shared`
2. **"Où vont mes types Supabase ?"** → `backend-nest/types/`
3. **"Où va ma validation backend ?"** → DTO NestJS créé depuis DTO shared
4. **"Où va ma logique métier ?"** → `*.service.ts`

---

## 📚 **Exemple complet**

### **Créer une entité "Category"**

```typescript
// 1. shared/dto/category.dto.ts
export const createCategoryDto = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
});

export type CreateCategoryDto = z.infer<typeof createCategoryDto>;
```

```typescript
// 2. backend-nest/src/types/database.types.ts
export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { id: string; name: string; color: string; user_id: string };
        Insert: { name: string; color: string; user_id: string };
      };
    };
  };
};
```

```typescript
// 3. backend-nest/src/modules/categories/dto/create-category.dto.ts
import { createZodDto } from "nestjs-zod";
import { createCategoryDto } from "@pulpe/shared";

export class CreateCategoryDto extends createZodDto(createCategoryDto) {}
```

```typescript
// 4. backend-nest/src/modules/categories/categories.service.ts
import type { Database } from '../../types/database.types';
import { CreateCategoryDto } from '@pulpe/shared';

type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

async create(dto: CreateCategoryDto, userId: string) {
  const insertData: CategoryInsert = {
    name: dto.name,
    color: dto.color,
    user_id: userId
  };

  return this.supabase.from('categories').insert(insertData);
}
```

```typescript
// 5. frontend/src/app/features/category/services/category.service.ts
import { CreateCategoryDto } from '@pulpe/shared';

create(data: CreateCategoryDto): Observable<any> {
  return this.http.post('/api/categories', data);
}
```

---

## 🎉 **TL;DR**

1. **DTOs REST** → `@pulpe/shared`
2. **Types Supabase** → `backend-nest/types/`
3. **DTOs NestJS** → `backend-nest/modules/*/dto/`
4. **Logique métier** → `*.service.ts`
5. **JAMAIS de types Supabase dans @pulpe/shared !**

**@pulpe/shared = contrat REST uniquement, rien d'autre !** ✨
