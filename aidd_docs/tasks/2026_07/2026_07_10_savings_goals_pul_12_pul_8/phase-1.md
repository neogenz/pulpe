---
status: done
---

# Instruction: Rendre l'horizon et la redistribution canoniques

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
shared/
├── schemas.ts                                      ✏️ contrat plan, disponibilité et borne 120 périodes
└── src/
    ├── calculators/
    │   ├── savings-goal-progress.ts               ✏️ contexte de matérialisation de la timeline
    │   ├── savings-goal-plan.ts                   ✏️ gaps provisionnables et dénominateur canonique
    │   └── savings-goal-plan.spec.ts              ✏️ repro 24 mois et gardes de redistribution
    └── savings-goal-pul12.spec.ts                 ✏️ bornes de date et contrat d'apply
```

## Tasks to do

### `1)` Verrouiller la régression de redistribution

> Reproduire le cas 24 mois avant de changer les formules.

1. Ajouter le cas cible 24 000, 24 périodes restantes, 2 mois matérialisés et 22 mois sans budget provisionnables.
2. Attendre une part de 1 000 par mois, 24 ajustements cents-exact et une somme finale de 24 000.
3. Ajouter le cas d'un `gap` avec budget existant sans ligne liée : aucune redistribution applicable.
4. Jumeler les cas global, épinglé, échéance dépassée et cible déjà atteinte.

### `2)` Décrire la disponibilité d'un mois

> Ne plus confondre absence de budget et absence de ligne liée.

1. Étendre l'input de timeline avec les périodes budgétaires matérialisées et l'éligibilité du Mois Type.
2. Exposer `isProvisionable` sur un mois `gap` seulement si aucun budget n'existe et qu'une ligne Épargne du Mois Type peut être propagée.
3. Garder l'édition individuelle réservée aux mois portant des lignes; autoriser slider, simulation et redistribution sur les gaps provisionnables.
4. Renvoyer `isDistributable: false` si une période contributive de l'horizon n'est ni ouverte ni provisionnable.

### `3)` Étendre le contrat d'application sans casser les clients

> Transporter l'intention mensuelle des périodes à créer.

1. Ajouter `missingMonthAdjustments: [{ month, year, amount }]`, borné à 120 et sans période dupliquée.
2. Garder provisoirement `templateAdjustments`, mais n'accepter que le tableau vide et le marquer déprécié.
3. Préserver `monthAdjustments` line-scoped pour les lignes déjà matérialisées.
4. Vérifier que le plan contient au moins un ajustement dans les deux jambes actives.

### `4)` Borner l'horizon

> Empêcher les timelines et créations non bornées.

1. Définir une constante partagée de 120 périodes contributives, mois courant inclus.
2. Refuser en create/update une échéance située après la 120e période, soit au plus 119 mois après le mois courant, sans empêcher l'édition d'un objectif échu quand sa date est omise.
3. Clamper défensivement la timeline à 120 périodes autour du cycle courant pour les données historiques invalides.
4. Vérifier qu'une cible en 9999 ne provoque jamais des dizaines de milliers d'itérations.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Deux budgets sur un horizon de 24 mois donnent 1 000 par mois, jamais 12 000. |
| 2 | Un mois réellement absent est provisionnable; un budget existant sans ligne liée bloque la redistribution. |
| 3 | Les anciens payloads avec `templateAdjustments: []` restent valides et les nouveaux mois sont décrits par période. |
| 4 | Une échéance au-delà de la 120e période est rejetée et une donnée historique extrême produit au plus 120 mois. |
