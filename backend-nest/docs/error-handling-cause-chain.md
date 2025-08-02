# Gestion de la Chaîne Causale des Erreurs

Ce document explique comment préserver la chaîne causale complète des erreurs avec notre système BusinessException.

## Le Problème

Quand plusieurs erreurs s'enchaînent, il est crucial de préserver toute la chaîne causale pour le debugging :

```
ServiceError: Failed to create budget
  └─> DatabaseError: Connection timeout  
      └─> SocketError: ECONNREFUSED 127.0.0.1:5432
```

## La Solution

### 1. Utilisation du Standard ES2022 Error.cause

Notre `BusinessException` supporte maintenant le standard ES2022 pour la chaîne causale :

```typescript
// Exemple basique avec cause
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
  { templateId },
  { userId, operation: 'createBudget' },
  { cause: error } // 4ème paramètre optionnel
);
```

### 2. Préservation de Chaînes Complexes

Voici comment capturer et préserver des chaînes d'erreurs complexes :

```typescript
async create(dto: BudgetCreate, user: AuthenticatedUser): Promise<Budget> {
  try {
    // Niveau 1: Appel service
    return await this.createBudgetFromTemplate(dto, user);
  } catch (error) {
    // Préserve la chaîne causale complète
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
      { templateId: dto.templateId },
      { 
        userId: user.id,
        operation: 'create',
        dto 
      },
      { cause: error } // Préserve l'erreur originale et sa chaîne
    );
  }
}

private async createBudgetFromTemplate(dto: BudgetCreate, user: AuthenticatedUser) {
  try {
    // Niveau 2: Appel base de données
    const result = await this.supabase.rpc('create_budget_from_template', {...});
    return result;
  } catch (dbError) {
    // Enrichit l'erreur technique avec contexte métier
    const enrichedError = new Error(`Database operation failed for template ${dto.templateId}`);
    enrichedError.cause = dbError; // Préserve l'erreur DB originale
    
    throw enrichedError;
  }
}
```

### 3. Pattern "Enrichir et Relancer" avec Chaîne Causale

Pour les erreurs techniques qui doivent être converties en erreurs métier :

```typescript
private async handleDatabaseError(error: unknown, context: any): never {
  // Log l'erreur technique complète avec sa chaîne
  this.logger.error({
    err: error,
    ...context,
    // Si l'erreur a une cause, elle sera automatiquement incluse
  }, 'Database operation failed');

  // Analyse l'erreur pour déterminer le type d'erreur métier
  if (error instanceof Error) {
    // PostgreSQL unique violation
    if (error.message?.includes('23505') || error.message?.includes('duplicate key')) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month: context.month, year: context.year },
        context,
        { cause: error } // Préserve toute la chaîne
      );
    }
    
    // Contrainte de clé étrangère
    if (error.message?.includes('23503') || error.message?.includes('foreign key')) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id: context.templateId },
        context,
        { cause: error }
      );
    }
  }

  // Erreur générique avec préservation de la cause
  throw new BusinessException(
    ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
    undefined,
    context,
    { cause: error }
  );
}
```

### 4. Exploitation dans les Logs

Le `GlobalExceptionFilter` enrichit automatiquement les logs avec :

- **causeChain** : Liste ordonnée de toutes les erreurs (de la plus récente à la plus ancienne)
- **rootCause** : L'erreur racine (la plus profonde)

Exemple de log résultant :

```json
{
  "level": "error",
  "msg": "SERVER ERROR: Failed to create budget",
  "requestId": "abc-123",
  "userId": "user-456",
  "statusCode": 500,
  "errorCode": "ERR_BUDGET_CREATE_FAILED",
  "causeChain": [
    {
      "depth": 1,
      "name": "Error",
      "message": "Database operation failed for template tpl-789"
    },
    {
      "depth": 2,
      "name": "PostgrestError", 
      "message": "duplicate key value violates unique constraint"
    },
    {
      "depth": 3,
      "name": "SocketError",
      "message": "ECONNREFUSED 127.0.0.1:5432"
    }
  ],
  "rootCause": {
    "name": "SocketError",
    "message": "ECONNREFUSED 127.0.0.1:5432"
  }
}
```

### 5. Méthodes Utiles

La `BusinessException` expose deux méthodes pour analyser la chaîne causale :

```typescript
// Dans un handler d'erreur ou un test
catch (error) {
  if (error instanceof BusinessException) {
    // Obtenir toute la chaîne
    const chain = error.getCauseChain();
    console.log(`Erreur avec ${chain.length} causes`);
    
    // Obtenir la cause racine
    const root = error.getRootCause();
    if (root instanceof Error && root.message.includes('ECONNREFUSED')) {
      // Problème de connexion à la base de données
    }
  }
}
```

### 6. Best Practices

1. **Toujours préserver la cause** lors de la transformation d'erreurs :
   ```typescript
   throw new BusinessException(
     ERROR_DEFINITIONS.SOME_ERROR,
     details,
     context,
     { cause: error } // Ne jamais oublier
   );
   ```

2. **Enrichir sans perdre** l'information originale :
   ```typescript
   const enrichedError = new Error(`Context: ${error.message}`);
   enrichedError.cause = error;
   throw enrichedError;
   ```

3. **Logger au bon niveau** : 
   - Les erreurs techniques détaillées au niveau du catch
   - Les erreurs métier au niveau du GlobalExceptionFilter

### 7. Compatibilité

- **Node.js 16+** : Support natif de Error.cause
- **TypeScript 4.8+** : Types pour Error.cause
- **Pino Logger** : Sérialise automatiquement la propriété cause

### Exemple Complet

```typescript
// Service de bas niveau
class DatabaseService {
  async query(sql: string) {
    try {
      return await this.pool.query(sql);
    } catch (pgError) {
      // Erreur PostgreSQL native
      const dbError = new Error(`Query failed: ${sql.substring(0, 50)}...`);
      dbError.cause = pgError;
      throw dbError;
    }
  }
}

// Service métier
class BudgetService {
  async create(dto: CreateBudgetDto) {
    try {
      return await this.db.query('INSERT INTO budgets...');
    } catch (dbError) {
      // Convertit en erreur métier en préservant la chaîne
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        { month: dto.month, year: dto.year },
        { 
          userId: dto.userId,
          operation: 'create',
          query: 'INSERT INTO budgets'
        },
        { cause: dbError }
      );
    }
  }
}

// Résultat dans les logs :
// - BusinessException (niveau métier)
//   └─> Error: Query failed: INSERT INTO budgets...
//       └─> PostgresError: duplicate key value
```

Avec cette approche, vous ne perdez jamais la root cause et pouvez facilement tracer l'origine exacte des problèmes en production.