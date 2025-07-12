# Base de Données - Supabase & Validation 🗄️

Guide complet pour comprendre la gestion des données, la sécurité Row Level Security (RLS) et l'architecture de validation avec Supabase.

## 🎯 **Architecture de Données**

### **Principe de Sécurité**

**JWT + RLS + Validation** = **Zero Trust Data Access**

```
Frontend ←--JWT Bearer--> Backend ←--Auth Client--> Supabase Database
   ↓                         ↓                           ↓
Type Safety            Validation Zod                RLS Policies
@pulpe/shared         Backend Types                 auth.uid()
```

### **Couches de Validation**

1. **Frontend** : Validation UX avec `@pulpe/shared`
2. **Backend** : Validation métier avec Zod + business rules
3. **Database** : Validation structurelle avec RLS + contraintes

## 🏗️ **Structure de la Base de Données**

### **Tables Principales**

```sql
-- Utilisateurs (gérés par Supabase Auth)
auth.users
├── id (uuid, primary key)
├── email (text, unique)
├── user_metadata (jsonb)
└── ...

-- Budgets (données métier)
public.monthly_budget
├── id (uuid, primary key)
├── user_id (uuid, foreign key → auth.users.id)
├── month (integer, 1-12)
├── year (integer, >= 2020)
├── description (text)
├── template_id (uuid, nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)

-- Transactions
public.transaction
├── id (uuid, primary key)
├── user_id (uuid, foreign key → auth.users.id)
├── budget_id (uuid, foreign key → monthly_budget.id)
├── amount (numeric(12,2), > 0)
├── type (transaction_type: expense|income|saving)
├── expense_type (expense_type: fixed|variable)
├── name (text)
├── description (text, nullable)
├── is_recurring (boolean)
├── created_at (timestamptz)
└── updated_at (timestamptz)

-- Templates de budgets
public.template
├── id (uuid, primary key)
├── user_id (uuid, nullable) -- NULL = template public
├── name (text)
├── description (text, nullable)
├── category (text, nullable)
├── is_default (boolean)
├── created_at (timestamptz)
└── updated_at (timestamptz)

-- Transactions de templates
public.template_line
├── id (uuid, primary key)
├── template_id (uuid, foreign key → template.id)
├── amount (numeric(12,2))
├── type (transaction_type)
├── expense_type (expense_type)
├── name (text)
├── description (text)
├── is_recurring (boolean, default true)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

### **Types Énumérés**

```sql
-- Types de transaction
CREATE TYPE transaction_type AS ENUM ('expense', 'income', 'saving');

-- Types de dépenses
CREATE TYPE expense_type AS ENUM ('fixed', 'variable');
```

## 🔐 **Row Level Security (RLS)**

### **Principe de Fonctionnement**

RLS applique automatiquement des filtres sur chaque requête SQL basés sur l'utilisateur authentifié :

```sql
-- Chaque requête est automatiquement transformée :
SELECT * FROM monthly_budget;
-- Devient :
SELECT * FROM monthly_budget WHERE user_id = auth.uid();
```

### **Activation RLS**

```sql
-- Activation sur toutes les tables
ALTER TABLE "public"."monthly_budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template_line" ENABLE ROW LEVEL SECURITY;
```

### **Politiques RLS par Table**

#### **Monthly Budget - Isolation Utilisateur**

```sql
-- SELECT : Voir seulement ses budgets
CREATE POLICY "Utilisateurs peuvent voir leurs budgets"
ON "public"."monthly_budget" FOR SELECT
USING (auth.uid() = user_id);

-- INSERT : Créer seulement pour soi
CREATE POLICY "Utilisateurs peuvent créer leurs budgets"
ON "public"."monthly_budget" FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE : Modifier seulement ses budgets
CREATE POLICY "Utilisateurs peuvent modifier leurs budgets"
ON "public"."monthly_budget" FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE : Supprimer seulement ses budgets
CREATE POLICY "Utilisateurs peuvent supprimer leurs budgets"
ON "public"."monthly_budget" FOR DELETE
USING (auth.uid() = user_id);
```

#### **Templates - Publics + Privés**

```sql
-- SELECT : Templates publics (user_id IS NULL) + templates privés
CREATE POLICY "Users can view own templates and public templates"
ON "public"."template" FOR SELECT
USING ((auth.uid() = user_id) OR (user_id IS NULL));

-- INSERT : Créer seulement ses templates
CREATE POLICY "Users can insert own templates"
ON "public"."template" FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE/DELETE : Seulement ses templates
CREATE POLICY "Users can update own templates"
ON "public"."template" FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
ON "public"."template" FOR DELETE
USING (auth.uid() = user_id);
```

#### **Template Line - Sécurité par Relation**

```sql
-- Accès basé sur l'accès au template parent
CREATE POLICY "Users can view template line based on template access"
ON "public"."template_line" FOR SELECT
USING (EXISTS (
  SELECT 1 FROM "public"."template"
  WHERE ("template"."id" = "template_line"."template_id")
  AND ((auth.uid() = "template"."user_id") OR ("template"."user_id" IS NULL))
));

