# Implementation Plan: Fix Product Tour Close Bug

## Overview

Le Product Tour ne se ferme pas quand l'utilisateur clique sur "Terminer" ou "Passer" car `showTutorial` est une computed property non trackée par `@Observable`. La solution est de transformer `showTutorial` en stored property avec `didSet`, en suivant le pattern existant de `hasCompletedOnboarding`.

## Dependencies

Aucune dépendance. Fix isolé à un seul fichier.

## File Changes

### `ios/Pulpe/App/AppState.swift`

**Action 1**: Remplacer la computed property `showTutorial` (lignes 28-35) par une stored property avec `didSet`

- Créer une nouvelle stored property `tutorialCompleted` de type `Bool` initialisée depuis `UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed")`
- Ajouter un `didSet` qui sauvegarde la valeur dans `UserDefaults`
- Suivre exactement le pattern de `hasCompletedOnboarding` (ligne 24-26)

**Action 2**: Modifier la computed property `showTutorial` pour qu'elle lise depuis `tutorialCompleted`

- `showTutorial` devient une computed property en lecture seule qui retourne `!tutorialCompleted && authState == .authenticated`
- Cette computed property dépend maintenant d'une stored property trackée par `@Observable`

**Action 3**: Modifier la fonction `completeTutorial()` (ligne 89-91)

- Changer `showTutorial = false` en `tutorialCompleted = true`
- La modification de la stored property `tutorialCompleted` notifie automatiquement SwiftUI

**Structure finale attendue**:
```
// MARK: - Onboarding & Tutorial

var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: "pulpe-onboarding-completed") {
    didSet { UserDefaults.standard.set(hasCompletedOnboarding, forKey: "pulpe-onboarding-completed") }
}

private var tutorialCompleted: Bool = UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed") {
    didSet { UserDefaults.standard.set(tutorialCompleted, forKey: "pulpe-tutorial-completed") }
}

var showTutorial: Bool {
    !tutorialCompleted && authState == .authenticated
}

// Dans les actions...
func completeTutorial() {
    tutorialCompleted = true
}
```

## Testing Strategy

### Tests manuels (iOS Simulator)

1. **Reset de l'état**: Supprimer l'app du simulateur pour un état "nouvel utilisateur"
2. **Test "Terminer"**:
   - Lancer l'app
   - Compléter l'onboarding ou se connecter
   - Le tutorial s'affiche
   - Cliquer sur "Suivant" jusqu'à la dernière étape
   - Cliquer sur "Terminer"
   - **Attendu**: Le tutorial se ferme immédiatement
3. **Test "Passer"**:
   - Reset l'app
   - Le tutorial s'affiche
   - Cliquer sur "Passer"
   - **Attendu**: Le tutorial se ferme immédiatement
4. **Test persistance**:
   - Après avoir fermé le tutorial
   - Quitter l'app (background puis force quit)
   - Relancer l'app
   - **Attendu**: Le tutorial ne réapparaît pas

## Documentation

Aucune documentation à mettre à jour.

## Rollout Considerations

- Fix rétrocompatible
- Aucune migration de données nécessaire (même clé UserDefaults utilisée)
- Pas de changement d'API visible pour les autres composants
