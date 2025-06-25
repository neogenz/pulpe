# Guide d'exécution des tests E2E

## Configuration requise

Avant d'exécuter les tests, configurez les variables d'environnement :

```bash
export TEST_EMAIL="votre-email-de-test@example.com"
export TEST_PASSWORD="votre-mot-de-passe-de-test"
```

## Stratégie hybride implémentée

### Tests Critical Path (90/10 - Authentification réelle)

- **Setup automatique** : Connexion réelle une seule fois
- **Tests critiques** : Utilisent la session sauvegardée
- **6 tests** qui vérifient les fonctionnalités vitales

### Tests Features (Mocks)

- **Authentification simulée** : Via `authenticatedPage` fixture
- **APIs mockées** : Réponses contrôlées
- **28 tests** rapides et isolés

## Commandes d'exécution

### Exécution complète (recommandé)

```bash
npx playwright test
```

### Tests rapides uniquement (features mockées)

```bash
npx playwright test --project="Chromium - Features (Mocked)"
```

### Tests critiques uniquement (avec setup)

```bash
npx playwright test --project="Chromium - Critical Path"
```

### Setup d'authentification uniquement

```bash
npx playwright test --project="setup"
```

## Structure des tests

```
e2e/
├── auth.setup.ts                 # Setup d'authentification réelle
├── tests/
│   ├── critical-path/            # Tests avec authentification réelle
│   │   ├── session.spec.ts       # Gestion de session
│   │   └── core-navigation.spec.ts # Navigation principale
│   └── features/                 # Tests avec mocks
│       ├── user-authentication.spec.ts
│       ├── budget-template-management.spec.ts
│       ├── monthly-budget-management.spec.ts
│       ├── navigation.spec.ts
│       └── user-onboarding-flow.spec.ts
```

## Avantages de cette approche

- **Performance** : 90% des tests utilisent des mocks (rapide)
- **Confiance** : 10% des tests vérifient le chemin critique réel
- **Maintenance** : Séparation claire des responsabilités
- **CI/CD** : Impact minimal sur les pipelines