-- Modification seulement si propriétaire du template
CREATE POLICY "Users can insert template line for own templates"
ON "public"."template_line" FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM "public"."template"
  WHERE ("template"."id" = "template_line"."template_id")
  AND (auth.uid() = "template"."user_id")
));
```

## 🔧 **Types et Génération**

### **Génération Automatique des Types**

```bash
# Générer les types TypeScript depuis Supabase
bun run generate-types

# Résultat dans src/types/database.types.ts
export type Database = {
  public: {
    Tables: {
      monthly_budget: {
        Row: { id: string; month: number; year: number; ... };
        Insert: { month: number; year: number; user_id?: string; ... };
        Update: { month?: number; year?: number; ... };
      };
    };
  };
};
```

### **Helpers de Types**

```typescript
// src/types/supabase-helpers.ts
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

// Types spécifiques
export type BudgetRow = Tables<'monthly_budget'>;
export type BudgetInsert = InsertDto<'monthly_budget'>;
export type TransactionRow = Tables<'transaction'>;
```

### **Utilisation dans les Services**

```typescript
import type { Database } from '../../types/database.types';
import { BudgetInsert, BudgetRow } from '../../types/supabase-helpers';

@Injectable()
export class BudgetService {
  async create(dto: BudgetCreate, userId: string): Promise<BudgetResponse> {
    // Transformation DTO → Database avec type safety
    const insertData: BudgetInsert = {
      month: dto.month,
      year: dto.year,
      description: dto.description,
      user_id: userId, // ✅ Type safety garantie
    };

    const { data, error } = await supabase
      .from('monthly_budget')
      .insert(insertData)
      .select()
      .single();

    // data est typé automatiquement comme BudgetRow
    return this.budgetMapper.toApi(data);
  }
}
```

## ✅ **Architecture de Validation**

### **Validation Multi-Couches**

#### **1. Validation d'Entrée (Frontend → Backend)**

```typescript
// Utilise les schemas de @pulpe/shared
import { budgetCreateSchema } from '@pulpe/shared';

export class BudgetService {
  async create(dto: BudgetCreate, userId: string) {
    // Validation optionnelle supplémentaire
    const validationResult = budgetCreateSchema.safeParse(dto);
    if (!validationResult.success) {
      throw new BadRequestException('Invalid budget data');
    }
    // ...
  }
}
```

#### **2. Validation de Sortie (Database → Backend)**

```typescript
// Schemas locaux pour valider les données de la DB
// src/database/schemas/budget.schema.ts
import { z } from 'zod';

export const budgetDbSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  description: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  template_id: z.string().uuid().nullable(),
});

export type BudgetDbEntity = z.infer<typeof budgetDbSchema>;
```

#### **3. Validation dans les Mappers**

```typescript
@Injectable()
export class BudgetMapper {
  toApi(budgetDb: unknown): Budget {
    // Validation stricte des données DB
    const validatedDb = this.validateDbEntity(budgetDb);

    return {
      id: validatedDb.id,
      month: validatedDb.month,
      year: validatedDb.year,
      description: validatedDb.description,
      createdAt: validatedDb.created_at,
      updatedAt: validatedDb.updated_at,
      userId: validatedDb.user_id,
    };
  }

  private validateDbEntity(dbEntity: unknown): BudgetDbEntity {
    const result = budgetDbSchema.safeParse(dbEntity);
    if (!result.success) {
      this.logger.error('Invalid DB entity:', result.error);
      throw new InternalServerErrorException('Data integrity error');
    }
    return result.data;
  }
}
```

## 🔒 **Fonctions Sécurisées**

### **Fonctions avec SECURITY DEFINER**

```sql
-- Fonction pour créer budget + transaction atomiquement
CREATE OR REPLACE FUNCTION create_budget_from_onboarding_with_transaction(
  p_user_id uuid,
  p_month integer,
  p_year integer,
  p_description text,
  p_monthly_income numeric DEFAULT 0,
  p_housing_costs numeric DEFAULT 0,
  -- ... autres paramètres
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER  -- ✅ Privilèges de la fonction
SET search_path TO 'public'        -- ✅ Sécurisation du schema
AS $$
DECLARE
  new_budget_id uuid;
  transaction_count integer := 0;
BEGIN
  -- 1. Créer le budget
  INSERT INTO public.monthly_budget (user_id, month, year, description)
  VALUES (p_user_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  -- 2. Créer les transaction liées
  IF p_monthly_income > 0 THEN
    INSERT INTO public.transaction (
      user_id, budget_id, amount, type, expense_type, name, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_monthly_income, 'income', 'fixed', 'Revenu mensuel', true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- ... autres transaction

  -- 3. Retourner le résultat
  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*)
      FROM public.monthly_budget b
      WHERE b.id = new_budget_id
    ),
    'transaction_created', transaction_count
  );
