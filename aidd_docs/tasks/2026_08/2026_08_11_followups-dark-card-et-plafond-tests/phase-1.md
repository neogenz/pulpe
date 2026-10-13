---
status: done
---

# Instruction: rendre la portance de la carte de ligne bimodale

En clair, la carte de ligne ne se détache pas par son fond (blanc sur `#EFF3EE` = **1,12:1**)
mais par son ombre — `Shadow.subtle`, noir à 5 %. En dark cette ombre est du noir sur
`#121611` : elle ne rend rien, et le fond ne vaut que **1,08:1**. La carte disparaît.

Le correctif ne touche donc pas au remplissage : il donne à la portance un substitut en dark,
symétriquement à `Color.homeZoneBoundaryShadow`, qui fait déjà `light: noir 12 % / dark: .clear`
parce que là-bas c'est le saut tonal qui prend le relais. Ici le saut tonal ne prend rien.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/Pulpe/
    ├── Shared/
    │   └── Extensions/
    │       ├── Color+Pulpe.swift            ✏️  token bimodal `rowCardBorder`
    │       └── View+Extensions.swift        ✏️  `pulpeRowCard()` pose le contour
    └── Features/Budgets/BudgetDetails/
        ├── BudgetLineMixedRow.swift         ✏️  passe sur `pulpeRowCard()`
        ├── BudgetDetailsFreeTransactionsList.swift ✏️  idem
        └── BudgetDetailsSkeletonView.swift  ✏️  idem
```

## Tasks to do

### `1)` Token de contour bimodal

> Un seul endroit décide si la carte porte un contour, et dans quel mode.

1. Dans `Color+Pulpe.swift`, à côté de `homeZoneBoundaryShadow`, ajouter
   `rowCardBorder = Color(light: .clear, dark: .outlineVariant)`.
2. Commenter le *pourquoi* (l'ombre porte en clair, meurt en dark), pas le *quoi*.

### `2)` Le modifier partagé pose le contour

> `pulpeRowCard()` redevient une frontière entière dans les deux modes.

1. Dans `View+Extensions.swift`, ajouter au `pulpeRowCard()` un
   `.overlay { RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card, style: .continuous).strokeBorder(Color.rowCardBorder, lineWidth: DesignTokens.BorderWidth.hairline) }`.
2. Garder `.shadow(DesignTokens.Shadow.subtle)` : c'est lui qui porte en clair.
3. Utiliser `strokeBorder` et non `stroke` — il rentre vers l'intérieur, donc le `clipShape`
   du `CardBackgroundModifier` ne le rogne pas de moitié.
4. Ne pas toucher `pulpeCardBackground()` : ses consommateurs (sheets, graphiques) ne sont pas
   des cartes de ligne et n'ont rien demandé.

### `3)` Brancher BudgetDetails sur le modifier partagé

> Supprimer la seconde implémentation de la carte plutôt que la corriger en double.

1. **Avant de substituer**, relever pour chacun des 3 sites le rayon, les paddings et l'ombre
   réellement appliqués, et les comparer à ce que `pulpeRowCard()` produit. Toute divergence
   est un changement visuel à signaler, pas à absorber en silence.
2. Remplacer le couple `.background(Color.surfaceContainerLowest)` + `.shadow(DesignTokens.Shadow.subtle)`
   par `.pulpeRowCard()` dans `BudgetLineMixedRow.swift`, `BudgetDetailsFreeTransactionsList.swift`
   et `BudgetDetailsSkeletonView.swift`.
3. Si un site diverge par son rayon, s'arrêter et le remonter au lieu de forcer la fusion.

### `4)` Vérification

> Le mode clair ne doit pas bouger d'un pixel, et le dark ne se vérifie qu'au calcul.

1. `xcodebuild build -scheme PulpeLocal -configuration Local -destination 'platform=iOS Simulator,name=Pulpe Tests' CODE_SIGNING_ALLOWED=NO`, lire `** BUILD SUCCEEDED **`.
2. `swiftlint lint --strict`, filtrer la sortie sur les 5 fichiers touchés.
3. Le simulateur MCP est hors service : **aucune capture n'est possible**. Ne pas inventer
   d'étape de capture, ne pas prétendre avoir vu le rendu. En clair, l'argument de
   non-régression est que `rowCardBorder` vaut `.clear` — le contour n'existe pas.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `Color.rowCardBorder` existe, vaut `.clear` en clair et `outlineVariant` en dark, et aucune valeur hexadécimale nouvelle n'a été introduite.               |
| 2    | Une carte de ligne rendue en dark montre un contour continu sur tout son pourtour, non rogné aux angles ; la même carte en clair est inchangée.            |
| 3    | Plus aucun fichier de `Features/Budgets/BudgetDetails/` ne contient `.background(Color.surfaceContainerLowest)` accolé à `.shadow(DesignTokens.Shadow.subtle)`. |
| 4    | Le build passe et `swiftlint --strict` ne signale rien sur les fichiers touchés.                                                                            |
