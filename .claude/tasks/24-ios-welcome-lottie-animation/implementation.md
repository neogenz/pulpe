# Implementation: Animation Lottie sur l'écran d'accueil iOS

## Completed

- Ajout de la dépendance `lottie-spm` dans `ios/project.yml` (v4.0.0+)
- Copie du fichier `welcome-animation.json` dans `ios/Pulpe/Resources/Lottie/`
- Création du composant `WelcomeLottieView.swift` dans `ios/Pulpe/Shared/Components/`
- Modification de `WelcomeStep.swift` pour utiliser l'animation Lottie
- Régénération du projet Xcode avec `xcodegen generate`

## Files Changed

| File | Action |
|------|--------|
| `ios/project.yml` | Ajout package `lottie-spm` et dépendance `Lottie` |
| `ios/Pulpe/Resources/Lottie/welcome-animation.json` | Nouveau - copié depuis frontend |
| `ios/Pulpe/Shared/Components/WelcomeLottieView.swift` | Nouveau - composant SwiftUI réutilisable |
| `ios/Pulpe/Features/Onboarding/Steps/WelcomeStep.swift` | Remplacement icône SF Symbol par animation Lottie |
| `ios/Pulpe.xcodeproj/project.pbxproj` | Régénéré automatiquement par xcodegen |

## Deviations from Plan

- **XcodeGen au lieu de modification manuelle** : Le plan original suggérait de modifier manuellement les dépendances dans Xcode. En découvrant que le projet utilise XcodeGen (`project.yml`), j'ai modifié ce fichier et régénéré le projet, ce qui est plus maintenable et reproductible.

## Test Results

- Build: ✓ `xcodebuild -scheme Pulpe -destination 'platform=iOS Simulator,id=...' build` - **BUILD SUCCEEDED**

## Technical Details

### Dépendance Lottie

- Package: `https://github.com/airbnb/lottie-spm`
- Version: 4.0.0+ (up to next major)
- Taille: ~500 KB (version SPM optimisée)

### Composant WelcomeLottieView

```swift
LottieView(animation: .named("welcome-animation"))
    .playing(loopMode: .loop)
    .resizable()
    .scaledToFit()
    .frame(width: size, height: size)
```

- Utilise l'API SwiftUI native de Lottie 4.x
- Paramètre `size` configurable (défaut: 200)
- Animation en boucle infinie

### Impact Bundle

- Fichier JSON Lottie: ~246 KB
- Librairie Lottie SPM: ~500 KB
- Total: ~750 KB

## Follow-up Tasks

- Test sur device physique pour vérifier les performances de l'animation
- Vérification du rendu en mode sombre
- Optionnel: Support `accessibilityReduceMotion` pour désactiver l'animation si nécessaire
