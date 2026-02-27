# Pulpe iOS

Application iOS native pour la gestion de budget personnel, construite avec Swift et SwiftUI.

## Prérequis

- Xcode 15.0+
- iOS 18.0+
- macOS Sonoma+

## Installation

1. Ouvrir le projet dans Xcode :
   ```bash
   cd ios
   open Pulpe.xcodeproj
   ```

2. Régénérer le projet Xcode :
   ```bash
   xcodegen generate
   ```

3. Choisir un scheme d'environnement :
   - `PulpeLocal` (développement local)
   - `PulpePreview` (environnement preview)
   - `PulpeProd` (production)

4. Build et Run sur simulateur ou device

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

### Environnements iOS

L'app utilise 3 configurations Xcode mappées à des fichiers `xcconfig`:

- `Local` → `Config/Local.xcconfig`
- `Preview` → `Config/Preview.xcconfig`
- `Prod` → `Config/Prod.xcconfig`

Clés runtime exposées à l'app (via `Info.plist`):

- `APP_ENV`
- `API_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Surcharges locales non versionnées:

- `Config/Local.secrets.xcconfig`
- `Config/Preview.secrets.xcconfig`
- `Config/Prod.secrets.xcconfig`

### Secrets backend (jamais dans iOS)

- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_MASTER_KEY`

### Password Reset Deep Link

- Redirect URI iOS utilisée pour le reset: `pulpe://reset-password`
- Local Supabase: ajouter cette URI dans `backend-nest/supabase/config.toml` (`auth.additional_redirect_urls`)
- Production Supabase Dashboard: ajouter aussi `pulpe://reset-password` dans **Authentication > URL Configuration > Redirect URLs**

### Build Settings

- Deployment Target: iOS 18.0
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

# Build Local pour simulateur
xcodebuild -scheme PulpeLocal -sdk iphonesimulator

# Build Preview pour simulateur
xcodebuild -scheme PulpePreview -sdk iphonesimulator

# Tests
xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Notes

- L'app utilise la même API que le frontend Angular
- Les formules de calcul sont identiques (port de `pulpe-shared`)
- Tokens stockés dans le Keychain (pas de persistance locale des données)
