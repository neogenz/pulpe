# E2E Tests avec Playwright

Ce dossier contient tous les tests E2E pour l'application Pulpe, organisés selon une **stratégie hybride 90/10** optimisée pour un développeur solo.

## 📋 Stratégie de test 90/10

### ⚡ 90% Features (Mocks) - Rapide et isolé

- **Authentification simulée** via fixture `authenticatedPage`
- **APIs mockées** pour isolation complète et rapidité
- **Exécution parallèle** pour performance optimale

### 🔐 10% Critical User Journeys

- **Session persistée** via storageState
- **Parcours critiques** validés de bout en bout
- **Tests de non-régression** sur les fonctionnalités vitales

## Structure des dossiers

```
e2e/
├── auth.setup.ts          # Setup de session mockée persistée (exécuté une fois)
├── fixtures/               # Fixtures personnalisées et données de test
├── pages/                  # Page Objects pour l'encapsulation des pages
├── tests/
│   ├── critical-path/      # Tests avec session persistée (parcours critiques)
│   │   ├── session.spec.ts         # Gestion de session
│   │   └── core-navigation.spec.ts # Navigation principale
│   └── features/           # Tests avec mocks (28 tests)
│       ├── user-authentication.spec.ts
│       ├── budget-template-management.spec.ts
│       ├── monthly-budget-management.spec.ts
│       ├── navigation.spec.ts
│       └── user-onboarding-flow.spec.ts
├── utils/                  # Utilitaires et helpers
└── playwright/.auth/       # Sessions sauvegardées (ignoré par git)
```

## ⚡ Commandes essentielles

```bash
# Lancer tous les tests (recommandé)
pnpm test:e2e

# Tests rapides features uniquement (dev)
npx playwright test --project="Feature Tests (Mocked)"

# Tests avec UI interactif (dev)
pnpm test:e2e:ui

# Mode debug
pnpm test:e2e:debug
```

**Variables d'environnement** (optionnel pour critical path) :
```bash
# Dans .env.e2e
TEST_EMAIL="test@example.com"
TEST_PASSWORD="test-password"
```

## Projets Playwright configurés

| Projet            | Tests | Authentification      | Utilisation     |
| ----------------- | ----- | --------------------- | --------------- |
| **setup**         | 1     | Session mockée       | Génère session  |
| **Critical Path** | 6     | Session sauvegardée  | Chemin critique |
| **Features**      | 28    | Mocks complets       | Développement   |

## 🎯 Standards et bonnes pratiques

### Page Object Model (POM)

**Structure** : Chaque page a son Page Object dans `pages/`
**Règle des 50 lignes** : Maximum 50 lignes par Page Object pour maintenir la simplicité
**Méthodes métier** : Focus sur les actions utilisateur, pas les détails techniques

```typescript
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.getByTestId('email-input').fill(email);
    await this.page.getByTestId('password-input').fill(password);
    await this.page.getByTestId('login-submit-button').click();
  }
}
```

### Stratégie de sélecteurs (priorité Playwright 2025)

1. **getByRole()** - Priorité absolue (accessibilité)
2. **getByTestId()** - Pour les éléments complexes
3. **getByText()** / **getByLabel()** - Contenu visible
4. ❌ **Éviter** : Sélecteurs CSS/XPath fragiles

### Naming convention data-testid

Format kebab-case avec hiérarchie descriptive :
```
data-testid="component-element-action"

Exemples :
- data-testid="login-form"
- data-testid="budget-submit-button"
- data-testid="month-card-${id}" (dynamique)
```

### Tests isolés et parallèles

- **Isolation complète** : Chaque test a son propre contexte
- **Auto-waiting** : Playwright attend automatiquement les éléments
- **Pas de `waitForTimeout`** : Anti-pattern à éviter absolument

## Structure d'un test type

```typescript
import { test, expect } from "../fixtures/test-fixtures";

// Configuration pour l'exécution parallèle
test.describe.configure({ mode: "parallel" });

test.describe("Feature Name", () => {
  test("should perform action", async ({ authenticatedPage, pageObject }) => {
    // Arrange
    await pageObject.goto();

    // Act
    await pageObject.performAction();

    // Assert
    await pageObject.expectResult();
  });
});
```

## 🔒 Authentification et mocking

### Fixture authenticatedPage

La fixture `authenticatedPage` gère automatiquement :
- Injection du flag `__E2E_AUTH_BYPASS__`
- Mocking des API d'authentification
- État authentifié valide pour les tests

### Pattern de mocking simplifié

```typescript
// Mock simple avec helpers typés
await authenticatedPage.route('**/api/v1/budgets/*/details', route =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(createBudgetDetailsMock(budgetId))
  })
);
```

**Priorité** : Les derniers mocks enregistrés sont prioritaires

## 💡 Debugging rapide

```bash
# Mode debug interactif
pnpm test:e2e --debug

# Mode headed (voir le navigateur)
pnpm test:e2e --headed

# Trace viewer pour analyser les échecs
pnpm test:e2e --trace on

# UI mode pour développement
pnpm test:e2e --ui
```

**Artifacts automatiques** : Screenshots et videos sur échec dans `test-results/`

## 🚀 CI/CD avec GitHub Actions

- **Exécution parallèle** sur Chromium (Firefox et WebKit désactivés pour rapidité)
- **Artifacts automatiques** : screenshots, videos, traces sur échec
- **Stratégie de retry** : 1 retry en CI pour gérer les flaky tests
- **Performance** : Workers à 50% en CI pour stabilité

## 🔧 Dépannage

**Tests échouent localement ?**
```bash
# Vérifier que l'app tourne
pnpm run start:ci

# Régénérer la session auth
rm -rf playwright/.auth && pnpm test:e2e

# Mode debug pour investiguer
pnpm test:e2e --debug
```

**Timeout sur sélecteurs ?**
- Utiliser `npx playwright codegen` pour générer les bons sélecteurs
- Vérifier avec l'inspecteur : `pnpm test:e2e --ui`

**Tests flaky ?**
- Vérifier l'isolation des tests
- Utiliser l'auto-waiting, pas de `waitForTimeout`
- Préférer `getByRole()` aux sélecteurs CSS
