-- Ajouter la colonne rollover_balance à monthly_budget
ALTER TABLE monthly_budget 
ADD COLUMN rollover_balance NUMERIC(10,2) DEFAULT 0;

-- Commenter la colonne pour clarifier son usage
COMMENT ON COLUMN monthly_budget.rollover_balance IS 'Solde total cumulé qui peut être reporté au mois suivant (évite la récursivité)';

-- Index pour optimiser les requêtes de rollover
CREATE INDEX idx_monthly_budget_rollover_balance ON monthly_budget (user_id, year, month, rollover_balance);