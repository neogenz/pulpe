# Pulpe iOS

Application iOS native pour la gestion de budget personnel, construite avec Swift et SwiftUI.

## Prérequis

- Xcode 15.0+
- iOS 17.0+
- macOS Sonoma+

## Installation

1. Ouvrir le projet dans Xcode :
   ```bash
   cd ios
   open Pulpe.xcodeproj
   ```

2. Configurer l'API :
   - En développement, l'app pointe vers `http://localhost:3000`
   - Pour changer l'URL, modifier `API_BASE_URL` dans le scheme ou `AppConfiguration.swift`

3. Build et Run sur simulateur ou device

## Structure

```
Pulpe/
├── App/                 # Entry point, AppState, MainTabView
├── Core/
│   ├── Auth/           # AuthService, KeychainManager
│   ├── Network/        # APIClient, Endpoints, Errors
│   └── Config/         # AppConfiguration
├── Domain/
│   ├── Models/         # Budget, Transaction, Template, etc.
│   ├── Services/       # BudgetService, TemplateService, etc.
│   └── Formulas/       # BudgetFormulas (calculs métier)
├── Features/
│   ├── Auth/           # LoginView
│   ├── Onboarding/     # 9-step wizard
│   ├── Tutorial/       # Interactive overlay
│   ├── CurrentMonth/   # Dashboard
│   ├── Budgets/        # List + Details
│   └── Templates/      # List + Details
├── Shared/
│   ├── Components/     # Reusable UI
│   ├── Extensions/     # Date, Decimal, View
│   └── Modifiers/      # Custom view modifiers
└── Resources/          # Assets, Info.plist
```

## Architecture

- **SwiftUI** avec `@Observable` (iOS 17+)
- **NavigationStack** type-safe
- **async/await** pour le networking
- **Keychain** pour le stockage sécurisé des tokens
- Pas de dépendances externes

## Features

- [x] Login / Signup via API NestJS
- [x] Onboarding 9 étapes
- [x] Tutoriel interactif avec spotlight
- [x] Gestion du mois courant
- [x] Liste et détails des budgets
- [x] Liste et détails des templates
- [x] Calculs métier partagés avec le frontend web
- [x] Design iOS natif (HIG)

## Configuration

### Variables d'environnement

- `API_BASE_URL` : URL de l'API backend (défaut: `http://localhost:3000`)

### Build Settings

- Deployment Target: iOS 17.0
- Swift Language Version: 5.9+

## Développement

### Lancer le backend local

```bash
cd ..
pnpm dev:backend
```

### Commandes utiles

```bash
# Nettoyer le build
xcodebuild clean

# Build pour simulateur
xcodebuild -scheme Pulpe -sdk iphonesimulator

# Tests
xcodebuild test -scheme Pulpe -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Notes

- L'app utilise la même API que le frontend Angular
- Les formules de calcul sont identiques (port de `@pulpe/shared`)
- Tokens stockés dans le Keychain (pas de persistance locale des données)
