# Pulpe iOS

Application SwiftUI native, cible iOS 18+, avec concurrence stricte, WidgetKit, Supabase
Auth, PostHog et Lottie. Les API iOS 26 restent protégées par `#available`.

## Installation

Prérequis : Xcode, XcodeGen et un simulateur iOS compatible.

```bash
cd ios
xcodegen generate
open Pulpe.xcodeproj
```

Schemes : `PulpeLocal`, `PulpePreview` et `PulpeProd`. `project.yml` est la source de vérité
du projet Xcode et des dépendances Swift Package Manager.

## Structure

- `Pulpe/App/` : entrée, état global et navigation ;
- `Pulpe/Core/` : réseau, auth, analytics et infrastructure ;
- `Pulpe/Domain/` : modèles et formules pures ;
- `Pulpe/Features/` : fonctionnalités SwiftUI ;
- `Pulpe/Shared/` : composants, design tokens et extensions ;
- `PulpeWidget/` : extension WidgetKit ;
- `PulpeTests/` : Swift Testing ;
- `PulpeUITests/` : XCUITest.

## Configuration

Les fichiers `Config/{Local,Preview,Prod}.xcconfig` définissent l'environnement. Les
surcharges `*.secrets.xcconfig` sont locales et non versionnées. Les secrets backend
(`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`) ne doivent jamais entrer dans l'app.

Les secrets de session et de chiffrement vivent dans Keychain ou en mémoire. Les préférences
bornées utilisent UserDefaults et les snapshots widget l'App Group.

## Vérification

```bash
xcodebuild -scheme PulpeLocal -showdestinations
xcodebuild build -scheme PulpeLocal -sdk iphonesimulator
# Choisir ensuite un destination id retourné ci-dessus pour xcodebuild test.
```

Les formules de `Pulpe/Domain/Formulas/` reflètent `shared/src/calculators/` et changent dans
le même commit.

## Références

- [Design iOS](DESIGN.md)
- [Machine d'état d'authentification](docs/auth-state-machine.md)
- [Extension du flux d'authentification](docs/auth-flow-extension-guide.md)
- [Configuration](Config/README.md)
