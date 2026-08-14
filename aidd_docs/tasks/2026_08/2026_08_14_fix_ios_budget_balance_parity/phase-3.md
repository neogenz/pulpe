---
status: done
---

# Instruction: Aligner le seam sur PUL-270

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/
├── Pulpe/Features/Templates/TemplateDetails/
│   ├── EditTemplateLineSheet.swift                       ✏️ conserver uniquement le signal d'impact de la sauvegarde
│   └── TemplateDetailsView.swift                         ✏️ porter le seam de mutation et son câblage aux stores
└── PulpeTests/Features/Templates/
    └── EditTemplateLineSheetTests.swift                  ✏️ traverser le seam réel du ViewModel
```

## Tasks to do

### `1)` Respecter le seam de mutation PUL-270

1. Exposer `onBudgetDataMutation` sur `TemplateDetailsViewModel` sans l'inclure dans l'observation.
2. Faire annoncer `.budgetsChanged` par le ViewModel, sans énumérer de store au point de sauvegarde.
3. Câbler dans une `.task` de `TemplateDetailsView` l'unique closure qui invalide les projections.

### `2)` Réduire la complexité accidentelle

1. Co-localiser `TemplateBudgetProjectionStores` dans `TemplateDetailsView.swift`.
2. Supprimer le `Result` artificiel : le callback de la sheet représente déjà une sauvegarde réussie.
3. Préserver le rafraîchissement local de la ligne et l'invalidation de la liste, du dashboard, du mois courant, du détail et des objectifs.

### `3)` Verrouiller le comportement

1. Traverser le seam réel du ViewModel pour `.budgetsChanged`, `.templateOnly` et une propagation vide.
2. Conserver la régression qui recharge la liste et le détail de `-6’078 CHF` vers `-1’771.80 CHF`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le callback n'énumère aucun store ; il annonce un unique fait au ViewModel seulement pour `.budgetsChanged`. |
| 2 | `TemplateBudgetProjectionStores.invalidate()` demeure l'unique liste des cinq projections à périmer. |
| 3 | La liste et le détail convergent vers `-1’771.80 CHF` ; modèle seul et propagation vide ne déclenchent aucun rechargement. |
