-- =====================================================
-- SEED DATA FOR LOCAL DEVELOPMENT (STRICT UUID V4 FIX)
-- =====================================================
-- Test user credentials: maxime.desogus@gmail.com / 12345678

-- Clean up existing test data
TRUNCATE TABLE
  public.transaction,
  public.budget_line,
  public.monthly_budget,
  public.template_line,
  public.template,
  public.savings_goal
CASCADE;

-- =====================================================
-- 1. CREATE TEST USER
-- =====================================================
-- User ID: 8f6deafb-a539-458d-ab76-97a0f441bfe2
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '8f6deafb-a539-458d-ab76-97a0f441bfe2',
    'authenticated',
    'authenticated',
    'maxime.desogus@gmail.com',
    crypt('12345678', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Maxime Desogus"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Create test user email identity
INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    uuid_generate_v4(),
    '8f6deafb-a539-458d-ab76-97a0f441bfe2',
    format('{"sub":"%s","email":"%s"}', '8f6deafb-a539-458d-ab76-97a0f441bfe2', 'maxime.desogus@gmail.com')::jsonb,
    'email',
    current_timestamp,
    current_timestamp,
    current_timestamp
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- =====================================================
-- 2. CREATE TEMPLATES
-- =====================================================

-- Template 1 ID: 48e9c2c7-7407-440f-9031-628468600812
INSERT INTO public.template (id, user_id, name, description, is_default)
VALUES (
  '48e9c2c7-7407-440f-9031-628468600812',
  '8f6deafb-a539-458d-ab76-97a0f441bfe2',
  'Budget Mensuel Standard',
  'Template de base pour un budget mensuel équilibré',
  true
);

-- Template 1 Lines
INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, description)
VALUES
  ('48e9c2c7-7407-440f-9031-628468600812', 'Salaire', 3500.00, 'income', 'fixed', 'Salaire mensuel net'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Freelance', 800.00, 'income', 'fixed', 'Revenus complémentaires'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Loyer', 1200.00, 'expense', 'fixed', 'Loyer appartement'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Assurance habitation', 25.00, 'expense', 'fixed', 'Assurance logement'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Internet', 39.99, 'expense', 'fixed', 'Fibre optique'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Mobile', 15.99, 'expense', 'fixed', 'Forfait téléphone'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Électricité', 85.00, 'expense', 'fixed', 'EDF'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Transport', 75.00, 'expense', 'fixed', 'Navigo'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Courses', 400.00, 'expense', 'fixed', 'Alimentation et produits ménagers'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Restaurants', 150.00, 'expense', 'fixed', 'Sorties restaurant'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Loisirs', 100.00, 'expense', 'fixed', 'Cinéma, sorties, etc.'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Shopping', 200.00, 'expense', 'fixed', 'Vêtements et accessoires'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Épargne mensuelle', 500.00, 'saving', 'fixed', 'Livret A'),
  ('48e9c2c7-7407-440f-9031-628468600812', 'Épargne vacances', 200.00, 'saving', 'fixed', 'Projet vacances été');

-- Template 2 ID: 9b207572-c247-4934-8c89-215886292354
INSERT INTO public.template (id, user_id, name, description, is_default)
VALUES (
  '9b207572-c247-4934-8c89-215886292354',
  '8f6deafb-a539-458d-ab76-97a0f441bfe2',
  'Budget Étudiant',
  'Template adapté pour un budget étudiant serré',
  false
);

