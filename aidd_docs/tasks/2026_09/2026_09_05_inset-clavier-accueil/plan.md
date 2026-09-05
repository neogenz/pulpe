---
objective: "Un écran de navigation ne garde jamais l'inset clavier d'un écran voisin, et l'oubli devient une erreur de test plutôt qu'un bug de production."
status: implemented
---

# Plan: l'inset clavier ne survit plus au retour arrière

## Overview

| Field      | Value                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Supprimer le bloc mort haut d'un clavier sur l'accueil au retour du détail d'un mouvement, et empêcher la 6e récidive         |
| **Source** | Bug rapporté le 2026-09-05 (captures accueil + « Modifier »), diagnostic session en cours, PUL-284 (4 incarnations passées)   |

## Phases

| #   | Phase                                                       | File                         |
| --- | ----------------------------------------------------------- | ---------------------------- |
| 1   | Nommer le remède et l'appliquer aux points de composition   | [`phase-1.md`](./phase-1.md) |
| 2   | Verrouiller l'inventaire des écrans de navigation par test  | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                       | Verified                                                                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `BudgetDetailsView.swift:325-331`                                            | Le remède canonique et son commentaire « garder EN DERNIER », posés par PUL-284                              |
| `View+Extensions.swift:403-440`                                              | `pulpeStickyBottomCTA(avoidsKeyboard:)` applique le même reset sous un autre nom, pour un seul appelant       |
| `EditTransactionPage.swift:143-151`                                          | `afterPushTransition` met `focusedField = .amount` : c'est l'auto-focus qui gonfle l'inset du stack partagé  |
| Mémoire PUL-284 (`project_pul284_keyboard_inset_budgetdetails`)              | ~15 itérations XCUITest prouvent qu'un harnais ne reproduit pas ce bug de timing (faux vert correctif éteint) |

## Decisions

| Decision                                                                                                   | Why                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le reset s'applique **au site d'appel** (là où la destination est déclarée), pas dans le corps de l'écran   | PUL-284 documente un faux correctif dû à un modificateur placé avant un `.overlay`. Depuis le site d'appel il enveloppe toute la chaîne : l'ordre ne peut plus être faux. Et l'inventaire « qui reset / qui possède un champ » devient lisible en un seul endroit |
| La règle est inversée : **tout écran de navigation reset**, sauf les deux qui possèdent un champ inline     | Audit : sur 11 écrans poussés ou racines, seuls `EditTransactionPage` et `AddAllocatedTransactionPage` ont un `TextField`. Une exception à deux entrées se tient ; onze décisions au cas par cas, non — c'est ce qui a produit cinq incarnations               |
| `pulpeStickyBottomCTA(avoidsKeyboard:)` perd son paramètre                                                 | C'est la troisième orthographe du même remède, pour un unique appelant (`BudgetLineDetailPage:97`). Une fois le reset posé au site d'appel, le paramètre est inerte. Trois orthographes sans nom commun = la cause de la récidive, pas du bug                  |
| Extraire `savingsGoalDestination(_:)` comme `budgetDestination(_:)` existe déjà                             | Le `switch SavingsGoalDestination` est recopié dans les trois onglets. Sans extraction la décision se prend trois fois pour le même écran — la dérive exacte qu'on corrige. Coupable si Maxime veut réduire : la phase 1 marche sans, avec 2 applications de plus |
| Pas de XCUITest de non-régression                                                                          | Établi empiriquement en 2026-06 : le harnais nu ne reproduit pas le strand et donne un vert correctif désactivé. Le verrou est un test d'inventaire de source (phase 2), pas un test de rendu                                                                  |
