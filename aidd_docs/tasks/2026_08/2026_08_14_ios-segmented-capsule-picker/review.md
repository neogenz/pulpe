# Review: ios-segmented-capsule-picker

- **Verdict**: approve
- **Diff**: `preview...feat/ios-segmented-capsule-picker` (17 commits, correctifs de revue inclus)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_15
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

<!-- No plan.md à l'origine : critères = le brief de session enregistré dans le snapshot précédent, re-tracés sur le diff courant. Les correctifs de revue ont leur propre plan.md dans ce dossier. -->

### Phase 1 — Tous les sélecteurs 1-parmi-N sur le segmented control natif

- [x] Atome partagé unique : `SegmentedPicker` = wrapper fin sur `Picker(.segmented)` — `SegmentedPicker.swift:8-32`
- [x] Les 3 toggles restent des wrappers fins, plomberie `accentColor` retirée — `KindToggle.swift:7`, `SpreadModeToggle.swift:20`, `SpreadAmountModeToggle.swift:22`, call sites `AddBudgetLineSheet.swift:136,139`
- [x] Devise en `Text` unique `🇨🇭 CHF` — `CurrencySettingView.swift:96`, `IncomeStep.swift:38`, `OnboardingStepView.swift:386`, `CurrencyAmountPicker.swift:13`
- [x] Code mort retiré : `CapsulePicker.swift` supprimé, exclusion swiftlint absente de `ios/.swiftlint.yml:81-88`, token `segmentedThumb` absent
- [x] `ios/DESIGN.md` § Segmented Choice écrit pour le rendu natif — `ios/DESIGN.md:356-372`
- [x] A11y : chaque segment garde son propre nom — `.accessibilityElement(children: .contain)` rétabli avant les labels de conteneur sur les 4 wrappers (45582e8f2)
- [x] Gates verts : `swiftlint --strict` 0 violation, `UncheckedOperationsCard.swift` tenu à 500 lignes pile sous `file_length: warning: 500`
- [x] Vérif visuelle simulateur — re-jouée au pilotage noqa (voir Verification)

### Phase 2 — Contraste des cartes réglages

- [x] Cause : `surfaceContainerHigh` (`#F0EDE9`) sur `appBackground` (`#EFF3EE`) ≈ 1.04:1 — `ios/DESIGN.md:346`
- [x] Fix : famille réglages sur `surfaceContainerLowest` via le modificateur partagé `listRowSettingsBackground()` — `View+Extensions.swift:288`, 11 sites dans 5 écrans
- [x] Zone danger, avatar et footer version gardent leurs fonds — non touchés

### Phase 3 — Contraste des helpers TipKit

- [x] Modifier partagé `pulpeTipBackground()` à côté de `suppressesTips()` — `ProductTips.swift:190-193`
- [x] Appliqué aux 3 `TipView` inline — `BudgetSection.swift:80`, `BudgetDetailsView.swift:238`, `TemplateListView.swift:76`

### Phase 4 — Détachement du hero home

- [x] `Shadow.zoneBoundary` resserré (blur 10→6, y 4/6→3) — `DesignTokens.swift:117-121`; un seul consommateur (`CurrentMonthView.swift:361`)
- [x] `homeZoneBoundaryShadow` opacité `badgeBackground` (0.12) → `glow` (0.25), light seulement — `Color+Pulpe.swift:415`
- [x] Nouveau token `CornerRadius.zone` (44pt) — `DesignTokens.swift:31`, `CurrentMonthView.swift:354-356`

### Phase 5 — Deck des « Opérations à pointer »

- [x] Pane unique → deck horizontal paginé — `UncheckedOperationsCard.swift:155-232`
- [x] Motion : `scrollTransition(.interactive)`, ancrages sur le bord intérieur, tokens `DesignTokens.Deck`
- [x] Sémantique conservée : le deck atterrit sur le successeur et la dernière carte reste pointable — `settleScrolledId()` réconcilie `scrolledId` contre les slots rendus (`UncheckedOperationsCard.swift:441`, `DeckCycle.reconciledScrolledId`), `handleScrollGeometry` suit le focus même à une carte. **Vérifié sur simulateur avant/après** (voir Verification)
- [x] « Plus tard » n'est plus un contrôle mort : désactivé quand il ne reste qu'une carte — `UncheckedOperationsCard.swift:396,399`
- [x] Garde anti-tap : `allowsHitTesting` sur la seule carte focus, copies wrap masquées de VoiceOver
- [x] Cible iOS 18 ⇒ APIs scroll toutes disponibles, aucun `#available` requis
- [x] Layer : `zIndex` explicite sur la carte focus et la carte en exit
- [x] Clôture animée : `displayItems` miroir local, retrait + glissement dans UNE transaction `withAnimation`
- [x] Boucle infinie : 3 cycles identiques, recentrage d'un cycle en plein vol, garde `isTurning` levée à `.idle`

## Findings

None. Les 9 findings du tour précédent (1 🔴, 5 🟡, 3 🟢) sont corrigés dans
`da52f5066`, `45582e8f2` et `231faa8a4`; le détail par finding est dans `plan.md`.

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (25/25)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Files checked | UncheckedOperationsCard.swift, UncheckedOperationsCard+Cycle.swift, UncheckedOperationsCard+DeckSlot.swift, UncheckedOperationsCardDeckTests.swift, CurrentMonthView.swift, BudgetSection.swift, ActivityCard.swift, SegmentedPicker.swift, KindToggle.swift, CurrencyAmountPicker.swift, SpreadModeToggle.swift, SpreadAmountModeToggle.swift, AddBudgetLineSheet.swift, BudgetDetailsView.swift, View+Extensions.swift, AccountView.swift, PreferencesView.swift, CurrencySettingView.swift, SecuritySettingsView.swift, TagsSettingsView.swift, OnboardingStepView.swift, IncomeStep.swift, OnboardingSuggestionGrid.swift, SavingsGoalFormSheet.swift, TemplateListView.swift, ProductTips.swift, DesignTokens.swift, DesignTokens+Deck.swift, Color+Pulpe.swift, ios/DESIGN.md, aidd_docs/memory/mobile.md |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Unplanned     | Passe de formatage Markdown sur `ios/DESIGN.md` — légitime, la version de `preview` échouait `prettier --check` que `pnpm quality` bloque ; `#Preview` ajouté à `KindToggle` ; mémoire projet `aidd_docs/memory/mobile.md` § UI controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Gates         | Suite complète `xcodebuild test -scheme PulpeLocal` : **2104 tests / 219 suites passés**. `swiftlint --strict` 0 violation. `prettier --check` OK.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Device (noqa) | Simulateur iPhone 17 Pro Max, compte demo, budget d'août ramené à 2 opérations à pointer. **Avant (`e57579af2`)** : pointer « Shopping » fait tomber le deck à 1 carte, puis 3 taps sur « C'est passé » de « Épargne vacances » ne font rien — compteur figé à « 1, à pointer », et « Plus tard » reste actif alors qu'il n'a nulle part où tourner. **Après (`231faa8a4`)** : même séquence, la carte survivante prend le slot focus, « Plus tard » passe `enabled="false"`, et « C'est passé » la pointe — compteur « 0, à pointer », section retirée. Seed remis à son état initial (16 lignes non pointées).                                                                                                                                                                                                |
