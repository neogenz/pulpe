# Review: ios-segmented-capsule-picker

- **Verdict**: approve
- **Diff**: `preview...feat/ios-segmented-capsule-picker` (settings-contrast fix included)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

<!-- No plan.md: acceptance criteria are the session brief approved interactively (direction retenue par Maxime sur visuels comparés : "pickers natifs", devise en segments texte). -->

### Phase 1 — Tous les sélecteurs 1-parmi-N sur le segmented control natif

- [x] Atome partagé unique : `SegmentedPicker` = wrapper fin sur `Picker(.segmented)` (titre optionnel + `.sensoryFeedback(.selection)`) — `ios/Pulpe/Shared/Components/SegmentedPicker.swift`
- [x] Les 3 toggles restent des wrappers fins, plomberie `accentColor` retirée (concession assumée : pas d'encre contextuelle sur le natif) — `KindToggle.swift`, `SpreadModeToggle.swift`, `SpreadAmountModeToggle.swift`, call sites `AddBudgetLineSheet.swift:136,139`
- [x] Devise corrigée : labels riches (drapeau + code + nom natif) → `Text` unique `🇨🇭 CHF` / `🇪🇺 EUR`; `UISegmentedControl` éclatait les vues composées en segments surnuméraires — `CurrencySettingView.swift`, `IncomeStep.swift`, `OnboardingStepView.swift`, `CurrencyAmountPicker.swift`
- [x] Code mort retiré : token `Color.segmentedThumb`, exclusion swiftlint `no_adhoc_capsule_chip` de l'atome, thumb/track custom (`matchedGeometryEffect`) — net −73 LOC
- [x] DESIGN.md § Segmented Choice réécrit pour le rendu natif (labels Text-only, concession encre documentée)
- [x] A11y : l'arbre expose désormais de vrais `SegmentedControl` nommés (« Nature », « Mode de création »); labels/valeurs des wrappers conservés
- [x] Gates verts : build EXIT 0, SwiftLint strict 0 sur les fichiers touchés, 2091 tests / 218 suites passés
- [x] Vérif visuelle sur simulateur : Devise (2 segments) et pile Nature / Lisser / Total (light) capturées et validées

### Phase 2 — Contraste des cartes réglages (demande Maxime en cours de branche)

- [x] Cause : `.listRowBackground(Color.surfaceContainerHigh)` (`#F0EDE9`) sur le canvas `appBackground` (`#EFF3EE`) ≈ 1.04:1 — violation de la règle DESIGN.md:346 (« never on the bare appBackground »)
- [x] Fix : famille réglages entière sur `Color.surfaceContainerLowest` (blanc / brun chaud `#1E1C1A`), même token que les cartes de lignes — `PreferencesView` ×3, `CurrencySettingView`, `TagsSettingsView` (remplacements) + `AccountView` ×4 et `SecuritySettingsView` ×2 (épinglés, remplaçant le blanc natif `secondarySystemGroupedBackground` pour une seule mécanique light+dark); la zone danger garde `destructiveBackground`, avatar et footer version gardent `.clear`
- [x] Les éléments blancs (thumb du segment natif, toggles) restent lisibles sur carte blanche : leur contraste vient de leurs tracks systemFill, pas de la carte — vérifié sur captures light + dark
- [x] Gates verts : build EXIT 0, SwiftLint strict 0 sur fichiers touchés, 2091 tests / 218 suites passés; captures light + dark validées sur simulateur

### Phase 3 — Contraste des helpers TipKit (demande Maxime en cours de branche)

- [x] Cause : les 3 `TipView` inline (accueil `BudgetSection`, détail budget `pessimisticCheck`, Modèles `webParityTip`) ridaient le fond gris par défaut de TipKit, quasi invisible sur `appBackground`
- [x] Fix : modifier partagé `pulpeTipBackground()` (dans `ProductTips.swift`, à côté de `suppressesTips()`) = `tipBackground(Color.surfaceContainerLowest)`, appliqué aux 3 sites; les `.popoverTip` gardent leur bulle système
- [x] Gates verts : build EXIT 0, SwiftLint strict 0, 2091 tests / 218 suites; captures Modèles light + dark validées sur simulateur

### Phase 4 — Détachement du hero home (demande Maxime, itéré à deux, validé « très bien comme ça »)

- [x] Ombre de zone resserrée et densifiée : `Shadow.zoneBoundary` blur 10→6, y 4/6→3; `homeZoneBoundaryShadow` opacité 0.12→0.25 (`Opacity.glow`), light seulement (dark inchangé, porté par le ton)
- [x] Arrondis bas plus fuyants : nouveau token `CornerRadius.zone` (44pt) sur la courbe du surface mint (`CurrentMonthView.dashboardBackground`), remplaçant `lg` (30pt)
- [x] Gates verts : build EXIT 0, SwiftLint strict 0 (DesignTokens ramené sous le mur des 500 lignes), 2091 tests / 218 suites; avant/après validé par Maxime sur simulateur

### Phase 5 — Deck des « Opérations à pointer » (demande Maxime : peek + motion « pas cheap »)

- [x] Le pane unique devient un deck horizontal paginé : `ScrollView(.horizontal)` + `scrollTargetLayout` + `.viewAligned` + `containerRelativeFrame`, carte focus sur le rail (`Spacing.xxl` annulé puis réappliqué en `contentMargins`), voisines en billets aux bords — `UncheckedOperationsCard.swift`
- [x] Motion : `scrollTransition(.interactive)` — voisines réduites (ancrage bord intérieur pour préserver le peek), tournées en perspective (`rotation3DEffect` 8°), estompées; tokens `DesignTokens.Deck` (nouveau `DesignTokens+Deck.swift`, le fichier principal est au mur des 500 lignes); Reduce Motion coupe la rotation
- [x] Sémantique conservée : « C'est passé » garde le 2-beats (Pointé → résolution vers le haut) et le deck atterrit sur le successeur; « Plus tard » devient une rotation du deck (wrap en bout de course) — `skippedIds` supprimé, la position du deck EST l'état
- [x] Garde anti-tap : `allowsHitTesting` sur la seule carte focus — le sliver visible expose le bord du « C'est passé » voisin; VoiceOver garde l'accès à toutes les cartes
- [x] Cible iOS 18 ⇒ APIs scroll toutes iOS 17+, aucun fallback ancien OS nécessaire
- [x] Vérifié sur simulateur light + dark : peek 1er/2e/3e élément, skip, pointage réel (17→16, successeur au slot focus) puis état seed restauré (dépointage)
- [x] Layer (retour Maxime) : le billet trailing recouvrait la carte focus — un HStack peint les frères suivants au-dessus; `zIndex` explicite sur la carte focus (et la carte en exit) + pivot de la rotation 3D sur le bord intérieur pour que la projection déborde vers l'écran
- [x] Clôture animée (retour Maxime) : le deck rend depuis `displayItems`, miroir local du store — le retrait de la carte confirmée et le glissement du successeur partagent UNE transaction `withAnimation` (retirée directement de `items`, la cible de scroll disparue était résolue instantanément et l'exit coupé); `confirmingId` survit jusqu'au `completion` pour garder la carte sortante au premier plan
- [x] Boucle (retour Maxime) : le successeur d'un pointage passe en modulo (`rest[idx % rest.count]`) — clôturer la dernière carte ramène à la première, même cycle que « Plus tard »; le swipe pur reste borné (rebond standard en bout de deck, pas de scroll infini par sentinelles)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | `ios/Pulpe/Shared/Components/CurrencyAmountPicker.swift` | La capsule read-only garde le look pill hérité pendant que la variante interactive passe au natif | Aligner l'affichage read-only dans une passe ultérieure |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (8/8) |
| Files checked | SegmentedPicker.swift, KindToggle.swift, SpreadModeToggle.swift, SpreadAmountModeToggle.swift, AddBudgetLineSheet.swift, Color+Pulpe.swift, CurrencySettingView.swift, IncomeStep.swift, OnboardingStepView.swift, CurrencyAmountPicker.swift, SavingsGoalFormSheet.swift, DESIGN.md, .swiftlint.yml |
| Unchecked     | none |
| Unplanned     | Renommage `CapsulePicker` → `SegmentedPicker` (le nom décrivait un mécanisme disparu); commentaires mis à jour dans `ActivityCard.swift` et `OnboardingSuggestionGrid.swift` |
