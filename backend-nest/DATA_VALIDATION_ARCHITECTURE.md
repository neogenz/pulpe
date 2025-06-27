# Architecture de Validation des Données avec Zod

## Vue d'ensemble

Notre backend NestJS implémente une validation complète des données à deux niveaux, en respectant la séparation des responsabilités entre les couches de l'application.

1.  **Frontend → Backend** : Validation des DTOs entrants via les schémas Zod partagés.
2.  **Database → Backend** : Validation des entités sortantes de la DB via des schémas Zod locaux au backend.

## Principes

### 1. Fail Fast

- Détection précoce des erreurs.
- Messages d'erreur clairs et précis.
- Prévention de la propagation de données invalides.

### 2. Type Safety au Runtime

- Les types TypeScript ne suffisent pas (compile-time only).
- Zod assure la validation au moment de l'exécution.
- Cohérence garantie entre les types et les données réelles.

### 3. Single Source of Truth

- **Shared DTOs** : Les schémas Zod pour les DTOs sont définis dans `/shared/schemas.ts` et sont la source de vérité pour la communication Frontend-Backend.
- **Backend Entities** : Les schémas Zod pour les entités de la base de données sont définis localement dans chaque module du backend (ex: `backend-nest/src/modules/transaction/schemas/`). Ils sont la source de vérité pour la structure des données de la DB.

### 4. Couches d'Abstractions Claires

- `/shared` : Totalement agnostique de la base de données. Ne contient que des DTOs et des types partagés.
- `backend-nest` : Contient toute la logique métier, y compris l'interaction et la validation des données de la base de données.

## Architecture

### Flux de Données

```
Frontend                Backend                 Database
   |                      |                        |
   |-- DTO avec Zod ----> |                        |
   |   (depuis @shared)   |                        |
   |                      | -- Transformation -->  |
   |                      |                        |
   |                      | <-- Données brutes --- |
   |                      |                        |
   |                      | -- Zod Validation -->  |
   |                      |    (schémas locaux)    |
   |<-- API Response ---- |                        |
```

### Validation Entrante (Frontend → Backend)

Utilise les schémas de `@pulpe/shared` pour valider les DTOs.

```typescript
// Dans le mapper (e.g., transaction.mapper.ts)
import { transactionCreateSchema } from '@pulpe/shared';

toDbCreate(createDto: TransactionCreate, ...) {
  const validationResult = transactionCreateSchema.safeParse(createDto);
  if (!validationResult.success) {
    throw new BadRequestException(...);
  }
  // ...
}
```

### Validation Sortante (Database → Backend)

Utilise les schémas locaux au backend pour valider les entités de la base de données.

```typescript
// Dans le mapper (e.g., transaction.mapper.ts)
import { transactionDbEntitySchema } from './schemas/transaction.db.schema';

toApi(transactionDb: unknown): Transaction {
  const validatedDb = this.validateDbEntity(transactionDb);
  // ...
}

private validateDbEntity(dbEntity: unknown): TransactionDbEntity {
  const validationResult = transactionDbEntitySchema.safeParse(dbEntity);
  if (!validationResult.success) {
    throw new InternalServerErrorException(...);
  }
  return validationResult.data;
}
```

## Structure des Schémas

### Schémas Partagés (`/shared`)

- `transactionCreateSchema`
- `budgetCreateSchema`
- `budgetTemplateCreateSchema`
- (Et les schémas de mise à jour, de réponse, etc.)

### Schémas Locaux au Backend (`/backend-nest/src/modules/.../schemas`)

- `transactionDbEntitySchema`
- `budgetDbEntitySchema`
- `budgetTemplateDbEntitySchema`

## Avantages

1.  **Couplage Faible** : La librairie `shared` n'a aucune connaissance de la base de données, ce qui la rend plus réutilisable et maintenable.
2.  **Protection contre la Corruption de Données** : Toute incohérence dans la base de données (migration ratée, manipulation manuelle) est détectée.
3.  **Clarté Architecturale** : Les responsabilités sont clairement définies. On sait où trouver chaque type de validation.
4.  **Debugging Facilité** : Distinction claire entre les erreurs de validation du client (400 Bad Request) et les erreurs d'intégrité des données internes (500 Internal Server Error).
5.  **Single Source of Truth pour les Entités** : Le type de l'entité (`TransactionDbEntity`) est maintenant inféré directement du schéma Zod local, évitant la duplication et les incohérences.

## Exemple Complet

```typescript
// shared/schemas.ts
export const transactionDbEntitySchema = z.object({
  id: z.string().uuid(),
  budget_id: z.string().uuid(),
  amount: z.number().positive(),
  // ...
});

// backend/mapper.ts
toApi(transactionDb: unknown): Transaction {
  // 1. Validation Zod
  const validatedDb = this.validateDbEntity(transactionDb);

  // 2. Transformation typée
  return {
    id: validatedDb.id,
    budgetId: validatedDb.budget_id,
    amount: validatedDb.amount,
    // ...
  };
}

// Utilisation dans le service
const { data } = await supabase.from('transactions').select();
const transactions = this.mapper.toApiList(data); // Validation automatique
```

## Bonnes Pratiques

1. **Toujours valider les données externes**
   - Données du frontend
   - Données de la DB
   - Données d'APIs tierces

2. **Utiliser `unknown` pour les données non validées**
   - Force la validation avant utilisation
   - Évite les assumptions dangereuses

3. **Messages d'erreur contextuels**
   - Inclure le chemin de la propriété invalide
   - Expliquer pourquoi la validation a échoué

4. **Séparer les schémas par contexte**
   - Schémas de création (optionnels autorisés)
   - Schémas d'entités (tous les champs requis)
   - Schémas de mise à jour (tout optionnel)
