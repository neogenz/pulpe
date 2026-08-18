# Règles métier transverses

Ce fichier contient uniquement les invariants qui traversent plusieurs fonctionnalités. Les détails restent dans les calculateurs et les documents spécialisés liés ci-dessous.

## Prévisions, Réels et enveloppes

- Une `budget_line` est une **Prévision** ; une `transaction` est un **Réel**. Un Réel s'ajoute normalement aux Prévisions.
- Un Réel alloué à une Prévision est couvert par son enveloppe : le total effectif vaut `max(montant prévu, somme des Réels de même nature)`. Un Réel libre impacte directement le budget.
- Les formules canoniques vivent dans [`shared/src/calculators/budget-formulas.ts`](../shared/src/calculators/budget-formulas.ts) et leur miroir Swift dans [`ios/Pulpe/Domain/Formulas/BudgetFormulas.swift`](../ios/Pulpe/Domain/Formulas/BudgetFormulas.swift).

## Continuité mensuelle

- Un budget mensuel généré depuis le Mois Type reste modifiable indépendamment.
- `monthly_budget.ending_balance` stocke le delta du mois. Le report d'un mois cumule les deltas antérieurs, y compris les déficits ; le disponible ajoute ce report aux revenus du mois.
- Le calcul et ses gardes de non-double-comptage vivent dans [`shared/src/calculators/budget-formulas.ts`](../shared/src/calculators/budget-formulas.ts).

## Propagation du Mois Type

- Une propagation explicite sélectionne les budgets du cycle courant et des cycles futurs dans [`BulkTemplateLineOperationsUseCase.fetchPropagationBudgets`](../backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.ts), avant l'appel SQL.
- Une Prévision modifiée manuellement porte `is_manually_adjusted = true` et n'est plus écrasée ni supprimée par la propagation du Mois Type.
- Le repository appelle la RPC courante [`apply_template_line_operations_with_tags`](../backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts). Les mutations du Mois Type, des Prévisions sélectionnées et de leurs tags sont atomiques dans son [wrapper SQL](../backend-nest/supabase/migrations/20260715150000_atomic_template_line_operations_with_tags.sql) ; le filtre `is_manually_adjusted` vit dans la [définition courante de la RPC de base](../backend-nest/supabase/migrations/20260727122000_bound_updated_template_goal_links.sql). L'invalidation du cache et les recalculs ont lieu après cette transaction.

## Lissage

- Un lissage matérialise des Prévisions `one_off` indépendantes dont la somme conserve le montant demandé.
- Lisser explicitement un Réel libre est l'unique exception au modèle additif : le Réel source est remplacé atomiquement par les Prévisions lissées afin d'éviter le double comptage.
- Le contrat complet vit dans [`docs/SPREAD.md`](./SPREAD.md).

## Montants et devises

- Toute décision financière compare un écart quantifié au centime. La présentation dépend du rôle du montant : jusqu'à deux décimales lorsqu'il justifie un état ou une action, format compact pour un agrégat de lecture rapide. Les pourcentages entiers restent indicatifs et ne décident jamais seuls d'un état monétaire.
- Les arrondis intentionnels restent inchangés : répartition au plus grand reste, lissage à somme conservée, conversion FX à deux décimales, mensualité arrondie au centime supérieur et agrégats visuels compacts.
- Tous les montants financiers persistés, dont `amount`, `target_amount`, `initial_amount`, `original_amount`, `original_target_amount` et `ending_balance`, passent par `ENCRYPTION_PORT` et sont stockés chiffrés en AES-256-GCM. Voir [`docs/ENCRYPTION.md`](./ENCRYPTION.md).
- Une conversion conserve avec l'écriture son montant d'origine, ses devises et son taux. Ce taux est historique : il n'est pas rafraîchi ensuite. Les métadonnées FX sont absentes ensemble ou cohérentes ensemble, conformément aux schémas partagés et à la contrainte [`fx_metadata_coherent`](../backend-nest/supabase/migrations/20260420120000_fx_metadata_coherent.sql).
