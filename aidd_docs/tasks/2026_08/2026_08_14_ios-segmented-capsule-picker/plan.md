# Plan: correctifs de revue — segmented picker & deck

Source: `review.md` (même dossier). Périmètre strictement limité aux lignes de son tableau
`Findings`. Aucune autre modification.

## Phase 1 — Le deck reste utilisable jusqu'à la dernière carte (🔴 + 🟡)

Cible: `ios/Pulpe/Features/CurrentMonth/Components/UncheckedOperationsCard.swift`

- [ ] `scrolledId` ne survit plus à la disparition du slot qu'il désigne : après chaque mise
      à jour de `displayItems`, si l'id courant ne correspond à aucun slot rendu, le
      ramener sur `displayItems.first?.id`. Le cas 2 → 1 carte laisse aujourd'hui
      `focusedId` sur l'opération pointée, et `.allowsHitTesting(slot.isReal && slot.id == focusedId)`
      tue les deux boutons de la dernière opération.
- [ ] La moitié « focus » de `handleScrollGeometry` ne dépend plus de la garde `cards > 1` :
      seul le recentrage de cycle a besoin de plusieurs cartes.
- [ ] « Plus tard » ne peut plus être un contrôle mort : avec une seule carte, `advance`
      sort en silence après avoir joué le haptique. Désactiver ou masquer `skipButton`
      quand `displayItems.count <= 1`.
- [ ] Le seed de position est écrit une seule fois (`seedPositionIfNeeded()`), appelé depuis
      `.onChange` et `.onAppear`.
- [ ] `handleScrollGeometry` documente l'hypothèse de `slotSpan` (marges `contentMargins`
      exclues de `contentSize.width`) et le plafond de 5 cartes qui la rend inoffensive.

### Acceptation

- Partant de 2 opérations à pointer, en pointer une laisse la dernière carte pleinement
  tappable (« C'est passé » et « Plus tard » répondent).
- Avec une seule opération, « Plus tard » n'est pas proposé comme actif.
- Boucle, rotation, exit animée et garde anti-spam inchangés à 2 cartes et plus.

## Phase 2 — A11y et duplication (🟡)

- [ ] Les trois wrappers (`KindToggle`, `SpreadModeToggle`, `SpreadAmountModeToggle`) et
      `CurrencyAmountPicker` ne laissent plus un `.accessibilityLabel` / `.accessibilityValue`
      nu se propager sur les segments : restaurer `.accessibilityElement(children: .contain)`
      avant le label, ou porter le label dans le `Picker` de `SegmentedPicker`.
- [ ] `SegmentedPicker` n'annonce plus son titre deux fois : le `Text` visible ou le label du
      `Picker`, pas les deux.
- [ ] `.listRowBackground(Color.surfaceContainerLowest)`, littéral sur 11 sites dans 5 écrans
      de réglages, passe par un modificateur partagé unique.

### Acceptation

- Chaque segment garde son propre titre pour VoiceOver (« Dépense » / « Revenu » / « Épargne »,
  « Une seule fois » / « Lisser », « Total » / « Par mois »).
- Aucun `.listRowBackground(Color.surfaceContainerLowest)` littéral ne subsiste.
- Rendu visuel des réglages identique.

## Phase 3 — Couverture et documentation (🟡)

- [ ] Les parties pures du deck sont testables et testées : identité des slots
      (`DeckSlot.wrapId` / `realId`), choix du successeur au pointage, résolution du slot
      focus depuis un index. Extraire ce qui doit l'être, sans déplacer la logique de vue.
- [ ] La suite couvre explicitement le cas 2 → 1 carte du 🔴.
- [ ] `ios/DESIGN.md` documente le deck à côté de « Segmented Choice » : rôle, tokens
      `DesignTokens.Deck`, règle de peek, comportement sous Reduce Motion.

### Acceptation

- Les nouveaux tests échouent sur le code d'avant Phase 1 et passent après.
- `ios/DESIGN.md` reste conforme à `prettier --check`.

## Gates

- `xcodegen generate --use-cache` si le projet doit être régénéré.
- Build: `xcodebuild build -scheme PulpeLocal -configuration Local -destination 'platform=iOS Simulator,name=Pulpe Tests' CODE_SIGNING_ALLOWED=NO`.
- Tests: même destination, scheme `PulpeLocal`. Lire le nombre de tests exécutés, pas le
  seul `TEST SUCCEEDED`.
- `swiftlint --strict` sur les fichiers touchés. `UncheckedOperationsCard.swift` est à 500
  lignes, le mur de `file_length` : tout ajout net sort dans un fichier compagnon.
- `pnpm exec prettier --check` sur les Markdown touchés.
