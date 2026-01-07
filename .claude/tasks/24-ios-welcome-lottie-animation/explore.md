# Task: Remplacer l'icône billets par l'animation Lottie sur l'écran d'accueil iOS

## Résumé

L'utilisateur souhaite remplacer l'icône `banknote.fill` (SF Symbol) sur l'écran d'accueil iOS (`WelcomeStep`) par l'animation Lottie utilisée dans le frontend Angular.

## Contexte Codebase

### Fichier iOS à modifier

- **`ios/Pulpe/Features/Onboarding/Steps/WelcomeStep.swift:17-19`** - L'icône actuelle :
  ```swift
  Image(systemName: "banknote.fill")
      .font(.system(size: 80))
      .foregroundStyle(.tint)
  ```

### Animation Lottie source (Angular Frontend)

- **Fichier JSON** : `frontend/projects/webapp/public/lottie/welcome-animation.json`
- **Taille** : ~246 KB (optimisé, acceptable)
- **Versions alternatives** : `variations/welcome-v1.json` (80 KB), `welcome-v2.json` (240 KB)

### Utilisation dans Angular (`frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts:203-214`)

```typescript
protected readonly lottieOptions: AnimationOptions = {
  path: '/lottie/welcome-animation.json',
  loop: true,
  autoplay: true,
  renderer: 'svg',
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid meet',
    progressiveLoad: true,
    hideOnTransparent: true,
  },
  assetsPath: '/lottie/',
};
```

## Recherche - Lottie iOS SwiftUI

### Librairie recommandée

- **`airbnb/lottie-ios`** - Librairie officielle avec support SwiftUI natif (v4.3.0+)
- **Installation** : Swift Package Manager via `https://github.com/airbnb/lottie-spm` (500 KB vs 300 MB pour le repo principal)

### Composant SwiftUI natif (Lottie 4.3.0+)

```swift
import Lottie

LottieView(animation: .named("welcome-animation"))
    .playing()
    .looping()
```

### Alternative UIViewRepresentable (si besoin de plus de contrôle)

```swift
import SwiftUI
import Lottie

struct LottieAnimationView: UIViewRepresentable {
    let animationName: String
    let loopMode: LottieLoopMode

    func makeUIView(context: Context) -> some UIView {
        let view = UIView(frame: .zero)
        let animationView = LottieAnimationView()

        animationView.animation = LottieAnimation.named(animationName)
        animationView.contentMode = .scaleAspectFit
        animationView.loopMode = loopMode
        animationView.play()

        view.addSubview(animationView)
        animationView.translatesAutoresizingMaskIntoConstraints = false
        animationView.heightAnchor.constraint(equalTo: view.heightAnchor).isActive = true
        animationView.widthAnchor.constraint(equalTo: view.widthAnchor).isActive = true

        return view
    }

    func updateUIView(_ uiView: UIViewType, context: Context) { }
}
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `ios/Pulpe/Features/Onboarding/Steps/WelcomeStep.swift:17-19` | Icône à remplacer |
| `frontend/projects/webapp/public/lottie/welcome-animation.json` | Animation Lottie source |
| `ios/Pulpe.xcodeproj/project.pbxproj` | Configuration Xcode (ajout dépendance SPM + fichier JSON) |

## Patterns à suivre

### Structure iOS existante

- Les composants réutilisables sont dans `ios/Pulpe/Shared/Components/`
- Les vues utilisent SwiftUI avec `@Environment`, `@State`
- Exemple de composant existant : `PulpeLogo.swift` (cercle avec gradient)

### Convention de nommage

- Fichiers Swift : PascalCase (ex: `LottieAnimationView.swift`)
- Ressources : kebab-case (ex: `welcome-animation.json`)

## Dépendances à ajouter

1. **Swift Package** : `lottie-ios` via SPM
   - URL : `https://github.com/airbnb/lottie-spm`
   - Version : Dernière stable (4.x)

2. **Fichier ressource** : Copier `welcome-animation.json` dans le bundle iOS

## Étapes d'implémentation suggérées

1. Ajouter la dépendance `lottie-ios` via Swift Package Manager dans Xcode
2. Copier `welcome-animation.json` dans `ios/Pulpe/Resources/Lottie/`
3. Créer un composant réutilisable `LottieAnimationView.swift` dans `Shared/Components/`
4. Mettre à jour `WelcomeStep.swift` pour utiliser l'animation Lottie
5. Tester sur simulateur et device

## Notes importantes

- Le fichier JSON Lottie est auto-contenu (pas de dépendances externes d'images)
- L'animation doit être en loop infini comme dans Angular
- Taille recommandée : ~200x200 pour correspondre à l'icône actuelle (80pt avec padding)
