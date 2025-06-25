# E2E Tests avec Playwright - Stratégie Hybride

Ce dossier contient tous les tests E2E pour l'application Pulpe, organisés selon une **stratégie hybride d'authentification** optimisée pour un développeur solo.

## Stratégie hybride 90/10

### ⚡ 90% Features (Mocks) - Rapide et fiable

- **28 tests** avec authentification simulée
- **APIs mockées** pour isolation complète
- **Exécution rapide** et parallèle

### 🔐 10% Critical Path (Authentification réelle)

- **6 tests** avec session authentifiée réelle
- **Chemin critique** validé de bout en bout
- **Confiance maximale** sur les fonctionnalités vitales

## Structure des dossiers

```
e2e/
├── auth.setup.ts          # Setup d'authentification réelle (exécuté une fois)
├── fixtures/               # Fixtures personnalisées et données de test
├── pages/                  # Page Objects pour l'encapsulation des pages
├── tests/
│   ├── critical-path/      # Tests avec authentification réelle (6 tests)
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

## Configuration requise

Définir les variables d'environnement pour les tests Critical Path :

```bash
export TEST_EMAIL="votre-email-de-test@example.com"
export TEST_PASSWORD="votre-mot-de-passe-de-test"
```

## Commandes d'exécution

### Exécution complète (recommandée)

```bash
npx playwright test
```

Exécute : Setup → Critical Path → Features

### Tests rapides uniquement (développement)

```bash
npx playwright test --project="Chromium - Features (Mocked)"
```

Exécute seulement les 28 tests mockés (rapide)

### Tests critiques uniquement

```bash
npx playwright test --project="Chromium - Critical Path"
```

Exécute le setup + 6 tests avec authentification réelle

### Setup d'authentification uniquement

```bash
npx playwright test --project="setup"
```

Génère le fichier de session `playwright/.auth/user.json`

## Projets Playwright configurés

| Projet            | Tests | Authentification    | Utilisation     |
| ----------------- | ----- | ------------------- | --------------- |
| **setup**         | 1     | Réelle (LOGIN UI)   | Génère session  |
| **Critical Path** | 6     | Session sauvegardée | Chemin critique |
| **Features**      | 28    | Mocks complets      | Développement   |

## Bonnes pratiques implémentées

### 1. Page Object Model (POM)

Chaque page de l'application a son propre Page Object dans le dossier `pages/` :

- `login.page.ts` - Page de connexion
- `onboarding.page.ts` - Processus d'onboarding
- `current-month.page.ts` - Dashboard du mois en cours
- `budget-templates.page.ts` - Gestion des templates de budget

### 2. Fixtures personnalisées

Dans `fixtures/test-fixtures.ts`, nous avons défini :

- `loginPage`, `onboardingPage`, etc. - Instances des Page Objects
- `authenticatedPage` - Page avec authentification automatique

### 3. Tests isolés

- Chaque test est complètement indépendant
- Utilisation de `test.describe.configure({ mode: 'parallel' })` pour l'exécution parallèle
- Pas de dépendances entre les tests

### 4. Sélecteurs robustes

Ordre de priorité pour les sélecteurs :

1. `data-testid` (recommandé pour les tests)
2. Sélecteurs par rôle/texte (pour l'accessibilité)
3. Sélecteurs CSS stables (éviter les classes qui peuvent changer)

### 5. Assertions web-first

Utilisation des assertions Playwright qui attendent automatiquement :

```typescript
await expect(locator).toBeVisible();
await expect(page).toHaveURL(/pattern/);
```

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

## Mocking et authentification

L'authentification est mockée via la fixture `authenticatedPage` qui :

1. Injecte un flag `__E2E_AUTH_BYPASS__` dans le contexte de la page
2. Mock les réponses API d'authentification
3. Simule un état authentifié valide

## Conseils pour écrire de bons tests

1. **Tester le comportement visible par l'utilisateur**

   - Ne pas tester les détails d'implémentation
   - Se concentrer sur ce que l'utilisateur voit et fait

2. **Utiliser les Page Objects**

   - Encapsuler la logique de navigation et d'interaction
   - Réutiliser les méthodes communes

3. **Éviter les timeouts hardcodés**

   - Utiliser les assertions web-first qui attendent automatiquement
   - Si nécessaire, utiliser `waitForLoadState` ou `waitForSelector`

4. **Gérer les erreurs gracieusement**

   - Tester les cas d'erreur (API 500, network failure)
   - Vérifier que l'application reste stable

5. **Tests responsives**
   - Tester sur différentes tailles d'écran
   - Utiliser `page.setViewportSize()` pour simuler

## CI/CD

Les tests sont configurés pour s'exécuter automatiquement dans GitHub Actions avec :

- Tests sur plusieurs navigateurs (Chromium, Firefox, WebKit)
- Artifacts (screenshots, videos) en cas d'échec
- Rapports HTML consultables

## Dépannage

### Les tests échouent localement

1. Vérifier que l'application est lancée : `npm start`
2. Vérifier l'URL de base dans `playwright.config.ts`
3. Consulter les screenshots/videos dans `test-results/`

### Timeout sur les sélecteurs

1. Vérifier que le sélecteur est correct avec l'inspecteur Playwright
2. Utiliser `npx playwright codegen` pour générer des sélecteurs
3. Augmenter le timeout si nécessaire dans la config

### Tests flaky

1. Éviter les sélecteurs basés sur l'ordre ou la position
2. Utiliser des assertions appropriées
3. S'assurer que les tests sont vraiment isolés
