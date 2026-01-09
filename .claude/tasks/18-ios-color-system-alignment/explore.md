# Task: Aligner le système de couleurs iOS avec le frontend Angular

## Question utilisateur
Peut-on utiliser les mêmes couleurs du frontend Angular (notamment `--mat-sys-surface: light-dark(#f6fbf1, #10150f)`) pour les backgrounds de l'app iOS ?

## Codebase Context - Frontend Angular

### Palette de couleurs (Material Design 3)
```scss
// _theme-colors.scss - GÉNÉRÉ par Angular Material CLI
Primary: #006E25 (vert forêt)
Surface light: #f6fbf1 (crème vert très clair)
Surface dark: #10150f (vert forêt très foncé)

// Gradient Pulpe
Light: #0088ff → #00ddaa → #00ff55 → #88ff44
Dark: #1a1a1a → #1e2820 → #00531a → #2b883b
```

### Couleurs financières
```scss
Income: #0061a6 (bleu)
Expense: #c26c00 (orange)
Savings: #27ae60 (vert)
```

### Fichiers clés
- `frontend/.../themes/_theme-colors.scss:77-78` - Définitions #f6fbf1 et #10150f
- `frontend/.../styles.scss:46` - `background: var(--mat-sys-surface)`

## Codebase Context - iOS actuel

### Gestion actuelle des couleurs
- **Pas de système centralisé** - couleurs inline
- **AccentColor** seul asset défini (turquoise ~0x6EC958)
- **UIKit semantic backgrounds** pour les pages :
  - `Color(.systemGroupedBackground)` - gris/blanc système
  - `Color(.secondarySystemBackground)`
  - `Color(.tertiarySystemBackground)`

### Couleurs financières (hardcodées)
```swift
// TransactionEnums.swift:33-39
.income: .green
.expense: .red
.saving: .blue
```

### Fichiers clés
- `ios/Pulpe/Features/Auth/LoginView.swift:133` - `.background(Color(.systemGroupedBackground))`
- `ios/Pulpe/Shared/Components/PulpeLogo.swift:11-20` - Gradient hardcodé
- `ios/Pulpe/Domain/Models/TransactionEnums.swift:33` - Couleurs financières

## Research Findings - Apple HIG

### Recommandations officielles Apple

1. **Couleurs système préférées pour les backgrounds**
   - `systemBackground`, `secondarySystemBackground`, `tertiarySystemBackground`
   - S'adaptent automatiquement au light/dark mode
   - Cohérence avec l'écosystème iOS

2. **Couleurs custom = accents, pas backgrounds**
   - OK pour : boutons, badges, highlights, logo
   - Déconseillé pour : fond de page principal

3. **Si couleur custom pour background**
   - OBLIGATOIRE de fournir variante dark mode
   - Tester accessibilité (contraste)
   - Risque de paraître "non-natif"

## Analyse et Recommandation

### Option A : Utiliser #f6fbf1 comme background iOS
**Problèmes :**
- Le vert très clair `#f6fbf1` sera VISIBLE vs le blanc système iOS pur
- Peut paraître "sale" ou "jauni" à côté d'apps système
- Nécessite une variante dark `#10150f` qui est très sombre
- Contradiction avec les HIG d'Apple

### Option B : Garder backgrounds système, harmoniser les accents (RECOMMANDÉ)
**Avantages :**
- Conforme aux HIG Apple
- Light/dark mode automatique
- App "native" iOS
- Cohérence de la marque via :
  - AccentColor = vert Pulpe #006E25
  - Gradient logo (déjà fait)
  - Couleurs financières alignées

### Mapping couleurs proposé

| Frontend Angular | iOS Actuel | iOS Proposé |
|-----------------|------------|-------------|
| `--mat-sys-surface` (#f6fbf1) | `Color(.systemGroupedBackground)` | **Garder système** |
| `--mat-sys-primary` (#006E25) | AccentColor (~turquoise) | **Changer vers #006E25** |
| Income (#0061a6) | .green | **Color(hex: 0x0061A6)** |
| Expense (#c26c00) | .red | **Color(hex: 0xC26C00)** |
| Savings (#27ae60) | .blue | **Color(hex: 0x27AE60)** |

## Conclusion

**Réponse : NON recommandé** d'utiliser `#f6fbf1` comme background iOS.

**Alternative recommandée :**
1. Garder `Color(.systemGroupedBackground)` pour les fonds
2. Créer une extension `Color+Pulpe.swift` avec les couleurs de marque
3. Aligner AccentColor avec le vert primaire #006E25
4. Harmoniser les couleurs financières entre web et iOS

## Dependencies
- Aucun package externe requis
- Xcode Asset Catalog pour les couleurs

## Next Step
Exécuter `/epct:plan .claude/tasks/18-ios-color-system-alignment` pour créer le plan d'implémentation si tu veux aligner les couleurs d'accent et financières.
