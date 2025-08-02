# Guide de Gestion des Erreurs NestJS

Ce document définit les pratiques de gestion des erreurs pour l'API NestJS Pulpe Budget.

## Principe Fondamental : "Log ou Throw, mais pas les deux"

Le principe le plus important de notre architecture d'erreurs est :

> **Dans un `catch`, soit tu gères et logues, soit tu relances, mais tu ne fais pas les deux.**

### Pourquoi ce principe ?

1. **Évite les logs dupliqués** : Une même erreur ne doit pas apparaître plusieurs fois dans les logs
2. **Simplifie le debugging** : Stack traces claires sans pollution
3. **Performance** : Élimine les opérations redondantes
4. **Responsabilité claire** : Chaque couche a un rôle défini

## ⚠️ Important : Utilisation exclusive de `cause`

**Ne jamais utiliser `originalError` dans le loggingContext.** Utilisez toujours le paramètre `{ cause: error }` comme 4ème argument du constructeur BusinessException pour préserver la chaîne causale des erreurs.

```typescript
// ❌ MAUVAIS - N'utilisez PAS originalError dans loggingContext
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id },
  { originalError: error } // Ambigu et non standard
);

// ✅ BON - Utilisez le paramètre cause
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id },
  { operation: 'findOne', entityId: id }, // Contexte métier seulement
  { cause: error } // Standard ES2022
);
```

## Architecture des Erreurs

### 1. BusinessException

Notre exception métier enrichie qui transporte toutes les informations nécessaires :

```typescript
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id: budgetId },                    // Details pour le message client
  { userId: user.id, entityId: budgetId, entityType: 'Budget' }  // Contexte pour les logs
);
```

### 2. ERROR_DEFINITIONS

Source unique de vérité pour toutes les erreurs avec messages dynamiques :

```typescript
BUDGET_NOT_FOUND: {
  code: 'ERR_BUDGET_NOT_FOUND',
  message: (details) => details?.id 
    ? `Budget with ID '${details.id}' not found`
    : 'Budget not found',
  httpStatus: HttpStatus.NOT_FOUND,
}
```

### 3. GlobalExceptionFilter

Filtre simple qui lit les informations et les formate pour la réponse HTTP :
- Log une seule fois avec tout le contexte
- Formate la réponse pour le client
- Gère les différents types d'exceptions

## Patterns Corrects

### Pattern 1 : Throw Seulement (Cas Standard)

```typescript
// ✅ BON - Dans un service
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
      { 
        operation: 'findOne',
        entityId: id,
      },
      { cause: error }
    );
  }

  return data;
}
```

### Pattern 2 : Log et Gérer (Sans Relancer)

```typescript
// ✅ BON - Erreur non-bloquante
private logDataFetchErrors(results: any, id: string): void {
  // Ces erreurs sont non-bloquantes, on les log seulement
  if (results.transactionsResult.error) {
    this.logger.error(
      { err: results.transactionsResult.error, budgetId: id },
      'Failed to fetch transactions for budget'
    );
  }
  // La fonction continue même si certaines données manquent
}
```

### Pattern 3 : "Enrichir et Relancer" (Exception Légitime)

Pour les erreurs techniques de bas niveau qui doivent être transformées en erreurs métier :

```typescript
// ✅ BON - Log technique + Throw métier (niveaux différents)
private handleBudgetCreationError(error: unknown, userId: string, templateId: string): never {
  // 1. Log l'erreur technique de bas niveau (Supabase/DB)
  this.logger.error(
    {
      err: error,
      userId,
      templateId,
      operation: 'create_budget_from_template_rpc',
      postgresError: error,
    },
    'Supabase RPC failed at database level'
  );

  // 2. Throw erreur métier de haut niveau
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
    { userId, templateId },
    { cause: error }
  );
}
```

## Anti-Patterns à Éviter

### Anti-Pattern 1 : Log + Throw Redondant

```typescript
// ❌ MAUVAIS - Log et throw au même niveau
catch (error) {
  this.logger.error({ err: error }, 'Failed to fetch budget');
  throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND);
}
```

### Anti-Pattern 2 : Exception Sans Contexte

```typescript
// ❌ MAUVAIS - Perd le contexte
throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND);

// ✅ BON - Contexte riche
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id: budgetId },
  { userId: user.id, operation: 'findOne' }
);
```

### Anti-Pattern 3 : BadRequestException pour Validation Métier

```typescript
// ❌ MAUVAIS - Utilise exception HTTP native
throw new BadRequestException('Amount cannot exceed 10000');

// ✅ BON - Utilise BusinessException
throw new BusinessException(
  ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
  { reason: 'Amount cannot exceed 10000' }
);
```

## Quand Utiliser Chaque Pattern

### Utilisez BusinessException pour :
- Erreurs de validation métier
- Entités non trouvées
- Conflits de logique métier
- Toute erreur nécessitant un code de tracking

### Utilisez le Pattern "Enrichir et Relancer" pour :
- Erreurs de base de données (contraintes, connexion)
- Erreurs d'API externes
- Conversion d'erreurs techniques en erreurs métier

### Loggez sans relancer pour :
- Erreurs non-bloquantes
- Métriques et monitoring
- Warnings informatifs

## Format de Réponse d'Erreur

Toutes les erreurs retournent ce format standardisé :

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
  "details": {
    "id": "123"
  },
  "context": {
    "requestId": "abc-def-ghi",
    "userId": "user-123"
  }
}
```

## Checklist de Développement

- [ ] Toujours utiliser BusinessException pour les erreurs métier
- [ ] Fournir des `details` pour enrichir les messages
- [ ] Ajouter un `loggingContext` avec l'opération et les IDs pertinents
- [ ] Ne jamais logger et throw au même niveau d'abstraction
- [ ] Utiliser le pattern "Enrichir et Relancer" uniquement pour les conversions d'erreurs techniques
- [ ] Vérifier que chaque erreur a un code unique dans ERROR_DEFINITIONS

## Exemples par Module

### Budget Service

```typescript
// Validation avec détails
throw new BusinessException(
  ERROR_DEFINITIONS.VALIDATION_FAILED,
  { reason: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}` }
);

// Entité non trouvée
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id: budgetId },
  { userId: user.id, operation: 'findOne' }
);
```

### Transaction Service

```typescript
// Champs requis manquants
throw new BusinessException(
  ERROR_DEFINITIONS.REQUIRED_DATA_MISSING,
  { fields: ['budgetId', 'amount'] }
);

// Validation métier
throw new BusinessException(
  ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
  { reason: 'Amount must be greater than 0' }
);
```

## Migration depuis l'Ancien Système

Si vous trouvez du code comme :

```typescript
// Ancien
this.logger.error({ err: error }, 'Failed to create budget');
throw new InternalServerErrorException('Erreur interne du serveur');
```

Migrez vers :

```typescript
// Nouveau
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
  undefined,
  {},
  { cause: error }
);
```

## Bénéfices

1. **Logs propres** : Chaque erreur apparaît une seule fois
2. **Debugging facilité** : Contexte riche dans chaque log
3. **i18n-ready** : Les codes d'erreur peuvent servir de clés de traduction
4. **Monitoring amélioré** : Codes d'erreur pour les métriques
5. **Maintenance simplifiée** : Une seule source de vérité pour les erreurs