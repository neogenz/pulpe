# Design Audit — Ecran d'ajout de transaction (iOS)

**Date:** 27 fevrier 2026
**Cible:** `AddTransactionSheet` — `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Contexte:** Sheet modale presentee depuis le dashboard pour ajouter une transaction (depense, revenu, epargne)

---

## Overall Assessment

L'ecran est fonctionnel et suit les grandes lignes de la DA Pulpe (palette verte, typographie Manrope/DM Sans, coins arrondis). La structure "hero amount" est bien pensee pour une app fintech. Cependant, **la hierarchie visuelle entre champs obligatoires et optionnels est absente**, le feedback de validation est inexistant, et plusieurs details d'interaction ne respectent pas les conventions iOS HIG ni les piliers emotionnels de Pulpe (Clarte, Controle).

---

## Phase 1 — Critical

Issues qui nuisent directement a l'experience utilisateur.

### 1.1 Le champ Description ne communique pas qu'il est obligatoire

**Composant:** `descriptionField` (ligne 147-153)
**Probleme:** Le champ "Description" utilise un simple placeholder sans label, sans indicateur "requis", et avec un fond si subtil (`Color.inputBackgroundSoft` = `#E8F5E9` a 60% opacite) qu'il semble optionnel. Or, `canSubmit` exige un `name` non vide — le bouton reste desactive sans explication.
**Impact:** L'utilisateur peut entrer un montant, ne pas comprendre pourquoi "Ajouter" reste gris, et ressentir de la frustration. Viole le pilier **Clarte** ("comprendre en 3 secondes") et **Controle** ("je sais quoi faire").
**Correction:** Ajouter un label flottant ou un header de section "Description" au-dessus du champ, avec un indicateur visuel de champ requis.

```swift
// Avant
private var descriptionField: some View {
    TextField("Description", text: $name)
        .font(PulpeTypography.bodyLarge)
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
}

// Apres
private var descriptionField: some View {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
        Text("Description")
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.textSecondary)
        TextField("Ex : Courses, Restaurant...", text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }
}
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 1.2 Aucun feedback de validation — le bouton desactive sans explication

**Composant:** `addButton` (ligne 180-188) + `canSubmit` (ligne 24-28)
**Probleme:** Quand le bouton est desactive, l'utilisateur n'a aucune indication de ce qui manque. Le bouton passe de gris a vert/gradient sans transition explicative. Sur iOS, un bouton desactive sans contexte viole le principe de **Controle** — "je decide, l'app suit".
**Impact:** L'utilisateur appuie sur "Ajouter" desactive, rien ne se passe, pas de vibration d'erreur, pas de message. Frustration silencieuse.
**Correction:** Ajouter un micro-feedback contextuel. Deux options :
- **Option A (recommandee)** : Permettre le tap sur le bouton desactive et afficher un shake + message inline ("Ajoute un montant et une description")
- **Option B** : Afficher un texte discret sous le bouton quand il est desactive ("Montant et description requis")

```swift
// Option B — simple, pas de changement de logique
private var addButton: some View {
    VStack(spacing: DesignTokens.Spacing.sm) {
        Button {
            Task { await addTransaction() }
        } label: {
            Text("Ajouter")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)

        if !canSubmit && ((amount ?? 0) > 0 || !name.isEmpty) {
            Text(validationHint)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
                .transition(.opacity.combined(with: .move(edge: .top)))
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: canSubmit)
        }
    }
}

private var validationHint: String {
    if (amount ?? 0) <= 0 { return "Ajoute un montant" }
    if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
    return ""
}
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 1.3 Placeholder "Description" generique — viole le tone of voice Pulpe

**Composant:** `descriptionField` (ligne 148)
**Probleme:** Le placeholder "Description" est generique et froid. La DA Pulpe exige un ton "bienveillant, simple, humain" avec tutoiement. Un placeholder comme "Description" est du jargon technique.
**Correction:** Utiliser un placeholder contextuel et chaleureux.

```swift
// Avant
TextField("Description", text: $name)

// Apres — placeholder contextuel selon le kind
TextField(kind.descriptionPlaceholder, text: $name)
```

Ajouter sur `TransactionKind` :

```swift
extension TransactionKind {
    var descriptionPlaceholder: String {
        switch self {
        case .expense: "Ex : Courses, Restaurant..."
        case .income: "Ex : Salaire, Remboursement..."
        case .saving: "Ex : Vacances, Fonds d'urgence..."
        }
    }
}
```

**Fichier:** `AddTransactionSheet.swift` + modele `TransactionKind`
**Layer:** Feature + Domain

---

## Phase 2 — Refinement

Ajustements qui elevent l'experience sans corriger de bug critique.

### 2.1 Le segmented control ne reflete pas les couleurs financieres semantiques

**Composant:** `KindToggle` (`ios/Pulpe/Shared/Components/KindToggle.swift`)
**Probleme:** Le toggle utilise la couleur verte systeme pour tous les segments. Or la DA definit des couleurs semantiques distinctes : revenu = vert/primary, depense = ambre (`--pulpe-financial-expense`), epargne = bleu (`--pulpe-financial-savings`). Cette absence de distinction reduit la lisibilite immediate du mode selectionne.
**Correction:** Remplacer le `Picker(.segmented)` natif par un toggle custom qui utilise les couleurs financieres de chaque kind. Cela renforce le pilier **Clarte** — l'utilisateur sait quel type il ajoute en un coup d'oeil grace a la couleur.