-- Template 2 Lines
INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, description)
VALUES
  ('9b207572-c247-4934-8c89-215886292354', 'Bourse CROUS', 550.00, 'income', 'fixed', 'Bourse échelon 5'),
  ('9b207572-c247-4934-8c89-215886292354', 'Job étudiant', 400.00, 'income', 'fixed', '10h/semaine'),
  ('9b207572-c247-4934-8c89-215886292354', 'Aide parents', 200.00, 'income', 'fixed', 'Aide familiale'),
  ('9b207572-c247-4934-8c89-215886292354', 'Logement CROUS', 250.00, 'expense', 'fixed', 'Chambre universitaire'),
  ('9b207572-c247-4934-8c89-215886292354', 'Resto U', 150.00, 'expense', 'fixed', 'Repas universitaires'),
  ('9b207572-c247-4934-8c89-215886292354', 'Courses', 200.00, 'expense', 'fixed', 'Alimentation'),
  ('9b207572-c247-4934-8c89-215886292354', 'Transport', 25.00, 'expense', 'fixed', 'Abonnement bus'),
  ('9b207572-c247-4934-8c89-215886292354', 'Fournitures', 50.00, 'expense', 'fixed', 'Matériel scolaire'),
  ('9b207572-c247-4934-8c89-215886292354', 'Téléphone', 9.99, 'expense', 'fixed', 'Forfait 20Go'),
  ('9b207572-c247-4934-8c89-215886292354', 'Sorties', 80.00, 'expense', 'fixed', 'Loisirs étudiants'),
  ('9b207572-c247-4934-8c89-215886292354', 'Épargne', 50.00, 'saving', 'fixed', 'Économies');

-- =====================================================
-- 3. CREATE SAVINGS GOALS
-- =====================================================
INSERT INTO public.savings_goal (id, user_id, name, target_amount, target_date, priority, status)
VALUES
  ('7e054665-6625-47e1-9038-038740523098', '8f6deafb-a539-458d-ab76-97a0f441bfe2',
   'Vacances Japon', 3000.00, '2025-07-01', 'HIGH', 'ACTIVE'),
  ('063229da-41b1-4c1d-910f-614051052219', '8f6deafb-a539-458d-ab76-97a0f441bfe2',
   'MacBook Pro', 2500.00, '2025-03-01', 'MEDIUM', 'ACTIVE'),
  ('e1008064-a63e-4d40-b461-125021200155', '8f6deafb-a539-458d-ab76-97a0f441bfe2',
   'Fond d''urgence', 5000.00, '2025-12-31', 'HIGH', 'ACTIVE');

-- =====================================================
-- 4. CREATE MONTHLY BUDGETS
-- =====================================================
-- Note: Les IDs ci-dessous sont tous validés v4 (le 13ème caractère est '4', le 17ème est '8', '9', 'a', ou 'b')

-- Jan 2025: 1121855a-e71c-4339-a86d-f0940552467d
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES ('1121855a-e71c-4339-a86d-f0940552467d', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 1, 2025, 'Budget de janvier');

-- Feb 2025: 86e96901-2e6f-4078-bb34-31e0c24209c1
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES ('86e96901-2e6f-4078-bb34-31e0c24209c1', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 2, 2025, 'Budget de février');

-- Janvier & Février Lines
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT '1121855a-e71c-4339-a86d-f0940552467d', tl.id, tl.name, tl.amount, tl.kind, tl.recurrence FROM public.template_line tl WHERE tl.template_id = '48e9c2c7-7407-440f-9031-628468600812';
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT '86e96901-2e6f-4078-bb34-31e0c24209c1', tl.id, tl.name, tl.amount, tl.kind, tl.recurrence FROM public.template_line tl WHERE tl.template_id = '48e9c2c7-7407-440f-9031-628468600812';

-- Budgets Mars à Décembre 2025
-- IDs validés v4
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES
  ('c468673a-4467-4286-938b-d70314227891', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 3, 2025, 'Budget mars'),
  ('d179784b-5578-4397-a49c-e81425338902', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 4, 2025, 'Budget avril'),
  ('e280895c-6689-4408-b5ad-f92536449013', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 5, 2025, 'Budget mai'),
  ('f391906d-7790-4519-86be-0a3647550124', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 6, 2025, 'Budget juin'),
  ('04a2017e-8801-4620-97cf-1b4758661235', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 7, 2025, 'Budget juillet'),
  ('15b3128f-9912-4731-a8d0-2c5869772346', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 8, 2025, 'Budget août'),
  ('26c42390-0023-4842-b9e1-3d6970883457', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 9, 2025, 'Budget septembre'),
  ('37d53401-1134-4953-8af2-4e7081994568', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 10, 2025, 'Budget octobre'),
  ('48e64512-2245-4a64-9b03-5f8192005679', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 11, 2025, 'Budget novembre'),
  ('59f75623-3356-4b75-ac14-609203116780', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 12, 2025, 'Budget décembre');

