# Implementation Plan: Migration vers InfoLogger

## Overview

Migration des services utilisant `PinoLogger.error()` vers `InfoLogger`. Le principe fondamental est **"Log or Throw, Never Both"** :
- Si on throw → ne pas logger (le GlobalExceptionFilter le fera avec la cause chain)
- Si on ne throw pas → utiliser `logger.warn()` (erreur récupérable)

## Règles de Migration

| Pattern actuel | Action |
|----------------|--------|
| `logger.error()` + `throw` | Supprimer logger, passer `error` comme `cause` |
| `logger.error()` sans throw | Convertir en `logger.warn()` |
| `throw new InternalServerErrorException()` | Migrer vers `BusinessException` avec cause |

## Dépendances

Les fichiers doivent être migrés dans cet ordre :
1. D'abord les modules (ajouter les providers InfoLogger)
2. Ensuite les services/controllers

---

## File Changes

### Phase 1 : Services avec BusinessException (facile)

#### `backend-nest/src/modules/budget-line/budget-line.service.ts`
- **Ligne 129-140** : Supprimer `this.logger.error()`, l'erreur est déjà passée via `cause` dans BusinessException
- Mettre à jour l'import : `PinoLogger` → `InfoLogger`
- Mettre à jour l'injection : `@InjectPinoLogger` → `@InjectInfoLogger`

#### `backend-nest/src/modules/budget-line/budget-line.module.ts`
- Ajouter import : `createInfoLoggerProvider` de `@common/logger`
- Ajouter provider : `createInfoLoggerProvider(BudgetLineService.name)`

#### `backend-nest/src/modules/budget/budget.calculator.ts`
- **Ligne 130-137** : Supprimer `this.logger.error()`, l'info de validation est déjà dans le loggingContext de BusinessException
- Mettre à jour l'import et l'injection vers InfoLogger

#### `backend-nest/src/modules/budget/budget.module.ts`
- Ajouter provider : `createInfoLoggerProvider(BudgetCalculator.name)`

---

### Phase 2 : Services Demo (cas mixtes)

#### `backend-nest/src/modules/demo/demo.service.ts`
- **Ligne 65** : Supprimer logger.error(), le throw qui suit logguera via GlobalExceptionFilter
- **Ligne 195** : Idem, supprimer logger.error() avant throw
- Migrer vers InfoLogger

#### `backend-nest/src/modules/demo/demo-data-generator.service.ts`
- **Ligne 87** : Supprimer logger.error() avant throw
- Migrer vers InfoLogger

#### `backend-nest/src/modules/demo/demo-cleanup.service.ts`
- **Ligne 80-84** : Convertir en `logger.warn()` (job cron qui catch et continue)
- **Ligne 114-121** : Convertir en `logger.warn()` si `throwOnError=false`, sinon l'erreur sera loggée par le throw
- **Ligne 170** : Convertir en `logger.warn()` (erreur de suppression individuelle, on continue)
- Migrer vers InfoLogger

#### `backend-nest/src/modules/demo/demo.module.ts`
- Ajouter providers : `createInfoLoggerProviders(DemoService, DemoDataGeneratorService, DemoCleanupService)`

---

### Phase 3 : Guards (cas particulier)

#### `backend-nest/src/common/guards/auth.guard.ts`
- **Ligne 63-67** : Supprimer logger.error(), le throw UnauthorizedException sera loggé
- **Ligne 103-104** : Idem
- **Note** : UnauthorizedException ne supporte pas `cause`, c'est acceptable car l'erreur est simple
- Migrer vers InfoLogger

#### `backend-nest/src/common/common.module.ts`
- Ajouter provider : `createInfoLoggerProvider(AuthGuard.name)`
- Vérifier que DevOnlyGuard et UserThrottlerGuard sont aussi migrés si nécessaire

---

### Phase 4 : Budget Template Service (le plus gros)

#### `backend-nest/src/modules/budget-template/budget-template.service.ts`
15 occurrences à traiter :
- **Lignes 91, 136, 181, 299, 447, 589, 679, 741, 914, 1337, 1522, 1681, 1726, 1852, 1932**
- Pour chaque : vérifier si c'est suivi d'un throw
  - Si oui → Supprimer logger.error()
  - Si non → Convertir en logger.warn()
- Migrer vers InfoLogger

#### `backend-nest/src/modules/budget-template/budget-template.module.ts`
- Ajouter provider : `createInfoLoggerProvider(BudgetTemplateService.name)`

---

### Phase 5 : User Controller

#### `backend-nest/src/modules/user/user.controller.ts`
7 occurrences à traiter :
- **Lignes 106, 176, 199, 255, 292, 332, 351**
- Tous sont des `logger.error()` + `throw InternalServerErrorException`
- **Option choisie** : Supprimer logger.error(), l'exception sera loggée par GlobalExceptionFilter
- Migrer vers InfoLogger

#### `backend-nest/src/modules/user/user.module.ts`
- Ajouter provider : `createInfoLoggerProvider(UserController.name)`

---

## Testing Strategy

### Tests à mettre à jour

Pour chaque service migré, mettre à jour le mock du logger dans les tests :
- Remplacer `PinoLogger` mock par `InfoLogger` mock
- Supprimer les assertions sur `logger.error()` dans les tests
- Ajouter des assertions sur `logger.warn()` si converti

### Tests concernés
- `budget-line.service.spec.ts`
- `budget.calculator.spec.ts`
- `demo.service.spec.ts`
- `demo-data-generator.service.spec.ts`
- `demo-cleanup.service.spec.ts`
- `auth.guard.spec.ts`
- `budget-template.service.spec.ts` (si existant)
- `user.controller.spec.ts` (si existant)

### Validation manuelle
1. Lancer `pnpm test` après chaque phase
2. Vérifier que les erreurs sont bien loggées une seule fois (dans GlobalExceptionFilter)
3. Tester un cas d'erreur en dev pour vérifier le format des logs

---

## Documentation

### Mettre à jour `backend-nest/LOGGING.md`
- Ajouter section sur la migration progressive
- Documenter les patterns de conversion logger.error() → warn/suppression

---

## Rollout Considerations

- **Pas de breaking change** : Le comportement reste identique (throw = throw)
- **Migration progressive** : Peut être fait phase par phase
- **Rollback facile** : Chaque fichier peut être reverté indépendamment
- **Pas de migration DB** : Changements code uniquement
