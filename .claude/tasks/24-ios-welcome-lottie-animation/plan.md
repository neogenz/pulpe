# Implementation Plan: Animation Lottie sur l'écran d'accueil iOS

## Overview

Remplacer l'icône SF Symbol `banknote.fill` sur l'écran d'accueil iOS (`WelcomeStep`) par l'animation Lottie utilisée dans le frontend Angular. L'implémentation utilise la librairie native `lottie-ios` v4.x avec son API SwiftUI déclarative `LottieView`.

## Dependencies

1. **Swift Package** : `lottie-ios` doit être ajouté via SPM avant toute modification de code
2. **Fichier ressource** : Le fichier JSON Lottie doit être copié dans le bundle avant utilisation

## File Changes

### 1. `ios/Pulpe.xcodeproj/project.pbxproj`

**Action manuelle dans Xcode** (ne pas modifier manuellement le fichier) :

1. Ouvrir le projet dans Xcode
2. File → Add Package Dependencies
3. URL : `https://github.com/airbnb/lottie-spm` (version optimisée pour SPM, 500KB vs 300MB)
4. Version : "Up to Next Major" depuis `4.0.0`
5. Ajouter au target `Pulpe`

### 2. `ios/Pulpe/Resources/Lottie/welcome-animation.json` (nouveau)

- Action : Copier le fichier depuis `frontend/projects/webapp/public/lottie/welcome-animation.json`
- Créer le dossier `Lottie/` dans `Resources/`
- S'assurer que le fichier est ajouté au target `Pulpe` dans Xcode (Copy Bundle Resources)
- Pattern : Suivre la convention existante dans `Resources/` (Assets.xcassets, Info.plist)

### 3. `ios/Pulpe/Shared/Components/WelcomeLottieView.swift` (nouveau)

- Action : Créer un composant SwiftUI réutilisable pour l'animation Lottie
- Pattern : Suivre le style de `LoadingView.swift` et `PulpeLogo.swift`
- Fonctionnalités :
  - Importer `Lottie` et `SwiftUI`
  - Utiliser l'API native `LottieView(animation: .named("welcome-animation"))`
  - Configurer `.playing(.loop)` pour lecture en boucle automatique
  - Ajouter `.configure { }` pour `contentMode = .scaleAspectFit`
  - Paramètre `size: CGFloat` pour contrôler la taille (défaut: 200)
  - Inclure une Preview SwiftUI
- Consider : Ne pas créer de wrapper UIViewRepresentable, utiliser l'API native SwiftUI de Lottie 4.x

### 4. `ios/Pulpe/Features/Onboarding/Steps/WelcomeStep.swift`

- Action : Remplacer l'icône SF Symbol par le nouveau composant Lottie
- Modification ligne 17-20 : Supprimer le bloc `Image(systemName: "banknote.fill")`
- Remplacer par : `WelcomeLottieView(size: 200)` avec padding approprié
- Ajuster le `.padding(.top, 40)` si nécessaire pour l'alignement visuel
- Consider : L'animation Lottie prend plus de place que l'icône SF Symbol, ajuster le layout si besoin

## Testing Strategy

### Tests manuels (prioritaires)

1. **Simulateur iOS** :
   - Lancer l'app sur simulateur iPhone (15 Pro recommandé)
   - Vérifier que l'animation Lottie s'affiche sur l'écran Welcome
   - Vérifier que l'animation boucle correctement
   - Vérifier le dimensionnement et l'alignement

2. **Device physique** :
   - Tester sur iPhone réel pour vérifier les performances
   - Vérifier que l'animation est fluide (60fps)

3. **Cas limites** :
   - Mode sombre : vérifier que l'animation reste visible
   - Rotation écran (si supporté)
   - Accessibilité : reduced motion (optionnel)

### Vérifications build

```bash
# Dans le dossier ios/
xcodebuild -scheme Pulpe -destination 'platform=iOS Simulator,name=iPhone 15 Pro' build
```

## Documentation

- Aucune documentation à mettre à jour (changement visuel uniquement)

## Rollout Considerations

- **Breaking changes** : Aucun
- **Migration** : Aucune
- **Feature flags** : Non nécessaire (amélioration visuelle simple)
- **Taille bundle** : +246 KB (fichier JSON) + ~500 KB (librairie Lottie SPM)
- **Performance** : Lottie est optimisé pour iOS, rendu natif vectoriel

## Ordre d'exécution

1. ✅ Ajouter la dépendance `lottie-spm` via Xcode (manuel)
2. Copier le fichier `welcome-animation.json` dans `Resources/Lottie/`
3. Créer `WelcomeLottieView.swift` dans `Shared/Components/`
4. Modifier `WelcomeStep.swift` pour utiliser le nouveau composant
5. Build et test sur simulateur
6. Test sur device physique