-- Lines for Mars-Dec 2025
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT budget.id::uuid, tl.id, tl.name, tl.amount, tl.kind, tl.recurrence
FROM public.template_line tl
CROSS JOIN (
  VALUES
    ('c468673a-4467-4286-938b-d70314227891'),
    ('d179784b-5578-4397-a49c-e81425338902'),
    ('e280895c-6689-4408-b5ad-f92536449013'),
    ('f391906d-7790-4519-86be-0a3647550124'),
    ('04a2017e-8801-4620-97cf-1b4758661235'),
    ('15b3128f-9912-4731-a8d0-2c5869772346'),
    ('26c42390-0023-4842-b9e1-3d6970883457'),
    ('37d53401-1134-4953-8af2-4e7081994568'),
    ('48e64512-2245-4a64-9b03-5f8192005679'),
    ('59f75623-3356-4b75-ac14-609203116780')
) AS budget(id)
WHERE tl.template_id = '48e9c2c7-7407-440f-9031-628468600812';

-- Budgets 2026 (Jan-Dec) - IDs validés v4
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES
  ('6a086734-4467-4c86-8d25-710314227891', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 1, 2026, 'Budget janvier 2026'),
  ('7b197845-5578-4d97-9e36-821425338902', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 2, 2026, 'Budget février 2026'),
  ('8c2a8956-6689-4e08-af47-932536449013', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 3, 2026, 'Budget mars 2026'),
  ('9d3b9067-7790-4f19-b058-a43647550124', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 4, 2026, 'Budget avril 2026'),
  ('ae4c0178-8801-4020-8169-b54758661235', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 5, 2026, 'Budget mai 2026'),
  ('bf5d1289-9912-4131-927a-c65869772346', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 6, 2026, 'Budget juin 2026'),
  ('c06e2390-0023-4242-a38b-d76970883457', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 7, 2026, 'Budget juillet 2026'),
  ('d17f3401-1134-4353-b49c-e87081994568', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 8, 2026, 'Budget août 2026'),
  ('e2804512-2245-4464-85ad-f98192005679', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 9, 2026, 'Budget septembre 2026'),
  ('f3915623-3356-4575-96be-0a9203116780', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 10, 2026, 'Budget octobre 2026'),
  ('04a26734-4467-4686-a7cf-1ba314227891', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 11, 2026, 'Budget novembre 2026'),
  ('15b37845-5578-4797-b8d0-2cb425338902', '8f6deafb-a539-458d-ab76-97a0f441bfe2', '48e9c2c7-7407-440f-9031-628468600812', 12, 2026, 'Budget décembre 2026');

-- Lines 2026
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT budget.id::uuid, tl.id, tl.name, CASE WHEN tl.kind = 'income' THEN ROUND(tl.amount * 1.02, 2) ELSE ROUND(tl.amount * 1.02, 2) END, tl.kind, tl.recurrence
FROM public.template_line tl
CROSS JOIN (
  VALUES
  ('6a086734-4467-4c86-8d25-710314227891'), ('7b197845-5578-4d97-9e36-821425338902'), ('8c2a8956-6689-4e08-af47-932536449013'),
  ('9d3b9067-7790-4f19-b058-a43647550124'), ('ae4c0178-8801-4020-8169-b54758661235'), ('bf5d1289-9912-4131-927a-c65869772346'),
  ('c06e2390-0023-4242-a38b-d76970883457'), ('d17f3401-1134-4353-b49c-e87081994568'), ('e2804512-2245-4464-85ad-f98192005679'),
  ('f3915623-3356-4575-96be-0a9203116780'), ('04a26734-4467-4686-a7cf-1ba314227891'), ('15b37845-5578-4797-b8d0-2cb425338902')
) AS budget(id)
WHERE tl.template_id = '48e9c2c7-7407-440f-9031-628468600812';

-- =====================================================
-- 5. CREATE TRANSACTIONS
-- =====================================================

