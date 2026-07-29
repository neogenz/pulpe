---
status: done
---

# Instruction: Rendre la récupération iOS exacte

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios
├── Pulpe/Features/SavingsGoals
│   ├── ✏️ SavingsGoalDetailView.swift
│   ├── Components
│   │   └── ✏️ GoalPlanTimelineSection.swift
│   └── Simulator
│       └── ✏️ GoalPlanApplyRecapSheet.swift
└── PulpeTests/Features/SavingsGoals
    ├── ✏️ SavingsGoalDetailViewModelTests.swift
    └── ✏️ GoalPlanTimelinePresentationTests.swift
```

- Création : aucune.
- Suppression : aucune.

## User Journey

```mermaid
flowchart TD
  A["Ouvrir un objectif actif"] --> B{"Montant positif et mois réparable ?"}
  B -- "Non" --> C["Ne pas proposer la récupération"]
  B -- "Oui" --> D["Afficher un message grammatical"]
  D --> E["Prévisualiser un récap grammatical"]
```

## Tasks to do

### `1)` Centraliser le vrai prédicat de réparabilité

1. Faire exiger à `canRepairPlan` un objectif actif, un montant de récupération positif et au moins un mois `isRepairable`.
2. Corriger le fixture positif qui validait actuellement un mois non réparable.
3. Ajouter le cas actif avec montant positif mais aucun mois réparable.
4. Retirer le garde de mois redondant de la section une fois le booléen appelant exact.

### `2)` Produire un français naturel

1. Afficher « 1 prévision Épargne peut… » au singulier et « N prévisions Épargne peuvent… » au pluriel dans la timeline.
2. Afficher « 1 prévision Épargne à ajouter » ou « N prévisions Épargne à ajouter » dans le récap de création.
3. Réutiliser `GoalPlanTimelinePresentation` pour porter et tester le texte dérivé de la timeline ; garder le récap sous forme d’une condition locale sans créer de helper partagé à deux usages.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `canRepairPlan` vaut `true` uniquement pour un objectif actif avec montant positif et au moins un mois réparable. |
| 1 | Un mois sans budget, verrouillé, non provisionnable ou non éligible ne suffit pas à afficher le CTA. |
| 2 | Les variantes iOS à 1 et plusieurs prévisions n’emploient ni parenthèses ni accord pluriel au singulier. |
| 1–2 | Les tests ciblés Savings Goals passent sans nouveau fichier de production ou abstraction transversale. |
