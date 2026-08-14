---
status: done
track: B
---

# Instruction: Ajout et réalisation de la prévision en SwiftUI

iOS reprend les mêmes règles métier avec ses patterns natifs. Le formulaire actuel possède déjà le
bon conteneur, le bon pipeline monétaire et un picker de retrait réel solide : on les étend sans
introduire un nouveau formulaire ni un second ViewModel.

## Wireframes

```text
Ajouter une prévision

[ Revenu ]
Montant                         [ 500 CHF ]
Description               [ Apport cuisine ]

Origine du revenu
[ Retrait d'un objectif                    ▾ ]

Objectif utilisé
[ Fonds d'urgence                          ▾ ]
Projection août             3'600 → 3'100 CHF

ⓘ Le retrait reste prévu. Le solde baisse
  quand tu crées le revenu réel.

                              [ Planifier le retrait ]
```

```text
Réaliser le retrait

Fonds d'urgence                  3'600 → 3'100 CHF
Montant réel                            [ 500 CHF ]
Date                               [ 5 août 2026 ]
Pointé                                      [ on ]

                                      [ Confirmer ]
```

## Architecture ciblée

```text
ios/Pulpe/Domain/Models/BudgetLine.swift                       ✏️ source additive
ios/Pulpe/Features/Budgets/BudgetDetails/
├── AddBudgetLineSheet.swift                                  ✏️ Picker natif
├── AddBudgetLineSheet+Submit.swift                           ✏️ source + invariants
├── AddAllocatedTransactionPage.swift                         ✏️ contexte réalisation
├── AddAllocatedTransactionLogic.swift                        ✏️ préremplissage, source omise
├── BudgetLineMixedRow.swift                                  ✏️ origine + CTA
└── Coordinator/BudgetDetailsCoordinator.swift                ✏️ intercepter le pointage
ios/Pulpe/Shared/Components/
├── SavingsGoalPickerField.swift                              ✏️ mode planifié
└── EditBudgetLineSheet.swift                                 ✏️ source en lecture seule
```

## Tasks to do

### `1)` Étendre le modèle en restant compatible avec la release décalée

1. Ajouter à `BudgetLine` les deux champs source optionnels/additifs et à `BudgetLineCreate` l'id seul.
2. Décoder leur absence comme `nil`. Les modèles restent `Foundation` + `Sendable` uniquement, car le
   Widget les compile aussi.
3. La couche service envoie l'id à la création et ne l'expose pas dans l'update.

### `2)` Présenter une origine de revenu claire

1. Dans `AddBudgetLineSheet`, ajouter un enum privé `IncomeOrigin` et un `Picker` natif à trois choix :
   revenu normal, retrait d'un objectif, avance à remettre (PUL-292).
2. Conserver `SheetFormContainer`, le focus montant → description, la gestion clavier et le pipeline
   async existants. Ne pas refactorer cet écran vers un `Form` générique.
3. En mode objectif : forcer `checked=false`, masquer le toggle de pointage, désactiver PUL-292 et
   soumettre `sourceSavingsGoalId`. Le bouton devient « Planifier le retrait ».
4. Les changements de type/origine effacent objectif et états incompatibles sans réinitialiser montant
   ou description.

### `3)` Réutiliser le picker et ses états async

1. Ajouter `.plannedWithdrawal` à `SavingsGoalPickerField`; réutiliser la liste/cache d'objectifs,
   puis la progression de l'objectif sélectionné.
2. À l'aide de `.task(id:)`, recalculer l'aperçu quand objectif, montant converti, devise ou période
   changent. L'annulation de tâche est normale ; les états loading/error/ready restent visibles.
3. Afficher le dernier `projectedCumulative` à ou avant la période (repli `confirmed`) puis
   l'après-retrait. Une insuffisance projetée avertit sans bloquer la planification ; le mode
   `.withdrawal` réel garde son contrôle strict.
4. En édition, afficher `SavingsGoalSourceLabel` en lecture seule, jamais un picker de remplacement.

### `4)` Réaliser via la transaction allouée existante

1. Sur une prévision source, l'action du cercle devient « Réaliser le retrait » et ouvre
   `AddAllocatedTransactionPage`; ne pas appeler le toggle de ligne.
2. Préremplir le reliquat, afficher la source verrouillée et l'aperçu du solde réel. Garder date,
   pointage, conversion et validation existants.
3. `AddAllocatedTransactionLogic` continue d'envoyer `budgetLineId` sans source explicite : le serveur
   l'hérite. Aucun picker de source ne doit apparaître à ce niveau.
4. Après succès, recharger budget et caches d'objectifs. En conflit, conserver la saisie, rafraîchir le
   solde et annoncer le refus.
5. Le CTA et son `accessibilityLabel` distinguent « Pointer » d'une ligne normale et « Réaliser le
   retrait » d'une ligne source. La cible interactive reste au moins 44 pt.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Un ancien payload sans champs source se décode ; une création source encode seulement l'id client. |
| 2 | Les trois origines sont exclusives ; le mode objectif ne peut jamais partir pointé ou avec PUL-292. |
| 3 | L'aperçu suit période et conversion, garde les données après erreur et ne bloque pas sur le seul solde actuel. |
| 4 | L'action crée un réel alloué, jamais un toggle direct ; VoiceOver annonce l'intention et un conflit ne ferme pas la page. |
