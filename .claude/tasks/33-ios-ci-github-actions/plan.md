# Implementation Plan: iOS CI Phase 1

## Overview

Créer un workflow GitHub Actions pour builder l'app iOS sur chaque PR/push qui modifie `ios/`. Phase 1 = validation du build sans code signing (pas besoin d'Apple Developer).

## Dependencies

- Aucune modification préalable requise
- Le projet compile déjà localement

---

## File Changes

### `.github/workflows/ios.yml` (CREATE)

**Metadata**
- Name: `iOS Build`
- Triggers: push/PR sur `main`/`develop` avec path filter `ios/**`
- Concurrency: cancel-in-progress sur même ref
- Permissions: `contents: read`

**Job: build-ios**
- Runner: `macos-14` (gratuit pour repo public)
- Timeout: 30 minutes
- Working directory par défaut: `ios`

**Steps à implémenter dans l'ordre**:
1. Checkout avec `actions/checkout@v4`
2. Setup Xcode 15.4 avec `maxim-lobanov/setup-xcode@v1`
3. Installer XcodeGen via Homebrew
4. Cache SPM packages:
   - Paths: `~/Library/Developer/Xcode/DerivedData/**/SourcePackages`, `~/Library/Caches/org.swift.swiftpm`
   - Key basée sur `Package.resolved`
5. Cache DerivedData:
   - Path: `~/Library/Developer/Xcode/DerivedData`
   - Key basée sur `project.yml` + SHA
6. Générer le projet Xcode avec `xcodegen generate`
7. Build avec xcodebuild:
   - Scheme: `Pulpe`
   - Destination: iPhone 15 Simulator, iOS 17.5
   - `CODE_SIGNING_ALLOWED=NO`
   - Output via xcpretty pour logs lisibles
8. (Optionnel) Run tests si présents, avec `continue-on-error: true`

**Pattern à suivre**: Structure similaire au job `build` dans `ci.yml` (même conventions de nommage des steps)

---

### `ios/CLAUDE.md` (UPDATE)

**Section à ajouter**: "## CI/CD"

- Documenter que le build iOS est validé sur chaque PR
- Ajouter la commande locale équivalente pour reproduire le build CI:
  ```bash
  xcodegen generate && xcodebuild build -scheme Pulpe -destination 'platform=iOS Simulator,name=iPhone 15' CODE_SIGNING_ALLOWED=NO
  ```
- Mentionner que Phase 2 (TestFlight) viendra après Apple Developer Program

---

## Testing Strategy

**Validation automatique**:
- Pusher un changement dans `ios/` et vérifier que le workflow se déclenche
- Vérifier que le build compile sans erreur
- Vérifier dans les logs que le cache est restauré au 2ème run

**Validation manuelle**:
- Ouvrir l'onglet Actions sur GitHub
- Confirmer que le job `Build & Test iOS` apparaît
- Vérifier le temps de build (~15-20 min premier run, ~5-10 min avec cache)

---

## Rollout Considerations

- **Pas de breaking change**: nouveau fichier, n'impacte pas le CI existant
- **Pas de secrets requis**: Phase 1 sans signing
- **Pas d'impact sur les autres jobs**: workflow indépendant

---

## Phase 2 (Future - après Apple Developer)

Cette tâche ne couvre que Phase 1. Phase 2 sera une tâche séparée incluant:
- Setup Fastlane (Gemfile, Fastfile, Appfile, Matchfile)
- Workflow de release vers TestFlight
- Configuration des secrets GitHub