```
Revenu → Color.financialIncome (vert/bleu)
Depense → Color.financialExpense (ambre/orange)
Epargne → Color.financialSavings (vert)
```

**Fichier:** `ios/Pulpe/Shared/Components/KindToggle.swift`
**Layer:** Shared/Components

---

### 2.2 Sous-titre dynamique sous le hero amount pour contextualiser

**Composant:** `heroAmountSection` (ligne 77-113)
**Probleme:** L'amount hero est isole — l'utilisateur voit "CHF / 0.00" mais n'a aucun contexte sur ce qu'il est en train de faire. Le titre du sheet change ("Nouvelle depense") mais il est loin du champ de saisie et hors du regard quand le clavier est ouvert.
**Correction:** Ajouter un sous-titre discret sous le montant qui contextualise l'action : ex. "Nouvelle depense" ou "Combien ?" quand le montant est 0.

```swift
// Sous l'underline dans heroAmountSection
if (amount ?? 0) <= 0 {
    Text("Quel montant ?")
        .font(PulpeTypography.caption)
        .foregroundStyle(Color.textTertiary)
        .padding(.top, DesignTokens.Spacing.xs)
}
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 2.3 Quick amounts sans feedback haptique

**Composant:** `quickAmountChips` (ligne 117-143)
**Probleme:** Quand l'utilisateur tape un quick amount, il n'y a pas de retour haptique. Le bouton "Ajouter" a un `.sensoryFeedback(.success)`, mais les chips n'ont rien. Sur iOS, les interactions tactiles sans retour haptique semblent "mortes".
**Correction:** Ajouter un feedback haptique leger sur les quick amounts.

```swift
// Ajouter un trigger
@State private var quickAmountTrigger = false

// Sur le bouton du chip :
.sensoryFeedback(.selection, trigger: quickAmountTrigger)

// Dans l'action du bouton :
quickAmountTrigger.toggle()
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 2.4 Zone de tap du hero amount trop petite

