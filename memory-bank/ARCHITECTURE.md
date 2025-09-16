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

#### 📝 **Exemple @pulpe/shared**

```typescript
// shared/dto/budget.dto.ts
import { z } from "zod";

// DTOs pour communication REST frontend ↔ backend
export const createBudgetDto = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
});

export type CreateBudgetDto = z.infer<typeof createBudgetDto>;
```

---

### **Rule #2 : backend-nest/ - API + Base de données**

#### 📁 **Structure backend/**

```
src/
├── modules/
│   ├── monthly-budgets/
│   │   ├── monthly-budgets.controller.ts   # Routes HTTP
│   │   ├── monthly-budgets.service.ts      # Logique métier
│   │   ├── monthly-budgets.mapper.ts       # Transformation DTO ↔ Entity
│   │   ├── monthly-budgets.module.ts       # Configuration module
│   │   └── dto/                    # DTOs NestJS seulement
│   │       ├── create-budget.dto.ts
│   │       └── index.ts
├── types/
│   ├── database.types.ts           # Types Supabase (backend SEULEMENT)
│   └── supabase.types.ts
├── common/                         # Code transversal
│   ├── decorators/                 # @User(), @SupabaseClient()
│   ├── guards/                     # AuthGuard
│   ├── filters/                    # Exception handling global
│   └── pipes/                      # Validation pipes
└── app.module.ts                   # ZodValidationPipe global + Pino logging
```

#### 🔧 **Patterns Backend Essentiels**

- **Controller Pattern** : Validation HTTP + délégation aux services
- **Service Pattern** : Logique métier + orchestration
- **Mapper Pattern** : Transformation DTO ↔ Entity (snake_case ↔ camelCase)
- **Exception Filter** : Gestion centralisée des erreurs avec format standardisé
- **Structured Logging** : Pino avec correlation ID et redaction des données sensibles

#### ✅ **Où mettre mon code backend ?**

| **Quoi**           | **Où**                    | **Exemple**                              |
| ------------------ | ------------------------- | ---------------------------------------- |
| Route HTTP         | `*.controller.ts`         | `@Post() create(@Body() dto: CreateDto)` |
| Logique métier     | `*.service.ts`            | `async create(dto, userId) { ... }`      |
| Transformation     | `*.mapper.ts`             | `toApi(dbRow)`, `toDbInsert(dto)`        |
| Validation DTO     | `dto/*.dto.ts`            | `extends createZodDto(dtoFromShared)`    |
| Guard/Interceptor  | `common/`                 | `auth.guard.ts`                          |
| **Types Supabase** | `types/database.types.ts` | `Database['public']['Tables']`           |
| **DTOs REST**      | `@pulpe/shared`           | `createBudgetDto`                        |

---

### **Rule #3 : frontend/ - Interface utilisateur**

#### 📁 **Structure frontend/ - 5 Types Architecturaux**

```
src/app/
├── core/                    # Services, guards, interceptors (eager-loaded)
│   ├── auth/               # AuthApi, guards, interceptors
│   ├── budget/             # Services métier budget
│   └── config/             # Configuration app
├── layout/                  # Shell application (header, navigation)
├── ui/                      # Composants réutilisables stateless
├── feature/                 # Domaines métier (lazy-loaded)
│   ├── budget/
│   └── transaction/
└── pattern/                 # Composants stateful réutilisables
```

#### 🎯 **Types Architecturaux & Contraintes**

| **Type**   | **Purpose**                        | **Contraintes**                                   | **Loading**   |
| ---------- | ---------------------------------- | ------------------------------------------------- | ------------- |
| `core`     | Services partagés headless         | Pas de composants, seulement des `@Injectable`   | Eager         |
| `layout`   | Shell application                  | Consomme `core` + `ui`                            | Eager         |
| `ui`       | Composants stateless réutilisables | Pas d'injection de services, seulement I/O       | Cherry-picked |
| `feature`  | Domaines métier isolés             | Isolation complète, pas de dépendances entre eux | Lazy-loaded   |
| `pattern`  | Composants stateful réutilisables  | Peut injecter `core`, consomme `ui`               | Imported      |

#### 🔗 **Règles de Dépendances (Acyclique)**

```
core     ← layout, feature, pattern
ui       ← layout, feature, pattern
pattern  ← feature
feature  ← (isolé, pas de dépendances siblings)
```

#### ⚡ **Patterns Frontend Modernes**

- **Standalone Components** : Pas de NgModules, tout est standalone
- **Signal-based** : Angular signals pour l'état réactif
- **OnPush Strategy** : Performance avec `ChangeDetectionStrategy.OnPush`
- **Lazy Loading** : Toutes les features via `loadChildren`
- **Material Design 3** : Angular Material v20 + Tailwind CSS v4

#### ✅ **Où mettre mon code frontend ?**

| **Quoi**               | **Où**                   | **Exemple**                |
| ---------------------- | ------------------------ | -------------------------- |
| Service d'état global  | `core/[domain]/`         | `core/auth/auth-api.ts`    |
| Composant métier       | `feature/*/components/`  | `budget-card.component.ts` |
| Service API feature    | `feature/*/services/`    | `budget.service.ts`        |
| Composant réutilisable | `ui/`                    | `button.component.ts`      |
| Shell application      | `layout/`                | `header.component.ts`      |
| **Types REST**         | `@pulpe/shared`          | `CreateBudgetDto`          |

