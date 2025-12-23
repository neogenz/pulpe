-- Add optional budget_line_id to transaction for envelope tracking
ALTER TABLE transaction
ADD COLUMN budget_line_id UUID NULL;

COMMENT ON COLUMN transaction.budget_line_id IS
  'Optional reference to budget_line for envelope-based tracking';

-- Partial index for performance (only index non-null values)
CREATE INDEX idx_transaction_budget_line_id
ON transaction (budget_line_id)
WHERE budget_line_id IS NOT NULL;

-- Foreign key with ON DELETE SET NULL (transaction becomes "free" if line deleted)
ALTER TABLE transaction
ADD CONSTRAINT fk_transaction_budget_line
FOREIGN KEY (budget_line_id)
REFERENCES budget_line(id)
ON DELETE SET NULL;
