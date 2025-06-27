# Intégration Supabase + Zod : Architecture Complète

## Vue d'ensemble

Notre backend NestJS utilise une architecture **double couche de sécurité** combinant :

- **Types Supabase générés** → Type safety au compile-time
- **Validation Zod** → Validation runtime + transformation des données

Cette approche offre une protection totale contre les erreurs de types et la corruption de données.

## Architecture des Données

```
Database (Supabase)
        ↓
   Types générés (compile-time)
        ↓
   Validation Zod (runtime)
        ↓
   Types API (frontend)
```

## Génération automatique des types

### Commande de génération

```bash
bun run generate-types
```

Cette commande régénère automatiquement `src/types/database.types.ts` depuis votre schéma Supabase.

### Types générés

Les types Supabase suivent cette structure :

```typescript
export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: {
          /* données de .select() */
        };
        Insert: {
          /* données pour .insert() */
        };
        Update: {
          /* données pour .update() */
        };
      };
    };
    Enums: {
      expense_type: 'fixed' | 'variable';
      transaction_type: 'expense' | 'income' | 'saving';
    };
  };
};
```

## Types helper simplifiés

Dans `src/types/supabase-helpers.ts` :

```typescript
// Types génériques réutilisables
export type Tables<T> = Database['public']['Tables'][T]['Row'];
export type InsertDto<T> = Database['public']['Tables'][T]['Insert'];

// Types spécifiques pour vos entités
export type TransactionRow = Tables<'transactions'>;
export type BudgetRow = Tables<'budgets'>;
// etc.
```

## Double validation : Compile-time + Runtime

### 1. Type Safety (Compile-time)

```typescript
// Le client Supabase est typé avec Database
const supabase: SupabaseClient<Database> = ...

// TypeScript sait exactement ce que retourne cette requête
const { data } = await supabase
  .from('transactions') // ← auto-complété
  .select('*'); // ← data est typé comme TransactionRow[]
```

### 2. Validation Runtime (Zod)

```typescript
// Dans le mapper : validation + transformation
const transactions = this.transactionMapper.toApiList(data);
// ↑ Valide chaque TransactionRow avec Zod
// ↑ Transforme vers Transaction[] pour l'API
```

## Flux complet avec exemple

### Dans le service

```typescript
async findByBudget(budgetId: string, supabase: AuthenticatedSupabaseClient) {
  // ✅ 1. Type safety au compile-time
  const { data: transactionsDb, error } = await supabase
    .from('transactions') // ← Typé automatiquement
    .select('*') // ← TypeScript : TransactionRow[] | null
    .eq('budget_id', budgetId);

  // ✅ 2. Validation runtime + transformation
  const transactions = this.transactionMapper.toApiList(transactionsDb || []);
  //     ↑ Zod valide et transforme vers Transaction[]

  return { success: true, data: transactions };
}
```

### Dans le mapper

```typescript
toApi(transactionDb: unknown): Transaction {
  // ✅ 1. Validation Zod des données DB
  const validatedDb = this.validateDbEntity(transactionDb);
  //     ↑ Assure que les données correspondent au schéma

  // ✅ 2. Transformation vers format API
  return {
    id: validatedDb.id,
    budgetId: validatedDb.budget_id, // snake_case → camelCase
    // ... autres transformations
  };
}
```

## Avantages de cette architecture

### 🛡️ Protection Maximale

- **Compile-time** : TypeScript détecte les erreurs de structure
- **Runtime** : Zod valide les données réelles et détecte la corruption

### 🚀 Développement Efficace

- **Auto-complétion** : IntelliSense parfait sur toutes les requêtes
- **Refactoring sûr** : Changement de schéma = erreurs TypeScript immédiates
- **Documentation vivante** : Les types reflètent toujours la DB

### 🔄 Maintenance Simplifiée

- **Single Source of Truth** : Le schéma DB génère automatiquement les types
- **Détection automatique** : Changements de schéma = erreurs de compilation
- **Migration assistée** : TypeScript guide les mises à jour nécessaires

## Exemples pratiques

### Requête typée avec validation

```typescript
// ✅ Type safety + validation
async getTransactionsByType(type: TransactionType) {
  const { data } = await supabase
    .from('transactions')
    .select('id, name, amount, type')
    .eq('type', type); // ← TypeScript valide que 'type' existe

  return this.mapper.toApiList(data); // ← Zod valide chaque item
}
```

### Insertion typée

```typescript
async createTransaction(dto: TransactionCreate) {
  // ✅ Validation DTO avec Zod
  const transactionData = this.mapper.toDbCreate(dto, userId);
  //     ↑ TransactionInsert typé par Supabase

  const { data } = await supabase
    .from('transactions')
    .insert(transactionData) // ← Type safety garantie
    .select()
    .single();

  return this.mapper.toApi(data); // ← Validation + transformation
}
```

## Scripts disponibles

```bash
# Régénérer les types après modification du schéma DB
bun run generate-types

# Vérification de la qualité (types + lint + format)
bun run quality

# Tests avec validation complète
bun run test
```

## Bonnes pratiques

### 1. Régénération des types

- **Après chaque migration** : `bun run generate-types`
- **Avant les deployments** : Vérifier que les types sont à jour
- **En équipe** : Commitez les types générés

### 2. Utilisation des types

- **Services** : Utilisez `TransactionRow`, `BudgetRow`, etc.
- **Mappers** : Gardez la validation Zod pour la sécurité runtime
- **Tests** : Moquez avec les types Supabase pour plus de réalisme

### 3. Gestion des erreurs

- **Compile-time** : TypeScript vous alertera sur les incompatibilités
- **Runtime** : Zod lèvera des exceptions précises sur les données corrompues

Cette architecture vous donne le meilleur des deux mondes : la sécurité des types statiques et la robustesse de la validation runtime.
