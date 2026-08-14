---
status: done
track: B
---

# Instruction: Ajout et réalisation de la prévision sur le web

Le formulaire web doit présenter trois origines de revenu mutuellement exclusives. Le mode objectif
planifie une sortie sans débiter le pot ; le geste de pointage est remplacé par la création du réel,
via le formulaire de transaction allouée existant.

## Wireframes

```text
Ajouter une prévision

Type                 [ Revenu                     ▾ ]
Montant              [ 500 CHF                      ]
Description          [ Apport cuisine               ]
Origine du revenu    [ Retrait d'un objectif       ▾ ]

Objectif utilisé     [ Fonds d'urgence             ▾ ]
Projection août      3'600 CHF → 3'100 CHF

ⓘ Le retrait reste prévu. Le solde baisse quand le revenu réel est créé.

                                  [Annuler] [Planifier]
```

```text
Réaliser le retrait

Fonds d'urgence · solde actuel 3'600 CHF
Montant restant prévu                         500 CHF
Montant réel                [ 500 CHF                ]
Date                        [ 05.08.2026              ]
Pointé                      [ on ]

                                     [Annuler] [Créer]
```

## Architecture ciblée

```text
frontend/projects/webapp/src/app/feature/budget/budget-details/
├── budget-line/create/dialog.ts                         ✏️ origine exclusive
├── budget-line/create/dialog.schema.ts                  ✏️ source dans le draft
├── budget-line/edit/dialog.ts                           ✏️ origine en lecture seule
├── allocated-transactions/create-dialog/form.ts         ✏️ réalisation contextualisée
├── budget-details-dialog.service.ts                     ✏️ même flux desktop/mobile
└── store/budget-details-store.ts                        ✏️ invalidations + erreurs
frontend/projects/webapp/src/app/pattern/savings-goal-picker/
└── savings-goal-picker-field.ts                         ✏️ mode planifié
frontend/projects/webapp/src/app/ui/savings-goal-source/
└── savings-goal-source-line.ts                          ♻️ libellé existant
```

## Tasks to do

### `1)` Remplacer les toggles contradictoires par une origine exclusive

1. Pour `kind=income`, ajouter un contrôle « Origine du revenu » :
   `regular`, `savingsGoal` ou `repayNextMonth` (PUL-292).
2. Réutiliser les chemins existants : `regular` crée une ligne simple ; `repayNextMonth` renvoie le
   résultat `savingsWithdrawal` actuel ; `savingsGoal` envoie `sourceSavingsGoalId`.
3. Un changement de type ou d'origine efface l'état devenu incompatible. Le mode objectif force
   `recurrence=one_off`, `isChecked=false` et ne propose ni lissage ni PUL-292.
4. `canSubmit` exige un objectif en mode objectif ; garder la saisie lorsque le chargement du picker
   échoue et proposer Réessayer.

### `2)` Réutiliser le picker en mode planifié

1. Ajouter un mode `plannedWithdrawal` distinct de `withdrawal` : il liste les objectifs via le cache
   existant, sans filtrer ceux dont le solde confirmé est aujourd'hui nul.
2. Après sélection, charger la progression déjà exposée par `SavingsGoalApi`, prendre le dernier
   `projectedCumulative` à ou avant la période du budget (repli `confirmed` si aucune row) et afficher
   l'avant/après avec le montant converti. Une période sans mouvement hérite ainsi du dernier solde.
3. Réutiliser `injectLiveConversionPreview` : la comparaison porte sur le montant dans la devise du
   compte, jamais sur la saisie étrangère.
4. Une projection insuffisante affiche un avertissement informatif mais n'empêche pas de planifier ;
   le solde peut évoluer. Le mode retrait **réel** conserve son blocage strict actuel.

### `3)` Rendre la prévision identifiable dans le budget

1. Réutiliser `SavingsGoalSourceLine` sur la ligne et son panneau de détail : « Pris sur · objectif ».
2. Dans l'édition, afficher l'origine en lecture seule ; ne pas ajouter un second picker qui laisserait
   croire que la source est modifiable.
3. Une source orpheline conserve le nom snapshot et le style neutre `link_off` déjà existant ; elle ne
   peut plus être réalisée.

### `4)` Réaliser depuis la prévision, sans pointage direct

1. Pour une ligne source, le geste de check et son libellé accessible deviennent « Réaliser le
   retrait » et ouvrent `CreateAllocatedTransactionForm` au lieu d'appeler le toggle.
2. Préremplir description et montant restant `max(0, prévu − réels alloués)` ; laisser l'utilisateur
   saisir le montant réel et le statut pointé.
3. Afficher la source verrouillée et le solde confirmé courant. Ne jamais envoyer
   `sourceSavingsGoalId` depuis ce formulaire : le backend l'hérite de la ligne.
4. Sur conflit de solde, garder le formulaire et les valeurs ouverts, recharger l'aperçu et annoncer
   l'erreur. Après succès, invalider budget, objectif, options et progression.
5. Les transactions partielles restent possibles ; un nouveau geste propose le reliquat. À reliquat
   zéro, le CTA devient « Ajouter un autre revenu réel », sans recréer le prévu.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les trois origines sont exclusives ; objectif + PUL-292 ou objectif + pointé ne peuvent jamais être soumis. |
| 2 | Le picker montre la projection du mois et ne bloque pas une planification future sur le seul solde actuel ; le retrait réel reste strict. |
| 3 | La ligne et l'édition rendent le nom complet, y compris après suppression de l'objectif, sans permettre de changer la source. |
| 4 | « Réaliser » crée une transaction allouée, conserve la saisie en cas de conflit et diminue le confirmé une seule fois. |
