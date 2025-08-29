-- Migration complète : Structure + Calcul des données existantes
-- Fichier : supabase/migrations/20250829120000_add_rollover_balance_with_data.sql

BEGIN;

-- =====================================================
-- ÉTAPE 1 : AJOUT DE LA STRUCTURE
-- =====================================================

-- Ajouter la colonne rollover_balance à monthly_budget
ALTER TABLE monthly_budget 
ADD COLUMN IF NOT EXISTS rollover_balance NUMERIC(10,2) DEFAULT 0;

-- Commenter la colonne pour clarifier son usage
COMMENT ON COLUMN monthly_budget.rollover_balance IS 'Solde total cumulé qui peut être reporté au mois suivant (évite la récursivité)';

-- Index pour optimiser les requêtes de rollover
CREATE INDEX IF NOT EXISTS idx_monthly_budget_rollover_balance 
ON monthly_budget (user_id, year, month, rollover_balance);

-- =====================================================
-- ÉTAPE 2 : CALCUL ET MISE À JOUR DES DONNÉES EXISTANTES
-- =====================================================

-- Recalculer rollover_balance pour tous les budgets existants
WITH ordered_budgets AS (
  SELECT 
    id,
    user_id,
    year,
    month,
    COALESCE(ending_balance, 0) as ending_balance,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY year, month
    ) as row_num
  FROM monthly_budget 
  WHERE year IS NOT NULL AND month IS NOT NULL
),
cumulative_calculation AS (
  SELECT 
    id,
    user_id,
    year,
    month,
    ending_balance,
    SUM(ending_balance) OVER (
      PARTITION BY user_id 
      ORDER BY year, month 
      ROWS UNBOUNDED PRECEDING
    ) as calculated_rollover_balance
  FROM ordered_budgets
)
UPDATE monthly_budget 
SET rollover_balance = cc.calculated_rollover_balance
FROM cumulative_calculation cc
WHERE monthly_budget.id = cc.id;

-- =====================================================
-- ÉTAPE 3 : VALIDATION AUTOMATIQUE INTÉGRÉE
-- =====================================================

-- Créer une fonction temporaire pour valider les données
CREATE OR REPLACE FUNCTION validate_rollover_migration() 
RETURNS void AS $$
DECLARE 
  inconsistent_count integer;
  sample_data text;
BEGIN
  -- Compter les incohérences
  WITH validation AS (
    SELECT 
      user_id,
      year,
      month,
      COALESCE(ending_balance, 0) as ending_balance,
      rollover_balance,
      LAG(rollover_balance) OVER (
        PARTITION BY user_id 
        ORDER BY year, month
      ) as prev_rollover_balance,
      rollover_balance - COALESCE(
        LAG(rollover_balance) OVER (
          PARTITION BY user_id 
          ORDER BY year, month
        ), 0
      ) as calculated_ending_balance
    FROM monthly_budget
    WHERE year IS NOT NULL AND month IS NOT NULL
  )
  SELECT COUNT(*)
  INTO inconsistent_count
  FROM validation
  WHERE ABS(ending_balance - calculated_ending_balance) > 0.01;
  
  -- Obtenir un échantillon pour debug si nécessaire
  SELECT string_agg(
    format('User: %s, Period: %s-%s, Expected: %s, Actual: %s', 
           user_id, year, month, ending_balance, calculated_ending_balance),
    E'\n'
  )
  INTO sample_data
  FROM (
    WITH validation AS (
      SELECT 
        user_id,
        year,
        month,
        COALESCE(ending_balance, 0) as ending_balance,
        rollover_balance,
        rollover_balance - COALESCE(
          LAG(rollover_balance) OVER (
            PARTITION BY user_id 
            ORDER BY year, month
          ), 0
        ) as calculated_ending_balance
      FROM monthly_budget
      WHERE year IS NOT NULL AND month IS NOT NULL
    )
    SELECT *
    FROM validation
    WHERE ABS(ending_balance - calculated_ending_balance) > 0.01
    LIMIT 5
  ) sample_inconsistencies;
  
  -- Vérifier le résultat
  IF inconsistent_count > 0 THEN
    RAISE EXCEPTION 'Migration validation failed: % inconsistent rows found. Sample: %', 
                    inconsistent_count, COALESCE(sample_data, 'No sample data');
  ELSE
    RAISE NOTICE 'Migration validation successful: All % rows are consistent', 
                 (SELECT COUNT(*) FROM monthly_budget WHERE year IS NOT NULL AND month IS NOT NULL);
  END IF;
  
  -- Afficher quelques exemples pour vérification visuelle
  RAISE NOTICE 'Sample of migrated data:';
  FOR sample_data IN 
    SELECT format('User: %s, %s-%s: ending_balance=%s, rollover_balance=%s', 
                  user_id, year, month, ending_balance, rollover_balance)
    FROM monthly_budget 
    WHERE year IS NOT NULL AND month IS NOT NULL
    ORDER BY user_id, year, month
    LIMIT 5
  LOOP
    RAISE NOTICE '%', sample_data;
  END LOOP;
  
END;
$$ LANGUAGE plpgsql;

-- Exécuter la validation
SELECT validate_rollover_migration();

-- Supprimer la fonction temporaire
DROP FUNCTION validate_rollover_migration();

-- =====================================================
-- ÉTAPE 4 : OPTIMISATIONS FINALES
-- =====================================================

-- Analyser la table pour mettre à jour les statistiques du planificateur
ANALYZE monthly_budget;

-- Log de fin de migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully at %', NOW();
  RAISE NOTICE 'Total monthly_budget rows updated: %', 
               (SELECT COUNT(*) FROM monthly_budget WHERE rollover_balance IS NOT NULL);
END
$$;

COMMIT;