END;
$$;
```

### **Utilisation dans le Backend**

```typescript
async createFromOnboarding(
  onboardingData: BudgetCreateFromOnboarding,
  user: AuthenticatedUser,
  supabase: AuthenticatedSupabaseClient,
): Promise<BudgetResponse> {
  const { data, error } = await supabase.rpc(
    'create_budget_from_onboarding_with_transaction',
    {
      p_user_id: user.id,
      p_month: onboardingData.month,
      p_year: onboardingData.year,
      p_description: onboardingData.description,
      p_monthly_income: onboardingData.monthlyIncome,
      // ... autres paramètres
    }
  );

  if (error) throw new BadRequestException('Failed to create budget');

  const budget = this.validateBudgetData((data as any).budget);
  return { success: true, data: this.budgetMapper.toApi(budget) };
}
```

## 🗂️ **Contraintes et Index**

### **Contraintes d'Intégrité**

```sql
-- Foreign keys avec suppression en cascade
ALTER TABLE "public"."monthly_budget"
ADD CONSTRAINT "monthly_budget_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Contraintes uniques métier
ALTER TABLE "public"."monthly_budget"
ADD CONSTRAINT "unique_month_year_per_user"
UNIQUE ("month", "year", "user_id");

-- Contraintes de validation
ALTER TABLE "public"."monthly_budget"
ADD CONSTRAINT "monthly_budget_month_check"
CHECK ((month >= 1) AND (month <= 12));

ALTER TABLE "public"."monthly_budget"
ADD CONSTRAINT "monthly_budget_year_check"
CHECK (year >= 1900);

ALTER TABLE "public"."transaction"
ADD CONSTRAINT "transaction_amount_check"
CHECK (amount > 0);
```

### **Index pour Performance**

```sql
-- Index pour les politiques RLS (critiques pour performance)
CREATE INDEX "monthly_budget_user_id_idx" ON "public"."monthly_budget" USING btree ("user_id");
CREATE INDEX "transaction_user_id_idx" ON "public"."transaction" USING btree ("user_id");

-- Index pour les requêtes métier
CREATE INDEX "idx_monthly_budget_month_year" ON "public"."monthly_budget" USING btree ("year", "month");
CREATE INDEX "idx_transaction_budget_id" ON "public"."transaction" USING btree ("budget_id");
CREATE INDEX "idx_transaction_type" ON "public"."transaction" USING btree ("type");
```

## 🔧 **Configuration Backend**

### **Service Supabase**

```typescript
@Injectable()
export class SupabaseService {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  createAuthenticatedClient(accessToken: string): AuthenticatedSupabaseClient {
    return createClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
  }

  // Client pour opérations admin (utiliser avec précaution)
  getServiceRoleClient(): SupabaseClient {
    return createClient<Database>(this.supabaseUrl, this.serviceRoleKey);
  }
}
```

### **Configuration Environnement**

```env
# Configuration Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre_clé_publique_anon
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_role  # Admin uniquement
```

## 🎯 **Bonnes Pratiques**

### **Sécurité Database**

- ✅ **RLS activé** sur toutes les tables utilisateur
- ✅ **Politiques granulaires** par opération (SELECT, INSERT, UPDATE, DELETE)
- ✅ **auth.uid()** dans toutes les politiques
- ✅ **Foreign keys** avec suppression en cascade
- ✅ **SECURITY DEFINER** pour fonctions sensibles
- ✅ **Index** sur user_id pour performance RLS

### **Validation Données**

- ✅ **Double validation** : Backend + Database
- ✅ **Type safety** : TypeScript + Zod + Contraintes SQL
- ✅ **Fail fast** : Erreurs détectées tôt dans le pipeline
- ✅ **Error handling** : Messages clairs et logs détaillés

### **Performance**

- ✅ **Index optimisés** pour les politiques RLS
- ✅ **Requêtes efficaces** avec select spécifique
- ✅ **Batch operations** quand possible
- ✅ **Connection pooling** via Supabase

## 🚨 **Surveillance et Debug**

### **Monitoring RLS**

```sql
-- Vérifier les politiques actives
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Tester une politique manuellement
SET ROLE authenticated;
SET request.jwt.claims.sub = 'user-uuid-here';
SELECT * FROM monthly_budget;  -- Doit retourner seulement les budgets de l'utilisateur
```

### **Debug Backend**

```typescript
// Logger les requêtes Supabase en développement
if (process.env.NODE_ENV === 'development') {
  this.logger.debug('Supabase query:', {
    table: 'monthly_budget',
    operation: 'select',
    userId: user.id,
  });
}
```

---

🎯 **Cette architecture garantit sécurité, performance et intégrité des données avec Supabase.**
