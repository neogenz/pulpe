-- Existing clients could realize a planned savings-goal withdrawal before the
-- server owned its initial pointing state. Repair only allocated Reals whose
-- income forecast names the same source goal; free withdrawals stay untouched.
-- `created_at` mirrors the state the new write rule would have produced when
-- the Real was created, without inventing a later user action.
UPDATE public.transaction AS tx
SET checked_at = tx.created_at
FROM public.budget_line AS line
WHERE tx.checked_at IS NULL
  AND tx.kind = 'income'::public.transaction_kind
  AND tx.budget_line_id = line.id
  AND tx.budget_id = line.budget_id
  AND tx.source_savings_goal_id IS NOT NULL
  AND line.kind = 'income'::public.transaction_kind
  AND line.source_savings_goal_id = tx.source_savings_goal_id;
