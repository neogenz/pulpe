# Feature: iOS UI Harmonization — DA Alignment

## Vision

Réharmoniser l'UI de tous les écrans et vues de l'app iOS Pulpe pour incarner les 4 piliers émotionnels de la DA : **Soulagement, Clarté, Contrôle, Légèreté**.

L'app actuelle a de bonnes fondations (65-70% aligné DA) mais souffre de valeurs hardcodées, rouge agressif pour les erreurs, dark mode cheap, formulaires inconsistants avec bordures CRM, typographie non-uniforme, et surfaces system gray au lieu du fond verdâtre DA.

## Problem

- Violation majeure DA : rouge agressif partout pour les erreurs alors que la DA dit explicitement "pas de rouge agressif"
- 18 fichiers avec `.white`/`.black` hardcodé sans adaptation dark mode
- 8 fichiers avec `.stroke()`/`.border()` sur les inputs (look CRM)
- Surfaces non-DA : utilisation de system grays au lieu du fond verdâtre (#F6FFF0/#EBFFE6)
- Aucun token d'animation formalisé dans DesignTokens (existe dans AnimationConstants.swift séparément)
- Les deux hero cards (DashboardHeroCard et HeroBalanceCard) ont des styles incohérents

## Solution

Procéder par phases : fondations design system → formulaires → écrans principaux → composants partagés. Chaque changement utilise exclusivement les tokens existants ou enrichis. Compiler et vérifier après chaque story.

## Success Criteria

- Zéro `.red`, `Color.red`, `.green`, `Color.green` dans les vues (sauf Typography.swift/Color+Pulpe.swift)
- Zéro `.white`/`.black` hardcodé dans les vues
- Zéro `.stroke()`/`.border()` sur les inputs de formulaire
- Toutes les couleurs supportent light ET dark mode avec contraste WCAG AA
- Toutes les fonts utilisent PulpeTypography
- Toutes les surfaces utilisent les couleurs DA (surfacePrimary, surfaceCard)
- Le projet compile après chaque story
- CustomTabBar.swift inchangé

## Key Features

1. Design system enrichi avec tokens d'animation consolidés
2. Formulaires natifs SwiftUI sans bordures CRM
3. Erreurs non-punitives (tons chauds au lieu de rouge)
4. Surfaces DA verdâtres au lieu de system gray
5. Typographie unifiée via PulpeTypography partout
6. Dark mode cohérent et contrasté

## Phases

### Phase 1: Fondations Design System
- Consolider les tokens d'animation dans DesignTokens
- Remplacer les couleurs agressives dans Color+Pulpe et DesignTokens
- Enrichir View+Extensions avec .pulpeCard() et .pulpeSectionHeader() si manquants

### Phase 2: Formulaires et Sheets (9 fichiers)
- Remplacer .stroke()/.border() par Form natif
- Unifier typographie des labels et valeurs
- Remplacer .white/.black par tokens DA
- Remplacer .red par Color.errorPrimary

### Phase 3: Écrans principaux
- LoginView : redesign chaleureux, erreurs douces
- Onboarding : flow aéré, pas de rouge
- Dashboard : hero cards harmonisées, surfaces DA
- Budget List & Details : listes propres, .red → ambre
- Templates : même traitement
- Account : harmonisation tokens
- ProductTips : fix bug width tooltip

### Phase 4: Composants partagés
- ErrorView : tons chauds
- LoadingView : overlay léger
- KindBadge : couleurs sémantiques
- ToastView : typo PulpeTypography
- SectionHeader : uniformisation usage

## Out of Scope

- CustomTabBar.swift — ne pas toucher
- Refactoring fonctionnel (pas de changement de logique métier)
- Nouvelles fonctionnalités
- Dépendances externes supplémentaires

## Context from Codebase

### Design System Files
- `ios/Pulpe/Shared/Design/DesignTokens.swift` — Spacing, CornerRadius, Card, FormField, Shadow, Opacity, Icon, Progress
- `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift` — Toutes les couleurs avec light/dark
- `ios/Pulpe/Shared/Styles/Typography.swift` — PulpeTypography complet
- `ios/Pulpe/Shared/Extensions/View+Extensions.swift` — Extensions dont pulpeCard(), pulpeSectionHeader()
- `ios/Pulpe/Shared/Styles/AnimationConstants.swift` — Durées et springs (à consolider)

### Patterns existants
- `DesignTokens.CornerRadius.md` pour les radius (déjà tokenisé)
- `Color.financialOverBudget` existe pour remplacer .red sur les dépassements
- `Color.errorPrimary` existe pour remplacer .red sur les erreurs
- `Color.financialIncome/Expense/Savings` existent pour les couleurs sémantiques
- `heroCardStyle()` modifier partagé entre les deux hero cards

### Contraintes techniques
- SwiftUI iOS 17+ : @Observable, .environment(), .task {}, NavigationStack(path:)
- Pas de dépendances externes (SPM limité à Supabase + Lottie)
- Build check : `xcodegen generate && xcodebuild build -scheme Pulpe -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO`

## Technical Notes

### Règles visuelles concrètes
- Cartes : fond surfaceCard, corner radius CornerRadius.lg ou xl, shadow Shadow.subtle
- Typographie : titres en rounded bold, body en default regular, montants en rounded monospacedDigit
- Couleurs sémantiques : financialIncome (bleu), financialExpense (orange), financialSavings (vert), financialOverBudget (ambre chaud, PAS rouge)
- Surfaces : fond verdâtre DA (#F6FFF0 light / #1C1C1E dark), pas de system gray pur
- Formulaires : Form natif SwiftUI avec .listRowBackground(). Pas de .stroke() ni .border()
- Erreurs : Color.errorPrimary (orange chaud) + message rassurant, JAMAIS de rouge