---

## 🔐 **Authentification & Sécurité**

### **🎯 Principe de sécurité**

**JWT + RLS** • **Authentification Supabase** • **Zero Trust** • **Isolation par utilisateur**

### **🏗️ Architecture sécurisée**

```
Frontend ←--JWT Bearer--> Backend ←--Auth Client--> Supabase
   ↓                         ↓                        ↓
AuthGuard              AuthGuard                   RLS Policies
AuthAPI               @User() decorator            auth.uid()
Signals               @SupabaseClient()           row-level filtering
```

### **🔑 Patterns d'Authentification**

#### Frontend (Angular)
- **AuthApi** avec signals pour l'état réactif
- **AuthGuard** avec `toObservable()` pour protection des routes
- **AuthInterceptor** avec refresh automatique des tokens

#### Backend (NestJS)
- **AuthGuard** valide JWT avec `supabase.auth.getUser()`
- **@User() decorator** injecte l'utilisateur authentifié
- **@SupabaseClient() decorator** fournit le client authentifié

#### Database (Supabase)
- **Row Level Security (RLS)** activé sur toutes les tables
- **Policies** basées sur `auth.uid()` pour isolation automatique
- **SECURITY DEFINER** sur les fonctions sensibles

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

### **2. Backend : Créer le module complet**

```typescript
// Module structure avec mapper
backend-nest/src/modules/ma-feature/
├── ma-feature.controller.ts
├── ma-feature.service.ts
├── ma-feature.mapper.ts      # ← Pattern de transformation
├── ma-feature.module.ts
└── dto/create-ma-feature.dto.ts

// Service avec mapper
async create(dto: CreateMaFeatureDto, user: AuthenticatedUser) {
  const insertData = this.mapper.toDbInsert(dto, user.id);
  const result = await supabase.from('ma_features').insert(insertData);
  return this.mapper.toApi(result);
}
```

### **3. Frontend : Feature isolée**

```typescript
// feature/ma-feature/ma-feature.routes.ts
export const routes: Routes = [
  { path: '', component: MaFeatureComponent }
];

// feature/ma-feature/services/ma-feature.service.ts
@Injectable()
export class MaFeatureService {
  create(data: CreateMaFeatureDto) {
    return this.http.post('/api/v1/ma-feature', data);
  }
}
```

---

## 🚫 **Anti-patterns à éviter**

### ❌ **NE PAS FAIRE**

```typescript
// ❌ Types Supabase dans @pulpe/shared
export type Database = { ... }; // VA DANS BACKEND !

// ❌ Injection de services dans ui/
@Component({ /* ui component */ })
export class UiComponent {
  constructor(private service: SomeService) {} // INTERDIT !
}

// ❌ Dépendances entre features
import { FeatureAService } from '../feature-a/'; // INTERDIT !

// ❌ Logique métier dans controller
@Post() create(@Body() dto) {
  return this.supabase.insert(...); // VA DANS SERVICE !
}
```

### ✅ **FAIRE**

```typescript
// ✅ DTOs REST dans @pulpe/shared
export const createBudgetDto = z.object({ name: z.string() });

// ✅ Composant ui stateless
@Component({ /* ui component */ })
export class UiComponent {
  @Input() data: any;
  @Output() action = new EventEmitter();
}

// ✅ Feature isolée utilisant core services
@Component({ /* feature component */ })
export class FeatureComponent {
  constructor(private coreService: CoreService) {}
}
```

---

## 📊 **Quick Reference**

### **🎯 Questions de placement**

1. **"Où va mon DTO REST ?"** → `@pulpe/shared`
2. **"Où vont mes types Supabase ?"** → `backend-nest/types/`
3. **"Mon composant est-il stateless ?"** → `ui/` sinon `feature/` ou `pattern/`
4. **"Ma feature dépend d'une autre ?"** → Extraire vers `core/` ou `pattern/`
5. **"Où va ma logique métier ?"** → `*.service.ts` avec mapper pour transformation

### **🔒 Checklist Sécurité**

- [ ] **RLS activé** sur toutes les tables
- [ ] **AuthGuard** sur routes privées (frontend + backend)
- [ ] **JWT validation** avec `supabase.auth.getUser()`
- [ ] **Policies** basées sur `auth.uid()`
- [ ] **Sensitive data redaction** dans les logs

### **⚡ Performance Checklist**

- [ ] **OnPush strategy** sur tous les composants
- [ ] **Lazy loading** pour toutes les features
- [ ] **Signals** pour l'état réactif
- [ ] **Tree-shaking** optimisé via standalone components
- [ ] **Bundle analysis** régulier avec `pnpm analyze`

---

## 🎉 **TL;DR**

1. **DTOs REST** → `@pulpe/shared` (Zod schemas uniquement)
2. **Types Supabase** → `backend-nest/types/` (jamais dans shared !)
3. **Frontend** → 5 types architecturaux avec isolation stricte
4. **Backend** → Controller + Service + Mapper pattern
5. **Sécurité** → JWT + RLS + Zero Trust partout
6. **Performance** → Standalone + Signals + OnPush + Lazy loading

**@pulpe/shared = contrat REST uniquement, rien d'autre !** ✨