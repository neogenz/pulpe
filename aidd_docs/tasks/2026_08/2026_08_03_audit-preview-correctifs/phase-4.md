---
status: done
---

# Instruction: Coût et calage de l'affichage iOS

Le tableau de bord recalcule deux agrégats non mémoïsés à chaque image de scroll, l'en-tête « Transactions » du détail d'enveloppe laisse passer les lignes qui glissent dessous, et un échec de conversion de devise fige le bouton sans le dire.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/Pulpe
├── Domain/Store/CurrentMonthStore.swift                        ✏️ mémoïser `balanceTrajectory` et `plannedRemaining` comme les cinq autres agrégats
├── Features
│   ├── CurrentMonth
│   │   ├── CurrentMonthView.swift                              ✏️ la mesure du hero cesse d'écrire un `@State` à chaque image
│   │   └── Components/AddTransactionSheet.swift                ✏️ dire qu'une conversion a échoué au lieu de figer le bouton
│   └── Budgets/BudgetDetails/BudgetLineDetailPage.swift        ✏️ fond opaque sous l'en-tête de section épinglé
└── ../PulpeTests
    ├── Domain/Store/CurrentMonthStoreDashboardTests.swift      ✏️ les deux agrégats sortent du cache et se rafraîchissent au bon moment
    └── Features/CurrentMonth/AddTransactionSheetTests.swift    ✏️ conversion échouée + objectif choisi ⇒ un motif est rendu
```

## Wireframe

```txt
┌──────────────────────────────────────────────┐
│ (1) ‹   Week-end Italie              ···      │
├──────────────────────────────────────────────┤
│  Week-end Italie                              │
│  [ Sortie ]                                   │
│ ┌──────────────────────────────────────────┐ │
│ │ (2) Transactions            17 ce mois    │ │
│ ├──────────────────────────────────────────┤ │
│ │ (3) Restaurant carpe diem     72.00 CHF   │ │
│ │     Courses coop              32.00 CHF   │ │
│ │     Restaurant vendredi soir  50.00 CHF   │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ (4)      + Ajouter une transaction            │
└──────────────────────────────────────────────┘
```

1. Barre de navigation, inchangée.
2. En-tête de section épinglé par le style de liste : c'est lui qui doit poser un fond opaque.
3. Lignes qui défilent sous l'en-tête — aujourd'hui visibles à travers.
4. Bouton d'ajout, inchangé.

## Tasks to do

### `1)` Reprendre la trajectoire dans le cache du store

> Cinq agrégats sont déjà mémoïsés et rafraîchis en un point ; ces deux-là sont les seuls restés dehors.

1. Ajouter les deux valeurs cachées à côté des cinq existantes, les peupler dans le recalcul commun et les invalider au même endroit que les autres.
2. Faire lire le cache aux deux accesseurs, en gardant le repli calculé quand le cache est vide, comme le fait déjà le voisin.
3. Couvrir par un test : après mutation, la valeur servie est la nouvelle ; sans mutation, le calcul n'est pas relancé.

### `2)` Cesser d'écrire un état à chaque image

> Une mesure en coordonnées globales change à chaque image de scroll, donc invalide tout le corps de la vue.

1. Mesurer dans un repère qui ne bouge pas avec le défilement, ou ne réécrire l'état que lorsque la valeur change réellement.
2. Vérifier au passage si la bande de couleur peut être posée depuis la disposition du hero lui-même, ce qui supprimerait l'aller-retour par l'état.
3. Vérifier l'absence de régression visuelle par capture avant/après, jamais à l'œil.

### `3)` Poser un fond sous l'en-tête épinglé

> `.listStyle(.plain)` épingle les en-têtes de section ; le contenu de liste est transparent et les lignes défilent à travers.

1. Donner à la ligne d'en-tête le fond de page opaque, en couvrant toute la largeur de la ligne — un fond posé sur le contenu seul laisserait des gouttières transparentes.
2. Prendre la couleur du fond de page existant, pas une valeur brute ; aucune nouvelle constante visuelle.
3. Vérifier par capture d'écran, contenu défilé, que plus rien ne traverse l'en-tête, et que le rendu au repos est inchangé.

### `4)` Dire qu'une conversion a échoué

> Sans objectif choisi le même échec est affiché ; avec objectif choisi il devient muet.

1. Couvrir le cas « objectif choisi, montant converti absent » dans le motif de blocage, au niveau du sélecteur pour que tous ses appelants en héritent.
2. Ne toucher qu'à ce cas : les autres motifs de refus sont déjà rendus.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Faire défiler le tableau de bord ne relance plus le calcul de trajectoire ; la valeur affichée reste juste après ajout ou pointage d'une transaction. |
| 2    | Le défilement du tableau de bord reste fluide sur un mois dense, et la capture avant/après ne montre aucun décalage de disposition. |
| 3    | Sur le détail d'enveloppe, les transactions qui défilent passent derrière un en-tête opaque ; plus aucun texte ne se superpose.   |
| 4    | Conversion de devise indisponible + objectif choisi : un motif s'affiche au lieu d'un bouton grisé sans explication.              |
| 1-4  | La suite `PulpeTests` passe sur le simulateur dédié, jamais sur le simulateur interactif.                                        |