**Composant:** `heroAmountSection` (ligne 83-103)
**Probleme:** Le `.onTapGesture` est place sur le `ZStack` qui contient le texte "0.00", mais la zone tappable est limitee au texte lui-meme. L'utilisateur devrait pouvoir taper n'importe ou dans la section hero (incluant "CHF" et l'underline) pour activer le clavier.
**Correction:** Deplacer le `.onTapGesture` et `.accessibilityAddTraits` sur le `VStack` parent de la section hero entiere, et ajouter `.contentShape(Rectangle())` pour etendre la zone de hit.

```swift
// Avant — onTapGesture sur le ZStack interne
ZStack { ... }
    .accessibilityAddTraits(.isButton)
    .accessibilityLabel("Montant")
    .onTapGesture { isAmountFocused = true }

// Apres — onTapGesture sur le VStack parent
VStack(spacing: DesignTokens.Spacing.sm) {
    Text(DesignTokens.AmountInput.currencyCode)
        ...
    ZStack { ... }  // sans onTapGesture ici
    RoundedRectangle(...)
        ...
}
.contentShape(Rectangle())
.accessibilityAddTraits(.isButton)
.accessibilityLabel("Montant")
.onTapGesture { isAmountFocused = true }
.frame(maxWidth: .infinity)
.padding(.vertical, DesignTokens.Spacing.lg)
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 2.5 Le label "Date" est redondant avec l'icone calendrier

**Composant:** `dateSelector` (ligne 157-176)
**Probleme:** Le champ date affiche `calendar icon + "Date" + "27 fevr. 2026"`. Le mot "Date" est redondant avec l'icone calendrier — c'est dire la meme chose deux fois. La DA preconise la densite: "chaque element doit meriter sa place".
**Correction:** Conserver l'icone et le DatePicker uniquement, en s'assurant que le VoiceOver label mentionne "Date de la transaction".

```swift
// Avant
Label("Date", systemImage: "calendar")

// Apres
Image(systemName: "calendar")
    .foregroundStyle(Color.textTertiary)
    .accessibilityHidden(true) // Le DatePicker porte deja le label
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

## Phase 3 — Polish

Details qui transforment "fonctionnel" en "premium".

### 3.1 Animation d'entree des elements

**Probleme:** Les elements du formulaire apparaissent tous en meme temps. Un stagger subtil (apparition sequentielle de haut en bas) donnerait une sensation de fluidite et de soin.
**Correction:** Ajouter un delai progressif d'apparition sur chaque section avec `.transition(.opacity.combined(with: .move(edge: .bottom)))`.

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 3.2 Micro-animation sur selection d'un quick amount

**Probleme:** Quand un quick amount est selectionne, le montant hero change via `.contentTransition(.numericText())` — bon. Mais le chip selectionne lui-meme ne change pas d'etat visuellement. L'utilisateur ne sait pas quel chip est "actif".
**Correction:** Mettre en surbrillance le chip dont la valeur correspond au montant actuel (border plus opaque, fond plus dense).

```swift
// Dans le label du chip
.background(
    isSelected
        ? Color.pulpePrimary.opacity(0.20)
        : Color.pulpePrimary.opacity(0.08)
)
.overlay(
    Capsule().strokeBorder(
        isSelected
            ? Color.pulpePrimary.opacity(0.40)
            : Color.pulpePrimary.opacity(0.20),
        lineWidth: 1
    )
)
```

Ou `isSelected = (amount == Decimal(quickAmount))`

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 3.3 Accessibilite — hints manquants sur les quick amounts

**Probleme:** Les boutons quick amount n'ont pas d'`accessibilityHint`. Un utilisateur VoiceOver entend "10 CHF, bouton" mais ne sait pas que taper definira le montant.
**Correction:**

```swift
.accessibilityHint("Definir le montant a \(quickAmount) CHF")
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

### 3.4 Accessibilite — le champ Description n'a pas d'accessibilityLabel explicite

**Probleme:** Le TextField utilise "Description" comme placeholder qui sert aussi d'accessibilityLabel implicite. Si on change le placeholder (Phase 1.3), le label VoiceOver deviendra "Ex : Courses, Restaurant..." ce qui est confus.
**Correction:**

```swift
TextField(kind.descriptionPlaceholder, text: $name)
    .accessibilityLabel("Description de la transaction")
```

**Fichier:** `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
**Layer:** Feature

---

## Token Updates Required

Aucune modification de token necessaire. Toutes les corrections utilisent des tokens existants :

| Token | Valeur | Usage dans cet audit |
|-------|--------|---------------------|
| `PulpeTypography.labelMedium` | DM Sans 12pt | Label "Description" (Phase 1.1) |
| `PulpeTypography.caption` | DM Sans 11pt | Validation hint (Phase 1.2), hint hero (Phase 2.2) |
| `Color.textSecondary` | Existant | Label "Description" |
| `Color.textTertiary` | Existant | Hints, placeholders |
| `Color.financialIncome/Expense/Savings` | Existant | KindToggle semantique (Phase 2.1) |
| `DesignTokens.Spacing.xs` (4pt) | Existant | Micro-spacings |

**Potentiel nouveau token :**
- Si Phase 2.1 (KindToggle custom) est approuvee, un nouveau composant `FinancialKindToggle` pourrait etre cree dans `Shared/Components/` pour remplacer le `Picker(.segmented)` natif. Ce composant devra etre propose et valide separement.

---

## Implementation Notes

| Phase | Fichier | Composant | Modification |
|-------|---------|-----------|-------------|
| 1.1 | `AddTransactionSheet.swift:147-153` | `descriptionField` | Wrapper VStack + label "Description" au-dessus du TextField |
| 1.2 | `AddTransactionSheet.swift:180-188` | `addButton` | Wrapper VStack + texte conditionnel de validation |
| 1.3 | `AddTransactionSheet.swift:148` + `TransactionKind` | `descriptionField` | Placeholder dynamique par kind |
| 2.1 | `KindToggle.swift` | Entier | Remplacer Picker segmented par toggle custom avec couleurs financieres |
| 2.2 | `AddTransactionSheet.swift:77-113` | `heroAmountSection` | Ajout sous-titre contextuel |
| 2.3 | `AddTransactionSheet.swift:117-143` | `quickAmountChips` | `@State` trigger + `.sensoryFeedback(.selection)` |
| 2.4 | `AddTransactionSheet.swift:83-110` | `heroAmountSection` | Deplacer onTapGesture + contentShape sur VStack parent |
| 2.5 | `AddTransactionSheet.swift:159` | `dateSelector` | Remplacer `Label("Date", ...)` par `Image(systemName:)` |
| 3.1 | `AddTransactionSheet.swift:37-73` | `body` | Stagger animation progressive |
| 3.2 | `AddTransactionSheet.swift:117-143` | `quickAmountChips` | Etat visuel "selected" sur le chip actif |
| 3.3 | `AddTransactionSheet.swift:117-143` | `quickAmountChips` | `.accessibilityHint()` sur chaque chip |
| 3.4 | `AddTransactionSheet.swift:148` | `descriptionField` | `.accessibilityLabel("Description de la transaction")` |

---

## Checklist DA Rapide

- [x] **Soulagement** : L'ecran ne stresse pas, mais le manque de feedback (1.2) cree une micro-frustration
- [ ] **Clarte** : Le champ description ne communique pas qu'il est requis (1.1)
- [ ] **Controle** : Pas de feedback quand le bouton est desactive (1.2)
- [x] **Legerete** : Les couleurs sont douces, les coins arrondis, l'animation hero est fluide
- [x] **Tutoiement** : Pas de texte utilisateur tutoyant visible (placeholder generique) — a corriger (1.3)
- [x] **Vocabulaire** : "Depense", "Revenu", "Epargne" — correct
- [x] **Visuel** : Palette verte respectee, pas de rouge agressif

---

*Chaque phase necessite une approbation explicite avant implementation.*
