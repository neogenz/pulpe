# Task: iOS CI/CD avec GitHub Actions

## Objectif

Mettre en place une CI/CD iOS pour :
- **Phase 1** : Build & Test sur chaque PR (sans signing)
- **Phase 2** : Releases automatiques vers TestFlight (après Apple Developer Program)

---

## Contexte du Projet

### Structure actuelle

```
ios/
├── CLAUDE.md
├── project.yml              # XcodeGen config
├── Pulpe/                   # App principale
├── PulpeWidget/             # Widget extension
├── scripts/
│   └── bump-version.sh      # Versioning existant
└── Pulpe.xcodeproj/         # Généré par XcodeGen
```

### Configuration XcodeGen (`project.yml`)

| Setting | Valeur |
|---------|--------|
| Bundle ID | `app.pulpe.ios` |
| iOS Target | 17.0 |
| Xcode Version | 15.0 |
| Swift Version | 5.9 |
| Code Sign Style | Automatic |
| DEVELOPMENT_TEAM | _(vide - à configurer)_ |

### Dépendances SPM

- `supabase-swift` (2.0.0+)
- `lottie-spm` (4.0.0+)

### CI existante (`.github/workflows/ci.yml`)

- Frontend/Backend uniquement
- Pas de job iOS
- Utilise pnpm, Bun, Supabase local
- Pattern de cache bien établi

---

## Phase 1 : Build & Test sur PR

### Workflow recommandé

```yaml
name: iOS Build

on:
  push:
    branches: [main, develop]
    paths:
      - 'ios/**'
  pull_request:
    branches: [main, develop]
    paths:
      - 'ios/**'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-ios:
    name: Build & Test iOS
    runs-on: macos-14
    timeout-minutes: 30
    defaults:
      run:
        working-directory: ios

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.4'

      - name: Install XcodeGen
        run: brew install xcodegen

      - name: Cache SPM packages
        uses: actions/cache@v4
        with:
          path: |
            ~/Library/Developer/Xcode/DerivedData/**/SourcePackages
            ~/Library/Caches/org.swift.swiftpm
          key: spm-${{ hashFiles('ios/Pulpe.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved') }}
          restore-keys: spm-

      - name: Cache DerivedData
        uses: actions/cache@v4
        with:
          path: ~/Library/Developer/Xcode/DerivedData
          key: deriveddata-${{ hashFiles('ios/project.yml') }}-${{ github.sha }}
          restore-keys: deriveddata-${{ hashFiles('ios/project.yml') }}-

      - name: Generate Xcode project
        run: xcodegen generate

      - name: Build for testing
        run: |
          xcodebuild build-for-testing \
            -scheme Pulpe \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.5' \
            -derivedDataPath build/DerivedData \
            CODE_SIGNING_ALLOWED=NO \
            | xcpretty

      - name: Run tests (si présents)
        run: |
          xcodebuild test-without-building \
            -scheme Pulpe \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.5' \
            -derivedDataPath build/DerivedData \
            | xcpretty
        continue-on-error: true  # Pas de tests pour l'instant
```

### Points clés Phase 1

| Aspect | Choix |
|--------|-------|
| Runner | `macos-14` (gratuit pour repo public) |
| Xcode | 15.4 (via `maxim-lobanov/setup-xcode`) |
| Signing | `CODE_SIGNING_ALLOWED=NO` (pas de certs) |
| Cache | SPM + DerivedData |
| Trigger | Uniquement si `ios/**` modifié |

---

## Phase 2 : TestFlight (après Apple Developer)

### Prérequis

1. **Apple Developer Program** (99$/an)
2. **DEVELOPMENT_TEAM** configuré dans `project.yml`
3. **Repo privé pour certificats** (Match)
4. **App Store Connect API Key** (.p8)

### Structure Fastlane

```
ios/
├── fastlane/
│   ├── Fastfile           # Lanes (build, test, beta)
│   ├── Appfile            # Bundle ID, Team ID
│   ├── Matchfile          # Config certificats
│   └── .env.default       # Variables locales (gitignored)
├── Gemfile
└── Gemfile.lock
```

### Fichiers de configuration

**Gemfile** :
```ruby
source "https://rubygems.org"
gem "fastlane", "~> 2.219"
```

**Appfile** :
```ruby
app_identifier("app.pulpe.ios")
apple_id("your-email@example.com")  # À remplacer
team_id("XXXXXXXXXX")               # À remplacer
itc_team_id("XXXXXXXXXX")           # À remplacer
```

