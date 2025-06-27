# Database Schemas

## 📋 **Organisation**

Ce dossier contient tous les schemas Zod de l'application, centralisés pour éviter la duplication.

```
database/
└── schemas/
    ├── budget.schema.ts          # Schemas budget + validation
    ├── transaction.schema.ts     # Schemas transaction + validation
    ├── budget-template.schema.ts # Schemas template + validation
    ├── user.schema.ts           # Schemas utilisateur
    └── index.ts                 # Exports centralisés
```

## 🎯 **Principe**

**Un seul schema par entité** avec toutes les variantes nécessaires :

- Schema de base (pour la DB)
- Schema de création (DTO input)
- Schema de mise à jour (DTO partial)
- Validation métier intégrée

## 📝 **Exemple**

```typescript
// budget.schema.ts
export const budgetSchema = z.object({
  id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  description: z.string().min(1).max(500),
  // ...
});

export const createBudgetSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020),
    description: z.string().min(1).max(500).trim(),
  })
  .refine((data) => {
    // Validation métier intégrée
    const budgetDate = new Date(data.year, data.month - 1);
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    return budgetDate <= maxDate;
  }, 'Budget cannot be created more than 2 years in the future');

export type Budget = z.infer<typeof budgetSchema>;
export type CreateBudgetDto = z.infer<typeof createBudgetSchema>;
```

## 🔄 **Usage dans les services**

```typescript
import { budgetSchema, createBudgetSchema } from '@database/schemas';

// Validation input
const result = createBudgetSchema.safeParse(dto);

// Validation DB response
const budget = budgetSchema.parse(dbResponse);
```

## ✅ **Avantages**

- 🎯 **Single Source of Truth** : un seul endroit par entité
- 🔒 **Type Safety** : TypeScript + Zod validation
- 🚫 **Pas de duplication** : schemas réutilisés partout
- 📝 **Validation déclarative** : règles métier dans le schema
- 🔧 **Maintenance simplifiée** : changements centralisés
