# Tests Backend NestJS avec Bun 🧪

Ce document explique l'organisation et l'exécution des tests pour le backend NestJS utilisant Bun comme runtime.

## Configuration des Tests

### Runtime et Framework
- **Runtime**: Bun v1.2.17+
- **Framework de test**: Bun test (intégré)
- **Framework d'intégration**: Supertest pour les tests HTTP
- **TypeScript**: Support natif avec Bun

### Structure des Tests

```
backend-nest/
├── src/
│   ├── test/
│   │   ├── setup.ts              # Configuration globale des tests
│   │   └── test-utils.ts         # Utilitaires et mocks partagés
│   ├── modules/
│   │   ├── budget/
│   │   │   ├── budget.service.spec.ts     # Tests unitaires du service
│   │   │   └── budget.controller.spec.ts  # Tests d'intégration du controller
│   │   ├── transaction/
│   │   │   └── transaction.service.spec.ts
│   │   └── auth/
│   │       └── auth.guard.spec.ts
│   └── common/
│       └── guards/
│           └── auth.guard.spec.ts
├── bunfig.toml               # Configuration Bun
└── TESTING.md               # Ce fichier
```

## Types de Tests Implémentés

### 1. Tests Unitaires
- **BudgetService**: Tests complets avec mocking de Supabase
- **TransactionService**: Tests CRUD avec gestion d'erreurs
- **AuthGuard**: Tests d'authentification et autorisation

### 2. Tests d'Intégration
- **BudgetController**: Tests HTTP end-to-end avec Supertest
- Validation des endpoints REST
- Tests de validation des données d'entrée
- Tests des codes de statut HTTP

### 3. Couverture des Tests

#### Services testés:
- ✅ **BudgetService**
  - `findAll()` - Récupération des budgets
  - `create()` - Création de budget
  - `findOne()` - Récupération d'un budget spécifique
  - `update()` - Mise à jour de budget
  - `remove()` - Suppression de budget
  - `createFromOnboarding()` - Création depuis onboarding

- ✅ **TransactionService**
  - `findByBudget()` - Transactions par budget
  - `create()` - Création de transaction
  - `findOne()` - Récupération d'une transaction
  - `update()` - Mise à jour de transaction
  - `remove()` - Suppression de transaction

- ✅ **AuthGuard**
  - Validation des tokens Bearer
  - Gestion des erreurs d'authentification
  - OptionalAuthGuard pour endpoints publics

#### Controllers testés:
- ✅ **BudgetController**
  - GET `/budgets` - Liste des budgets
  - POST `/budgets` - Création de budget
  - GET `/budgets/:id` - Budget spécifique
  - PUT `/budgets/:id` - Mise à jour
  - DELETE `/budgets/:id` - Suppression
  - POST `/budgets/from-onboarding` - Création onboarding

## Exécution des Tests

### Commandes Disponibles

```bash
# Exécuter tous les tests
bun test

# Exécuter les tests en mode watch
bun run test:watch

# Exécuter les tests avec couverture de code
bun run test:coverage

# Exécuter un fichier de test spécifique
bun test src/modules/budget/budget.service.spec.ts

# Exécuter les tests d'un module
bun test src/modules/budget/

# Mode verbose pour plus de détails
bun test --verbose
```

### Variables d'Environnement pour les Tests

```bash
# Définies automatiquement par bunfig.toml
NODE_ENV=test
```

## Organisation du Code de Test

### Principes Suivis

1. **AAA Pattern**: Arrange, Act, Assert
2. **DRY**: Utilisation d'utilitaires partagés
3. **Isolation**: Chaque test est indépendant
4. **Mocking**: Isolation des dépendances externes
5. **Descriptive Naming**: Noms de tests explicites

### Utilitaires de Test (`test-utils.ts`)

```typescript
// Constantes partagées
MOCK_USER_ID, MOCK_BUDGET_ID, MOCK_TRANSACTION_ID

// Factories pour les données de test
createMockAuthenticatedUser()
createMockBudgetDbEntity()
createMockTransactionDbEntity()

// Mocks des services
createMockSupabaseClient()
createTestingModuleBuilder()

// Helpers d'assertion
expectSuccessResponse()
expectErrorThrown()
```

### Pattern de Mock Supabase

Tous les tests utilisent un mock complet de Supabase client:

```typescript
const { client, mocks } = createMockSupabaseClient();

// Configuration des réponses
mocks.single.mockResolvedValue({ data: mockData, error: null });
mocks.order.mockResolvedValue({ data: [], error: null });

// Vérification des appels
expect(mocks.from).toHaveBeenCalledWith('budgets');
expect(mocks.select).toHaveBeenCalledWith('*');
```

## Bonnes Pratiques Appliquées

### 1. Tests Unitaires
- ✅ Mock de toutes les dépendances externes
- ✅ Tests des cas de succès et d'erreur
- ✅ Vérification des interactions avec les mocks
- ✅ Tests des cas limites (null, undefined, vide)

### 2. Tests d'Intégration
- ✅ Tests des endpoints HTTP complets
- ✅ Validation des codes de statut
- ✅ Tests des en-têtes de réponse
- ✅ Validation des données JSON
- ✅ Tests de validation des entrées

### 3. Gestion des Erreurs
- ✅ Tests des exceptions métier
- ✅ Tests des erreurs de base de données
- ✅ Tests des erreurs d'authentification
- ✅ Tests des erreurs de validation

### 4. Performance
- ✅ Tests rapides (< 1ms par test unitaire)
- ✅ Pas d'I/O réelles dans les tests unitaires
- ✅ Isolation des tests d'intégration

## Métriques de Qualité

### Couverture de Code Cible
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 95%
- **Lines**: > 90%

### Standards de Qualité
- ✅ Aucun test ignoré ou désactivé
- ✅ Tous les tests passent sur CI/CD
- ✅ Temps d'exécution < 30 secondes
- ✅ Pas de console.log dans les tests

## Ajout de Nouveaux Tests

### Pour un nouveau Service:

1. Créer le fichier `service-name.service.spec.ts`
2. Utiliser le pattern des tests existants
3. Mocker toutes les dépendances
4. Tester tous les cas d'usage

### Pour un nouveau Controller:

1. Créer le fichier `controller-name.controller.spec.ts`
2. Utiliser Supertest pour les tests HTTP
3. Mocker les services utilisés
4. Tester tous les endpoints

### Template de Test

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';

describe('ServiceName', () => {
  let service: ServiceName;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceName],
    }).compile();
    
    service = module.get<ServiceName>(ServiceName);
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle error case', async () => {
      // Arrange
      // Act & Assert
    });
  });
});
```

## Débogage des Tests

### Logs de Debug
```bash
# Activer les logs détaillés
DEBUG=* bun test

# Logs spécifiques aux tests
console.log("🧪 Debug:", variable);
```

### Problèmes Courants

1. **Mock non configuré**: Vérifier que tous les mocks retournent des valeurs
2. **Async/Await**: S'assurer que les promesses sont correctement attendues
3. **Isolation**: Chaque test doit nettoyer ses mocks

## Intégration CI/CD

### GitHub Actions (exemple)

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run test:coverage
```

### Scripts de Pre-commit

```bash
#!/bin/bash
# .git/hooks/pre-commit
bun test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed, commit aborted"
  exit 1
fi
```

## Ressources

- [Documentation Bun Test](https://bun.sh/docs/cli/test)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Règles de Test du Projet](./NESTJS_BEST_PRACTICES.md#testing)

---

📝 **Note**: Ce setup de tests suit les best practices NestJS et utilise les fonctionnalités natives de Bun pour des performances optimales.