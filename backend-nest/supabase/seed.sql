-- Seed data for local development
-- This file populates the database with test data when running locally

-- Insert sample data for development
-- You can add sample users, budgets, transactions, etc. here
-- Example:

INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'test@example.com',
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Test User"}',
    'authenticated',
    'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Add more seed data as needed for your local development
-- Example: Sample budgets, transactions, etc.

-- You can uncomment and customize the following examples:

-- INSERT INTO monthly_budget (user_id, name, total_budget, period_start, period_end)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'Test Budget',
--     2500.00,
--     '2024-01-01'::date,
--     '2024-01-31'::date
-- ) ON CONFLICT DO NOTHING;