**Matchfile** :
```ruby
git_url("https://github.com/YOUR_ORG/pulpe-certificates.git")
storage_mode("git")
type("appstore")
app_identifier(["app.pulpe.ios", "app.pulpe.ios.widget"])
readonly(true)
```

**Fastfile** :
```ruby
default_platform(:ios)

platform :ios do
  before_all do
    setup_ci if ENV['CI']
  end

  desc "Run tests"
  lane :tests do
    run_tests(
      scheme: "Pulpe",
      device: "iPhone 15",
      code_coverage: true
    )
  end

  desc "Build and upload to TestFlight"
  lane :beta do
    # Sync certificates
    match(type: "appstore", readonly: true)

    # Increment build number
    increment_build_number(
      build_number: latest_testflight_build_number + 1,
      xcodeproj: "Pulpe.xcodeproj"
    )

    # Build
    build_app(
      scheme: "Pulpe",
      export_method: "app-store",
      include_symbols: true
    )

    # Upload
    upload_to_testflight(
      skip_waiting_for_build_processing: true
    )
  end
end
```

### Workflow GitHub Actions Phase 2

```yaml
name: iOS Release

on:
  push:
    tags:
      - 'ios-v*'

jobs:
  deploy-testflight:
    name: Deploy to TestFlight
    runs-on: macos-14
    defaults:
      run:
        working-directory: ios

    steps:
      - uses: actions/checkout@v4

      - uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.4'

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
          working-directory: ios

      - name: Install XcodeGen
        run: brew install xcodegen

      - name: Generate Xcode project
        run: xcodegen generate

      - name: Deploy to TestFlight
        run: bundle exec fastlane beta
        env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_PRIVATE_KEY: ${{ secrets.MATCH_GIT_PRIVATE_KEY }}
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          APP_STORE_CONNECT_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY_CONTENT: ${{ secrets.ASC_KEY_CONTENT }}
```

### Secrets GitHub requis (Phase 2)

| Secret | Description |
|--------|-------------|
| `MATCH_PASSWORD` | Passphrase pour déchiffrer les certificats |
| `MATCH_GIT_PRIVATE_KEY` | SSH key pour accéder au repo certificats |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect Issuer ID |
| `ASC_KEY_CONTENT` | Contenu du fichier .p8 (base64) |

---

## Bonnes pratiques

### Caching

```yaml
# SPM packages (le plus impactant)
key: spm-${{ hashFiles('**/Package.resolved') }}

# DerivedData (builds incrémentaux)
key: deriveddata-${{ hashFiles('project.yml') }}-${{ github.sha }}

# Gems (Fastlane)
bundler-cache: true
```

### Éviter les pièges

| Piège | Solution |
|-------|----------|
| Build hang sur keychain | `setup_ci if ENV['CI']` dans Fastfile |
| Cache invalide | Hash sur `Package.resolved` + `project.yml` |
| Xcode version mismatch | `maxim-lobanov/setup-xcode@v1` |
| Attente processing TestFlight | `skip_waiting_for_build_processing: true` |
| Certificats dans le repo public | Match avec repo privé séparé |

### XcodeGen en CI

Toujours régénérer le projet en CI :
```bash
xcodegen generate
```

Cela garantit la cohérence même si le `.xcodeproj` n'est pas commité.

---

## Checklist de setup

### Phase 1 (maintenant)

- [ ] Créer `.github/workflows/ios.yml`
- [ ] Valider que le build compile
- [ ] Ajouter des tests unitaires (optionnel)

### Phase 2 (après Apple Developer)

- [ ] S'inscrire à Apple Developer Program
- [ ] Configurer `DEVELOPMENT_TEAM` dans `project.yml`
- [ ] Créer repo privé pour certificats
- [ ] Initialiser Fastlane (`fastlane init`)
- [ ] Setup Match (`fastlane match init`)
- [ ] Créer API Key App Store Connect
- [ ] Ajouter secrets GitHub
- [ ] Créer workflow de release

---

## Fichiers clés du projet

| Fichier | Rôle |
|---------|------|
| `ios/project.yml` | Configuration XcodeGen |
| `ios/scripts/bump-version.sh` | Gestion versions (existant) |
| `.github/workflows/ci.yml` | CI frontend/backend (pattern à suivre) |

---

## Ressources

- [Fastlane Docs](https://docs.fastlane.tools/)
- [GitHub Actions for iOS](https://docs.github.com/en/actions/deployment/deploying-xcode-applications)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
- [Match Code Signing](https://docs.fastlane.tools/actions/match/)
