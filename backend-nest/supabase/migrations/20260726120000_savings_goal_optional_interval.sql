ALTER TABLE public.savings_goal
  ADD COLUMN start_date date NULL,
  ALTER COLUMN target_date DROP NOT NULL,
  ALTER COLUMN target_amount DROP NOT NULL;
