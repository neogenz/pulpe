# pulpe-shared - Package Partagé

Package TypeScript contenant les types, schémas et DTOs partagés entre le frontend Angular et le backend NestJS de l'application Pulpe.

## 🎯 Objectif

Assurer la cohérence des types et la validation des données entre :

- **Frontend Angular** : Validation côté client et typage
- **Backend NestJS** : Validation côté serveur et DTOs
- **Database** : Schémas de validation Supabase

## 📦 Contenu

```
shared/
├── index.ts              # Point d'entrée principal (exporte tout)
└── schemas.ts            # Schémas Zod ET types TypeScript dérivés
```

## 🚀 Technologies

- **TypeScript** : Types stricts et inférence
- **Zod** : Validation runtime et génération de types
- **ESM** : Format de modules moderne
- **Workspace Protocol** : Intégration pnpm optimisée

## 📋 Types disponibles

### Authentification

```typescript
// Schémas de validation
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Types TypeScript inférés
export type Login = z.infer<typeof LoginSchema>;
```

### Budget & Transactions

```typescript
// Schémas métier
export const BudgetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalIncome: z.number().positive(),
  totalExpenses: z.number().positive(),
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  amount: z.number(),
  description: z.string().min(1),
  category: z.enum(['income', 'expense', 'savings']),
  date: z.date(),
});

// Types inférés
export type Budget = z.infer<typeof BudgetSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
```

### Onboarding

```typescript
// Étapes d'onboarding
export const PersonalInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.date(),
  locality: z.string().min(1),
});

export const IncomeSchema = z.object({
  salary: z.number().positive(),
  otherIncome: z.number().optional(),
});

// Types pour le processus complet
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;
export type Income = z.infer<typeof IncomeSchema>;
```

## 🛠️ Utilisation

### Installation

Le package est automatiquement installé via le workspace :

```json
// frontend/package.json ou backend-nest/package.json
{
  "dependencies": {
    "pulpe-shared": "workspace:*"
  }
}
```

### Import dans Frontend (Angular)

```typescript
// Validation côté client
import { BudgetSchema, type Budget } from 'pulpe-shared';

@Component({...})
export class BudgetComponent {
  validateBudget(data: unknown): Budget {
    return BudgetSchema.parse(data);
  }
}
```

### Import dans Backend (NestJS)

```typescript
// DTOs et validation
import { createZodDto } from 'nestjs-zod';
import { BudgetSchema } from 'pulpe-shared';

export class CreateBudgetDto extends createZodDto(BudgetSchema) {}

@Controller('budgets')
export class BudgetController {
  @Post()
  create(@Body() dto: CreateBudgetDto) {
    // dto est automatiquement validé
  }
}
```

## 🔧 Développement

### Scripts disponibles

```bash
# Build pour production
pnpm run build

# Mode watch pour développement
pnpm run watch

# Formatage
pnpm run format
pnpm run format:check
```

### Workflow de développement

1. **Modifier les schémas et types** dans `schemas.ts`
2. **Exporter** depuis `index.ts` si ce n'est pas déjà fait
3. **Watch mode** compile automatiquement
4. **Frontend/Backend** voient les changements instantanément

### Configuration ESM

```json
// package.json
{
  "type": "module",
  "main": "./dist/esm/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "default": "./dist/esm/index.js"
    }
  }
}
```

## ⚠️ Important: Résolution des Modules ESM

### Contrainte Technique Node.js

Ce package utilise **ESM natif** avec `moduleResolution: "NodeNext"` dans TypeScript. Cela impose une contrainte **contre-intuitive mais nécessaire** :

**Les imports dans les fichiers TypeScript DOIVENT utiliser l'extension `.js` (pas `.ts`) :**

```typescript
// ✅ CORRECT - Extension .js requise pour ESM
import { BudgetFormulas } from './budget-formulas.js';
import type { TransactionKind } from '../types.js';

// ❌ INCORRECT - Provoque ERR_MODULE_NOT_FOUND en production
import { BudgetFormulas } from './budget-formulas';
import type { TransactionKind } from '../types';
```

### Pourquoi cette contrainte ?

1. **Node.js ESM exige des extensions explicites** - C'est une règle stricte de la résolution des modules ESM natifs
2. **TypeScript compile `.ts` → `.js`** - Les imports doivent référencer le fichier final compilé
3. **Railway/Production** - Sans les extensions, l'application crash avec `ERR_MODULE_NOT_FOUND`
4. **Différence Dev/Prod** - Les symlinks pnpm masquent le problème en développement

### Configuration TypeScript Requise

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",        // Requis pour ESM natif
    "moduleResolution": "NodeNext"  // Active la résolution Node.js ESM
  }
}
```

**Note:** `moduleResolution: "bundler"` fonctionne en développement mais échoue en production car il est destiné aux bundlers (Webpack, Vite), pas à Node.js direct.

### Références

- [TypeScript ESM Support](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html#mandatory-file-extensions)

## 📏 Conventions

### Naming des schémas

```typescript
// ✅ Bon
export const UserProfileSchema = z.object({...});
export const CreateBudgetSchema = z.object({...});

// ❌ Éviter
export const UserProfileValidation = z.object({...});
export const budgetSchema = z.object({...});
```

### Types dérivés

```typescript
// ✅ Types inférés automatiquement
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ❌ Types manuels (duplication)
export interface UserProfile {
  // ... duplication du schéma
}
```

### Organisation des fichiers

- **`schemas.ts`** : Contient à la fois les schémas Zod et les types TypeScript inférés.
- **`index.ts`** : Point d'entrée unique qui exporte tous les schémas et types depuis `schemas.ts`.

## 🧪 Validation

### Côté Frontend

```typescript
// Validation avant envoi API
const result = BudgetSchema.safeParse(formData);
if (result.success) {
  await this.budgetApi.create(result.data);
} else {
  console.error('Validation errors:', result.error.issues);
}
```

### Côté Backend

```typescript
// Validation automatique via NestJS
@Post()
async create(@Body() dto: CreateBudgetDto) {
  // dto déjà validé par le pipe Zod
  return this.budgetService.create(dto);
}
```

## 🚀 Build et Distribution

### Configuration TypeScript

```json
// tsconfig.esm.json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "./dist/esm",
    "declaration": true,
    "declarationMap": true
  }
}
```

### Optimisations

- **Tree-shaking** : Exports ESM optimisés
- **Type inference** : Pas de types dupliqués
- **Watch mode** : Compilation incrémentale
- **Source maps** : Debug facilité

## 📚 Bonnes Pratiques

### ✅ À faire

- Utiliser Zod pour tous les schémas
- Inférer les types avec `z.infer<>`
- Nommer les schémas avec suffixe `Schema`
- Exporter depuis `index.ts` uniquement
- Documenter les schémas complexes

### ❌ À éviter

- Types TypeScript manuels (duplication)
- Imports directs depuis `schemas.ts` (toujours passer par `pulpe-shared`)
- Schémas sans validation
- Breaking changes sans version bump
- Dependencies runtime supplémentaires

## 🔄 Évolution

### Versionning

- **Patch** : Ajout de champs optionnels
- **Minor** : Nouveaux schémas, types
- **Major** : Breaking changes sur schémas existants

### Migration

Lors de modifications majeures :

1. Créer nouveaux schémas avec suffixe de version
2. Maintenir anciens schémas temporairement
3. Migrer frontend et backend
4. Supprimer anciennes versions

---

🎯 **Ce package garantit la cohérence des données entre frontend et backend tout en centralisant la validation métier.**
