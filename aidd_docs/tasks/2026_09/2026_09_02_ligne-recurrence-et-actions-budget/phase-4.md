---
status: pending
---

# Instruction: Actions du détail budget hors de la barre

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
┌──────────────────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓  hero forest, inchangé  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓  Août 2026 ⌄        (barre : plus que le titre)    ▓  │
│  ▓  Disponible à dépenser                             ▓  │
│  ▓  1'060.96 CHF                                      ▓  │
│  ▓  [Revenus] [Dépenses] [Épargne]                    ▓  │
│  ▓  ▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░ 62%                            ▓  │
│  ▓  Tu tiens ton plan, il te reste de la marge.       ▓  │
╭──────────────────────────────────────────────────────────╮ ← CornerRadius.zone (44)
│  ╭────────────────────╮  ╭────────────────────╮          │
│  │ (+)  Ajouter       │  │ (▮)  Suivi         │  64 pt   │  r = 18
│  ╰────────────────────╯  ╰────────────────────╯          │
│   └ deux cartes, 8 pt entre elles, pas de hairline       │
│                                                          │
│  ╭──────────────────────────────────────────────────╮   │
│  │ 💡 Touche le rond pour pointer une ligne         │   │  TipView
│  ╰──────────────────────────────────────────────────╯   │
│                                                          │
│  (À pointer 4 ⌄) (Tout 9) (Revenus) (Dépenses)          │  BudgetTypeFilter
│                                                          │
│  Dépenses · 6                                            │
│  ╭──────────────────────────────────────────────────╮   │
│  │ ╭─╮ Loyer                          1'450.00 CHF  │   │  r = 18
│  ╰──────────────────────────────────────────────────╯   │
└──────────────────────────────────────────────────────────┘

I-1 : deux cartes indépendantes côte à côte, `Spacing.sm` entre elles, chacune
64 pt de haut, un disque 36 pt (grammaire `RowIcon`, teinte `pulpePrimary`)
suivi du label sur la même ligne. Le plus discret des trois traitements : il
annonce l'action sans peser autant qu'une ligne du ledger en dessous.

RAYON — les deux cartes prennent `CornerRadius.card` (18 pt), exactement celui
des cartes de section du ledger plus bas (`BudgetMixedSection`,
`BudgetDetailsFreeTransactionsList`). Même token, donc même courbe : en
descendant la page, les formes se répondent au lieu de se contredire. Les
cartes d'action sont des objets frères de celles du ledger, jamais des objets
posés dedans — il n'y a aucun imbriqué ici, donc aucun rayon concentrique à
calculer.

## Tasks to do

### `1)` Construire `BudgetDetailActionsCard`

> Deux cartes d'action, bâties avec les primitives déjà en place.

1. Créer `BudgetDetailActionsCard.swift` : un `HStack(spacing: DesignTokens.Spacing.sm)` de deux boutons, chacun sur son propre `pulpeRowCard()` — qui applique déjà `CornerRadius.card`, le rayon des cartes du ledger. Ne pas passer de rayon explicite : le défaut est le bon, et l'écrire en dur le désolidariserait du ledger au premier changement de token.
2. Chaque carte : hauteur cible 64 pt, un disque 36 pt à la grammaire de `RowIcon` teinté `pulpePrimary` portant `plus` ou `chart.bar.fill`, puis le label sur la même ligne, `Spacing.compactGap` entre les deux.
3. Exposer les deux actions en closures et rien d'autre — la carte ne lit aucun store.
4. Aux tailles d'accessibilité, basculer le `HStack` en `VStack` pour que chaque carte garde sa zone tactile plutôt que de comprimer les labels.
5. Aucune valeur brute : tout passe par `DesignTokens` (`ios/DESIGN.md`, The No Magic Values Rule).

### `2)` Déplacer les actions

> Elles quittent la barre : aucune coexistence.

1. Supprimer `trailingToolbarButtons` de `BudgetDetailsView.swift` et son `.toolbar` associé ; le titre et le `toolbarTitleMenu` restent.
2. Poser la carte en tête de la zone de contenu, au-dessus du `TipView` et du rail `BudgetTypeFilter` : un élément permanent passe avant un conseil transitoire.
3. Reporter `budgetTrackingButton` et `budgetAddLineButton` sur les deux boutons de la carte, à l'identique — deux tests en dépendent.
4. Conserver les mêmes appels `router.present(.addBudgetLine)` et `router.present(.realizedBalance)` : seul le point d'entrée visuel change.

### `3)` Réécrire l'invariant testé

> `testBudgetToolbarActionsRemainDistinctAtLargeText` teste deux boutons de barre qui n'existeront plus.

1. Renommer le test et le rejouer sur la carte : les deux cartes restent disjointes et d'au moins 44 pt en `accessibility5`.
2. Vérifier que `testHomeShortcutPushesTheBudgetDetail` passe sans modification, l'identifiant ayant suivi.
3. Ajouter une assertion que la barre de navigation ne porte plus les deux boutons, sinon rien ne détecterait une duplication réintroduite.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| 1    | Les deux cartes se rendent avec les couleurs et disques du design system, sans nouvelle constante de style.                |
| 1    | Leur rayon est visuellement identique à celui des cartes de section du ledger plus bas sur le même écran.                  |
| 1    | En taille d'accessibilité, les deux labels restent entiers et chaque zone tactile fait au moins 44 pt.                     |
| 2    | Les deux actions sont visibles et nommées sans avoir à scroller, et la barre de navigation ne porte plus que le mois.      |
| 2    | Toucher chaque moitié ouvre la même destination qu'avant.                                                                 |
| 3    | Les UITests du détail budget passent, y compris l'arrivée par le raccourci de l'Accueil.                                   |
| 3    | Remettre les boutons dans la barre en plus de la carte fait échouer la suite.                                             |