-- Jan 2025 (ID: 1121855a-e71c-4339-a86d-f0940552467d)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('1121855a-e71c-4339-a86d-f0940552467d', 'Salaire Janvier', 3500.00, 'income', '2025-01-05 09:00:00', 'Salaire'),
  ('1121855a-e71c-4339-a86d-f0940552467d', 'Projet freelance', 450.00, 'income', '2025-01-12 14:30:00', 'Freelance'),
  ('1121855a-e71c-4339-a86d-f0940552467d', 'Loyer Janvier', 1200.00, 'expense', '2025-01-01 08:00:00', 'Logement'),
  ('1121855a-e71c-4339-a86d-f0940552467d', 'Carrefour', 87.42, 'expense', '2025-01-02 18:30:00', 'Alimentation'),
  ('1121855a-e71c-4339-a86d-f0940552467d', 'Virement Livret A', 500.00, 'saving', '2025-01-05 10:00:00', 'Épargne');

-- Feb 2025 (ID: 86e96901-2e6f-4078-bb34-31e0c24209c1)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('86e96901-2e6f-4078-bb34-31e0c24209c1', 'Salaire Février', 3500.00, 'income', '2025-02-05 09:00:00', 'Salaire'),
  ('86e96901-2e6f-4078-bb34-31e0c24209c1', 'Loyer Février', 1200.00, 'expense', '2025-02-01 08:00:00', 'Logement'),
  ('86e96901-2e6f-4078-bb34-31e0c24209c1', 'Virement Livret A', 500.00, 'saving', '2025-02-05 10:00:00', 'Épargne');

-- Mars 2025 (ID: c468673a-4467-4286-938b-d70314227891)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('c468673a-4467-4286-938b-d70314227891', 'Salaire Mars', 3500.00, 'income', '2025-03-05 09:00:00', 'Salaire'),
  ('c468673a-4467-4286-938b-d70314227891', 'Loyer Mars', 1200.00, 'expense', '2025-03-01 08:00:00', 'Logement'),
  ('c468673a-4467-4286-938b-d70314227891', 'Virement Livret A', 500.00, 'saving', '2025-03-05 10:00:00', 'Épargne');

-- Avril 2025 (ID: d179784b-5578-4397-a49c-e81425338902)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('d179784b-5578-4397-a49c-e81425338902', 'Salaire Avril', 3500.00, 'income', '2025-04-05 09:00:00', 'Salaire'),
  ('d179784b-5578-4397-a49c-e81425338902', 'Loyer Avril', 1200.00, 'expense', '2025-04-01 08:00:00', 'Logement'),
  ('d179784b-5578-4397-a49c-e81425338902', 'Virement Livret A', 800.00, 'saving', '2025-04-05 10:00:00', 'Épargne');

-- Mai 2025 (ID: e280895c-6689-4408-b5ad-f92536449013)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('e280895c-6689-4408-b5ad-f92536449013', 'Salaire Mai', 3500.00, 'income', '2025-05-05 09:00:00', 'Salaire'),
  ('e280895c-6689-4408-b5ad-f92536449013', 'Loyer Mai', 1200.00, 'expense', '2025-05-01 08:00:00', 'Logement'),
  ('e280895c-6689-4408-b5ad-f92536449013', 'Virement Livret A', 500.00, 'saving', '2025-05-05 10:00:00', 'Épargne');

-- Juin 2025 (ID: f391906d-7790-4519-86be-0a3647550124)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('f391906d-7790-4519-86be-0a3647550124', 'Salaire Juin', 3500.00, 'income', '2025-06-05 09:00:00', 'Salaire'),
  ('f391906d-7790-4519-86be-0a3647550124', 'Loyer Juin', 1200.00, 'expense', '2025-06-01 08:00:00', 'Logement'),
  ('f391906d-7790-4519-86be-0a3647550124', 'Virement Livret A', 500.00, 'saving', '2025-06-05 10:00:00', 'Épargne');

-- Juillet 2025 (ID: 04a2017e-8801-4620-97cf-1b4758661235)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('04a2017e-8801-4620-97cf-1b4758661235', 'Salaire Juillet', 3500.00, 'income', '2025-07-05 09:00:00', 'Salaire'),
  ('04a2017e-8801-4620-97cf-1b4758661235', 'Loyer Juillet', 1200.00, 'expense', '2025-07-01 08:00:00', 'Logement'),
  ('04a2017e-8801-4620-97cf-1b4758661235', 'Vacances Japon', 2000.00, 'expense', '2025-07-15 10:00:00', 'Vacances');

