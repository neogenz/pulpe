---
status: done
---

# Instruction: Corriger la cohérence, le cache et l'accessibilité web

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/src/app/
├── feature/
│   ├── budget/budget-details/store/
│   │   ├── budget-details-store.ts                                  ✏️ préserver savingsGoalId optimiste
│   │   └── budget-details-store-integration.spec.ts                 ✏️ repro optimiste
│   └── savings-goals/
│       ├── components/
│       │   ├── savings-goal-card.ts                                 ✏️ lien natif, id stable, confidentialité
│       │   ├── savings-goal-card.spec.ts                            ✅ clavier et données DOM
│       │   ├── savings-goal-form-dialog.ts                          ✏️ échéance max
│       │   └── savings-goal-form-dialog.schema.spec.ts              ✏️ borne 120 périodes
│       ├── detail/
│       │   ├── savings-goal-detail-page.ts                          ✏️ erreur liste et retry
│       │   ├── savings-goal-detail-page.spec.ts                     ✏️ repro notFound erroné
│       │   └── services/
│       │       ├── goal-plan-simulator-store.ts                     ✏️ gaps provisionnables et payload
│       │       └── goal-plan-simulator-store.spec.ts                ✏️ scénario 2/24 et apply
│       ├── list/savings-goals-list-page.ts                          ✏️ supprimer navigation impérative
│       └── services/
│           ├── savings-goals-store.ts                               ✏️ sélection et invalidations croisées
│           └── savings-goals-store.spec.ts                          ✏️ delete succès/rollback
└── pattern/savings-goal-picker/
    ├── savings-goal-picker-field.ts                                 ✏️ loading, erreur, retry, réconciliation
    └── savings-goal-picker-field.spec.ts                            ✅ états et absence de déliaison destructive
```

## Tasks to do

### `1)` Appliquer les périodes provisionnables

> Envoyer les gaps par période et les mois matérialisés par ligne.

1. Reproduire le scénario 2/24 dans le store avant modification.
2. Inclure les gaps `isProvisionable` dans slider, simulation et redistribution, sans autoriser leur édition individuelle.
3. Construire `missingMonthAdjustments` pour ces gaps et garder l'allocation multi-lignes actuelle pour les mois matérialisés.
4. Omettre `templateAdjustments` et invalider budgets/objectifs après succès comme après échec potentiellement partiel.

### `2)` Sécuriser suppression et état optimiste

> Ne laisser aucune projection porter un objectif supprimé.

1. Mettre la sélection détail à `null` avant la mutation; la restaurer avec la liste sur rollback.
2. Invalider les racines de cache objectifs, budgets et Mois Type après suppression réussie.
3. Réconcilier une sélection de picker absente uniquement après un chargement réussi.
4. Retirer l'override optimiste `savingsGoalId: null` lors de la création d'une Prévision.

### `3)` Rendre chargement et erreurs honnêtes

> Une panne réseau ne doit jamais être présentée comme une liste vide ou un objectif introuvable.

1. Ajouter au picker les états chargement, erreur réessayable et vide réussi.
2. Ne jamais émettre `null` pendant loading/error.
3. Inclure `savingsGoals.error()` dans l'état erreur du détail.
4. Faire relancer liste et progression par le retry du détail.

### `4)` Rendre la carte clavier-safe et privée

> Utiliser un lien HTML natif sans exposer le nom utilisateur.

1. Écrire le test qui active la carte au clavier et inspecte les attributs DOM.
2. Remplacer le clic impératif par un `<a [routerLink]>` natif.
3. Baser `data-testid` sur `goal.id`, jamais sur `goal.name`.
4. Poser `ph-no-capture amounts-visible` sur le lien afin de bloquer l'autocapture sans perdre les événements pointeur lorsque les montants sont masqués.
5. Retirer l'output et la navigation impérative devenus inutiles dans la liste.

### `5)` Aligner la borne de formulaire

> Empêcher une date que l'API refusera.

1. Ajouter au sélecteur web la date maximale partagée correspondant à la 120e période.
2. Afficher une erreur spécifique quand la date dépasse la borne.
3. Garder le comportement d'édition d'un objectif déjà échu tant que sa date n'est pas modifiée.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le CTA affiche 1 000 pour le scénario 2/24 et le payload contient 22 périodes à provisionner. |
| 2 | Après suppression, aucun cache ni picker ne conserve l'id; un échec restaure la sélection et la liste. |
| 3 | Loading, erreur et vide ont trois rendus distincts; retry recharge les bonnes ressources. |
| 4 | La carte est un lien activable au clavier et aucun attribut ne contient le nom de l'objectif. |
| 5 | Le formulaire ne permet pas de soumettre une échéance au-delà de la 120e période. |
