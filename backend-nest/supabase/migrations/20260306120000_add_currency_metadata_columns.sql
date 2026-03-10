-- Add currency metadata columns for multi-currency support
-- All columns nullable for backward compatibility with existing records

-- transaction
ALTER TABLE transaction ADD COLUMN original_amount TEXT;
ALTER TABLE transaction ADD COLUMN original_currency VARCHAR(3);
ALTER TABLE transaction ADD COLUMN target_currency VARCHAR(3);
ALTER TABLE transaction ADD COLUMN exchange_rate NUMERIC(18,8);

-- budget_line
ALTER TABLE budget_line ADD COLUMN original_amount TEXT;
ALTER TABLE budget_line ADD COLUMN original_currency VARCHAR(3);
ALTER TABLE budget_line ADD COLUMN target_currency VARCHAR(3);
ALTER TABLE budget_line ADD COLUMN exchange_rate NUMERIC(18,8);

-- template_line
ALTER TABLE template_line ADD COLUMN original_amount TEXT;
ALTER TABLE template_line ADD COLUMN original_currency VARCHAR(3);
ALTER TABLE template_line ADD COLUMN target_currency VARCHAR(3);
ALTER TABLE template_line ADD COLUMN exchange_rate NUMERIC(18,8);

-- savings_goal
ALTER TABLE savings_goal ADD COLUMN original_target_amount TEXT;
ALTER TABLE savings_goal ADD COLUMN original_currency VARCHAR(3);
ALTER TABLE savings_goal ADD COLUMN target_currency VARCHAR(3);
ALTER TABLE savings_goal ADD COLUMN exchange_rate NUMERIC(18,8);