-- Août 2025 (ID: 15b3128f-9912-4731-a8d0-2c5869772346)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('15b3128f-9912-4731-a8d0-2c5869772346', 'Salaire Août', 3500.00, 'income', '2025-08-05 09:00:00', 'Salaire'),
  ('15b3128f-9912-4731-a8d0-2c5869772346', 'Loyer Août', 1200.00, 'expense', '2025-08-01 08:00:00', 'Logement');

-- Septembre 2025 (ID: 26c42390-0023-4842-b9e1-3d6970883457)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('26c42390-0023-4842-b9e1-3d6970883457', 'Salaire Septembre', 3500.00, 'income', '2025-09-05 09:00:00', 'Salaire'),
  ('26c42390-0023-4842-b9e1-3d6970883457', 'Loyer Septembre', 1200.00, 'expense', '2025-09-01 08:00:00', 'Logement'),
  ('26c42390-0023-4842-b9e1-3d6970883457', 'Fournitures', 100.00, 'expense', '2025-09-05 14:00:00', 'Divers');

-- Octobre 2025 (ID: 37d53401-1134-4953-8af2-4e7081994568)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('37d53401-1134-4953-8af2-4e7081994568', 'Salaire Octobre', 3500.00, 'income', '2025-10-05 09:00:00', 'Salaire'),
  ('37d53401-1134-4953-8af2-4e7081994568', 'Loyer Octobre', 1200.00, 'expense', '2025-10-01 08:00:00', 'Logement');

-- Novembre 2025 (ID: 48e64512-2245-4a64-9b03-5f8192005679)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('48e64512-2245-4a64-9b03-5f8192005679', 'Salaire Novembre', 3500.00, 'income', '2025-11-05 09:00:00', 'Salaire'),
  ('48e64512-2245-4a64-9b03-5f8192005679', 'Loyer Novembre', 1200.00, 'expense', '2025-11-01 08:00:00', 'Logement');

-- Décembre 2025 (ID: 59f75623-3356-4b75-ac14-609203116780)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('59f75623-3356-4b75-ac14-609203116780', 'Salaire Décembre', 3500.00, 'income', '2025-12-05 09:00:00', 'Salaire'),
  ('59f75623-3356-4b75-ac14-609203116780', 'Loyer Décembre', 1200.00, 'expense', '2025-12-01 08:00:00', 'Logement'),
  ('59f75623-3356-4b75-ac14-609203116780', 'Cadeaux Noël', 500.00, 'expense', '2025-12-15 10:00:00', 'Cadeaux');

-- Janvier 2026 (ID: 6a086734-4467-4c86-8d25-710314227891)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('6a086734-4467-4c86-8d25-710314227891', 'Salaire Janvier 2026', 3570.00, 'income', '2026-01-05 09:00:00', 'Salaire'),
  ('6a086734-4467-4c86-8d25-710314227891', 'Loyer Janvier 2026', 1224.00, 'expense', '2026-01-01 08:00:00', 'Logement');

-- Juin 2026 (ID: bf5d1289-9912-4131-927a-c65869772346)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('bf5d1289-9912-4131-927a-c65869772346', 'Salaire Juin 2026', 3570.00, 'income', '2026-06-05 09:00:00', 'Salaire'),
  ('bf5d1289-9912-4131-927a-c65869772346', 'Loyer Juin 2026', 1224.00, 'expense', '2026-06-01 08:00:00', 'Logement');

-- Décembre 2026 (ID: 15b37845-5578-4797-b8d0-2cb425338902)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('15b37845-5578-4797-b8d0-2cb425338902', 'Salaire Décembre 2026', 3570.00, 'income', '2026-12-05 09:00:00', 'Salaire'),
  ('15b37845-5578-4797-b8d0-2cb425338902', 'Loyer Décembre 2026', 1224.00, 'expense', '2026-12-01 08:00:00', 'Logement');

-- =====================================================
-- 6. LOG SUMMARY
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== SEED DATA CREATED SUCCESSFULLY (STRICT V4 UUIDs) ===';
END $$;