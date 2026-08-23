---
objective: "L'app iOS partage une seule grammaire visuelle à fort contraste (hero forêt, ledger en cartes groupées, trois familles de chips maximum, un CTA plat) sur l'accueil, le détail de budget, la vue annuelle, les objectifs et les modèles ; la saisie d'une opération tient en trois blocs ; l'onboarding pose une question par écran."
status: implemented
---

# Plan: refonte du design system et de l'UI de l'app iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Propager la grammaire de l'accueil (hero borné + verdict + ledger en cartes + RowIcon) aux quatre autres surfaces, en lui donnant le contraste et la profondeur qui lui manquent, et réduire chaque écran à moins de blocs avec un seul vocabulaire de conteneur. Lecture « B » de l'analyse du 2026-08-21 : on garde la DA calm naturalism, on en change l'exécution. |
| **Source** | Analyse en conversation du 2026-08-21 à partir de `~/Downloads/inspi-pulpe-v2/` (4 captures : formulaire Kargul une question par écran, home « Spending Plan », numpad Plata, sheet de confirmation Nimbus) confrontée aux captures `appstore-screenshots/01..08` du 2026-08-18. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Fondation : tokens de contraste, CTA plat, règles, test de contraste | [`phase-1.md`](./phase-1.md) |
| 2   | Saisie d'une opération en trois blocs | [`phase-2.md`](./phase-2.md) |
| 3   | Hero de référence sur l'accueil, `HeroZone` partagé | [`phase-3.md`](./phase-3.md) |
| 4   | Détail de budget : même hero, verdict, ledger unique, rail de filtres | [`phase-4.md`](./phase-4.md) |
| 5   | Vue annuelle sur la grammaire commune | [`phase-5.md`](./phase-5.md) |
| 6   | Objectifs d'épargne : liste et détail | [`phase-6.md`](./phase-6.md) |
| 7   | Modèles : liste et détail | [`phase-7.md`](./phase-7.md) |
| 8   | Onboarding : squelette une question par écran | [`phase-8.md`](./phase-8.md) |
| 9   | Onboarding : découper les étapes denses | [`phase-9.md`](./phase-9.md) |

Ordre : 1 débloque tout. 2 et 3 sont indépendantes (2 = levier rétention, 3 = référence visuelle) et peuvent se faire en parallèle. 4, 5, 6 dépendent de 3. 7 dépend de 4 (grammaire de ligne). 8 puis 9 sont indépendantes du reste et gardées pour la fin : le funnel d'entrée est réparé (diagnostic de juillet), le mur est budget => opération.

## Resources

| Source | Verified |
| ------ | -------- |
| https://www.w3.org/TR/WCAG21/#contrast-minimum | Seuils appliqués aux paires du hero : 4.5:1 texte, 3:1 non-texte. Mesures locales (formule de luminance relative) : hero mint `#CFE8D6` vs fond `#EFF3EE` = 1.16:1 ; hero forêt `#0E3A1C` vs fond = 11.4:1 ; blanc sur forêt 12.8:1 ; mint sur forêt 9.9:1 ; `#7EDB83` 7.5:1 ; `#E5A33A` 5.9:1 ; `#F08A6A` 5.2:1 ; `#5AA8E0` 4.9:1. Les teintes d'état actuelles `#14AD45` et `#D88010` avec encre blanche = 2.96:1 et 2.99:1, refusées. |
| https://developer.apple.com/documentation/swiftui/view/toolbarcolorscheme(_:for:) | Un hero sombre sous la barre de navigation exige `.toolbarColorScheme(.dark, for: .navigationBar)` pour passer le titre et les boutons en encre claire ; aucune occurrence dans `ios/Pulpe` aujourd'hui. |

## Decisions

| Decision | Why |
| -------- | --- |
| La surface du hero est la forêt de marque (`#0E3A1C`), constante, jamais teintée par l'état financier. L'état vit dans la phrase de verdict, un chip et l'accent du graphique (`#7EDB83` / `#E5A33A` / `#F08A6A`). | Les teintes d'état avec encre blanche échouent AA (2.96:1). La palette dark mode existante passe AA sur la forêt, elle devient la palette d'accent du hero sans nouvelle couleur. « Calme » ne veut pas dire « pâle » : le contraste hero/fond passe de 1.16:1 à 11.4:1, c'est la cause racine du rendu « cheap ». |
| Une seule famille `HeroZone` partagée (surface, figure, tuiles métriques, verdict) consommée par l'accueil, le détail de budget, la vue annuelle et le détail d'objectif. Les quatre grammaires de hero actuelles disparaissent. | Principe Apple de familiarité : ce qui se ressemble se comporte pareil. Quatre heros différents sur quatre onglets est le défaut DS n°1 relevé dans l'analyse. |
| Une seule grammaire de liste : carte groupée `pulpeCard()` + hairlines + disque leading (`RowIcon` / `PointCircle` 36pt). `pulpeRowCard(cornerRadius: .xl)` n'est plus utilisé pour des lignes. `KindTagInline` et `KindBadge` sont supprimés, la nature est portée par le disque et la couleur du montant. | Le détail de budget (écran le plus utilisé) est le seul outlier ; la grammaire groupée existe déjà sur l'accueil, les modèles et le plan d'objectif. |
| Trois familles de chips visibles au plus par écran ; tout choix 1-de-N passe par `SegmentedPicker` ; `.muted` interdit sur le canvas ; les pills stat du hero deviennent des `HeroMetricTile`. | Inflation constatée : cinq styles de `PulpeChip` cohabitent à 200pt les uns des autres ; « À pointer » et « Tout » rendent tous deux `.solid` simultanément. |
| `PrimaryButtonStyle` passe en remplissage plat `pulpePrimary`, le dégradé `onboardingGradient` ne sert plus aux boutons. | `DESIGN.md` réserve déjà les dégradés à la zone hero ; un CTA dégradé sous un hero forêt se bat avec lui. Un seul élément saturé par écran. |
| Saisie d'opération : clavier décimal système, montant en premier, pas de numpad custom, pas d'étape de confirmation. | Le numpad Plata est un pavé intégral (séparateur décimal par locale, Dynamic Type, clavier matériel, VoiceOver) pour un gain non prouvé ; le problème mesuré est l'ordre et le nombre de blocs. La confirmation Nimbus s'applique aux actions irréversibles ; une dépense est annulable. Ta règle « Consequence-Matched Confirmation ». |
| La barre d'onglets reste native `TabView`, aucune chrome custom, aucun accessoire bas. | Règle existante du DS ; iOS 26 rend déjà la barre flottante et vitrée. |
| Modèles et liste d'objectifs n'ont pas de hero. | Un hero exige un état financier dominant ; la liste d'objectifs ne charge pas les montants confirmés (ils vivent dans `SavingsGoalPlan`), les modèles n'ont pas d'état. On remplit ces pages avec la grammaire de ledger, pas avec un hero vide. |
| `DESIGN.md` (cross-platform) ne change que ses règles Two-Zone et dégradé ; le webapp et le landing ne sont pas touchés. | « Une vérité produit, des expériences natives » : iOS surcharge déjà le fond (`#EFF3EE`), il surcharge maintenant la surface du hero. |
| Onboarding en dernier et sous condition : la phase 9 ne démarre que si le funnel PostHog par étape montre une perte sur `charges`, `savings` ou `registration`. | Le diagnostic de juillet situe le mur à budget => opération, pas à l'entrée. Le chantier le plus séduisant est le moins levier. |
