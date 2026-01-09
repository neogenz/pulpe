# Task: Fix Product Tour Close Bug

**Bug**: Lors du premier lancement de l'app, quand on clique sur "Terminer" ou "Passer" dans le Product Tour, le tour ne se ferme pas. L'utilisateur doit rebooter l'app.

## Root Cause Analysis

### Le problème identifié

Le bug se trouve dans `ios/Pulpe/App/AppState.swift:28-35` :

```swift
var showTutorial: Bool {
    get { !UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed") && authState == .authenticated }
    set {
        if !newValue {
            UserDefaults.standard.set(true, forKey: "pulpe-tutorial-completed")
        }
    }
}
```

**Cause racine** : `showTutorial` est une **computed property** qui lit directement `UserDefaults`. Le framework `@Observable` ne peut pas détecter les changements dans une computed property qui dépend d'une source externe (`UserDefaults`).

Quand `completeTutorial()` appelle `showTutorial = false` :
1. La valeur `true` est correctement sauvegardée dans `UserDefaults` (clé: `pulpe-tutorial-completed`)
2. **MAIS** SwiftUI ne reçoit pas de notification de changement car `showTutorial` n'est pas une stored property trackée par `@Observable`
3. Le `TutorialOverlay` reste affiché jusqu'au prochain accès qui force la relecture (comme un reboot)

### Comparaison avec `hasCompletedOnboarding`

Le pattern pour `hasCompletedOnboarding` fonctionne correctement (`AppState.swift:24-26`) :

```swift
var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: "pulpe-onboarding-completed") {
    didSet { UserDefaults.standard.set(hasCompletedOnboarding, forKey: "pulpe-onboarding-completed") }
}
```

Ce pattern utilise une **stored property** avec `didSet` observer, ce qui permet à `@Observable` de détecter les changements.

## Codebase Context

### Key Files

| File | Purpose |
|------|---------|
| `ios/Pulpe/App/AppState.swift:28-35` | **BUG** - `showTutorial` computed property |
| `ios/Pulpe/App/AppState.swift:89-91` | `completeTutorial()` function |
| `ios/Pulpe/Features/Tutorial/TutorialOverlay.swift:28,32` | Calls `appState.completeTutorial()` |
| `ios/Pulpe/App/PulpeApp.swift:34-36` | Displays tutorial overlay based on `appState.showTutorial` |

### Flow Analysis

1. **PulpeApp.swift:34** vérifie `if appState.showTutorial` pour afficher le `TutorialOverlay`
2. **TutorialOverlay.swift:28,32** appelle `appState.completeTutorial()` quand l'utilisateur clique "Terminer" ou "Passer"
3. **AppState.swift:90** exécute `showTutorial = false`
4. Le setter met à jour `UserDefaults` mais **SwiftUI n'est pas notifié** → overlay reste visible

## Solution

Transformer `showTutorial` en stored property avec `didSet` (comme `hasCompletedOnboarding`) :

```swift
// AVANT (buggy)
var showTutorial: Bool {
    get { !UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed") && authState == .authenticated }
    set {
        if !newValue {
            UserDefaults.standard.set(true, forKey: "pulpe-tutorial-completed")
        }
    }
}

// APRÈS (fixed)
private var tutorialCompleted: Bool = UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed") {
    didSet { UserDefaults.standard.set(tutorialCompleted, forKey: "pulpe-tutorial-completed") }
}

var showTutorial: Bool {
    !tutorialCompleted && authState == .authenticated
}

func completeTutorial() {
    tutorialCompleted = true
}
```

Alternative plus simple :
```swift
var showTutorial: Bool = !UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed") {
    didSet {
        if !showTutorial {
            UserDefaults.standard.set(true, forKey: "pulpe-tutorial-completed")
        }
    }
}
```

**Note**: Cette seconde option nécessite de vérifier `authState == .authenticated` ailleurs ou d'adapter la logique.

## Dependencies

- Aucune dépendance externe
- Fix isolé à `AppState.swift`

## Patterns to Follow

Le pattern existant pour `hasCompletedOnboarding` (stored property + didSet) fonctionne correctement et doit être répliqué.

## Testing

- Vérifier que le tutorial se ferme immédiatement au clic sur "Terminer"
- Vérifier que le tutorial se ferme immédiatement au clic sur "Passer"
- Vérifier que le tutorial ne réapparaît pas après un reboot
- Vérifier que le tutorial s'affiche bien pour un nouvel utilisateur
