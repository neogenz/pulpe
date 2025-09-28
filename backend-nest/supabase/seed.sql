-- =====================================================
-- SEED DATA FOR LOCAL DEVELOPMENT
-- =====================================================
-- This file populates the database with test data for development
-- Test user credentials: maxime.desogus@gmail.com / 12345678

-- Clean up existing test data (optional - comment out if you want to keep existing data)
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
-- Create test user
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
    '11111111-1111-1111-1111-111111111111',
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
    '11111111-1111-1111-1111-111111111111',
    format('{"sub":"%s","email":"%s"}', '11111111-1111-1111-1111-111111111111', 'maxime.desogus@gmail.com')::jsonb,
    'email',
    current_timestamp,
    current_timestamp,
    current_timestamp
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- =====================================================
-- 2. CREATE TEMPLATES
-- =====================================================

-- Template 1: Budget Mensuel Standard
INSERT INTO public.template (id, user_id, name, description, is_default)
VALUES (
  'aaaa1111-aaaa-1111-aaaa-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Budget Mensuel Standard',
  'Template de base pour un budget mensuel équilibré',
  true
);

-- Template 1 Lines
INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, description)
VALUES
  -- Revenus
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Salaire', 3500.00, 'income', 'fixed', 'Salaire mensuel net'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Freelance', 800.00, 'income', 'fixed', 'Revenus complémentaires'),

  -- Dépenses fixes
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Loyer', 1200.00, 'expense', 'fixed', 'Loyer appartement'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Assurance habitation', 25.00, 'expense', 'fixed', 'Assurance logement'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Internet', 39.99, 'expense', 'fixed', 'Fibre optique'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Mobile', 15.99, 'expense', 'fixed', 'Forfait téléphone'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Électricité', 85.00, 'expense', 'fixed', 'EDF'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Transport', 75.00, 'expense', 'fixed', 'Navigo'),

  -- Dépenses variables
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Courses', 400.00, 'expense', 'fixed', 'Alimentation et produits ménagers'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Restaurants', 150.00, 'expense', 'fixed', 'Sorties restaurant'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Loisirs', 100.00, 'expense', 'fixed', 'Cinéma, sorties, etc.'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Shopping', 200.00, 'expense', 'fixed', 'Vêtements et accessoires'),

  -- Épargne
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Épargne mensuelle', 500.00, 'saving', 'fixed', 'Livret A'),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'Épargne vacances', 200.00, 'saving', 'fixed', 'Projet vacances été');

-- Template 2: Budget Étudiant
INSERT INTO public.template (id, user_id, name, description, is_default)
VALUES (
  'bbbb2222-bbbb-2222-bbbb-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Budget Étudiant',
  'Template adapté pour un budget étudiant serré',
  false
);

-- Template 2 Lines
INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, description)
VALUES
  -- Revenus
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Bourse CROUS', 550.00, 'income', 'fixed', 'Bourse échelon 5'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Job étudiant', 400.00, 'income', 'fixed', '10h/semaine'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Aide parents', 200.00, 'income', 'fixed', 'Aide familiale'),

  -- Dépenses
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Logement CROUS', 250.00, 'expense', 'fixed', 'Chambre universitaire'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Resto U', 150.00, 'expense', 'fixed', 'Repas universitaires'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Courses', 200.00, 'expense', 'fixed', 'Alimentation'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Transport', 25.00, 'expense', 'fixed', 'Abonnement bus'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Fournitures', 50.00, 'expense', 'fixed', 'Matériel scolaire'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Téléphone', 9.99, 'expense', 'fixed', 'Forfait 20Go'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Sorties', 80.00, 'expense', 'fixed', 'Loisirs étudiants'),

  -- Épargne
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'Épargne', 50.00, 'saving', 'fixed', 'Économies');

-- =====================================================
-- 3. CREATE SAVINGS GOALS
-- =====================================================
INSERT INTO public.savings_goal (id, user_id, name, target_amount, target_date, priority, status)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Vacances Japon', 3000.00, '2025-07-01', 'HIGH', 'ACTIVE'),
  ('aaaaaaaa-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'MacBook Pro', 2500.00, '2025-03-01', 'MEDIUM', 'ACTIVE'),
  ('aaaaaaaa-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Fond d''urgence', 5000.00, '2025-12-31', 'HIGH', 'ACTIVE');

-- =====================================================
-- 4. CREATE MONTHLY BUDGETS
-- =====================================================

-- Budget Janvier 2025
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES (
  '11111111-0001-2025-0001-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'aaaa1111-aaaa-1111-aaaa-111111111111',
  1,
  2025,
  'Budget de janvier - Début d''année'
);

-- Budget Lines for Janvier 2025 (from template)
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT
  '11111111-0001-2025-0001-111111111111',
  tl.id,
  tl.name,
  tl.amount,
  tl.kind,
  tl.recurrence
FROM public.template_line tl
WHERE tl.template_id = 'aaaa1111-aaaa-1111-aaaa-111111111111';

-- Budget Février 2025
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES (
  '11111111-0002-2025-0002-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'aaaa1111-aaaa-1111-aaaa-111111111111',
  2,
  2025,
  'Budget de février'
);

-- Budget Lines for Février 2025
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT
  '11111111-0002-2025-0002-222222222222',
  tl.id,
  tl.name,
  tl.amount,
  tl.kind,
  tl.recurrence
FROM public.template_line tl
WHERE tl.template_id = 'aaaa1111-aaaa-1111-aaaa-111111111111';

-- Budgets pour le reste de 2025 (Mars à Décembre)
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES
  ('11111111-0003-2025-0003-333333333333', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 3, 2025, 'Budget de mars'),
  ('11111111-0004-2025-0004-444444444444', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 4, 2025, 'Budget d''avril'),
  ('11111111-0005-2025-0005-555555555555', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 5, 2025, 'Budget de mai'),
  ('11111111-0006-2025-0006-666666666666', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 6, 2025, 'Budget de juin'),
  ('11111111-0007-2025-0007-777777777777', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 7, 2025, 'Budget de juillet - Vacances'),
  ('11111111-0008-2025-0008-888888888888', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 8, 2025, 'Budget d''août - Vacances'),
  ('11111111-0009-2025-0009-999999999999', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 9, 2025, 'Budget de septembre - Rentrée'),
  ('11111111-0010-2025-0010-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 10, 2025, 'Budget d''octobre'),
  ('11111111-0011-2025-0011-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 11, 2025, 'Budget de novembre'),
  ('11111111-0012-2025-0012-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 12, 2025, 'Budget de décembre - Fêtes');

-- Budget Lines pour Mars à Décembre 2025
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT
  budget.id::uuid,
  tl.id,
  tl.name,
  tl.amount,
  tl.kind,
  tl.recurrence
FROM public.template_line tl
CROSS JOIN (
  VALUES
    ('11111111-0003-2025-0003-333333333333'),
    ('11111111-0004-2025-0004-444444444444'),
    ('11111111-0005-2025-0005-555555555555'),
    ('11111111-0006-2025-0006-666666666666'),
    ('11111111-0007-2025-0007-777777777777'),
    ('11111111-0008-2025-0008-888888888888'),
    ('11111111-0009-2025-0009-999999999999'),
    ('11111111-0010-2025-0010-aaaaaaaaaaaa'),
    ('11111111-0011-2025-0011-bbbbbbbbbbbb'),
    ('11111111-0012-2025-0012-cccccccccccc')
) AS budget(id)
WHERE tl.template_id = 'aaaa1111-aaaa-1111-aaaa-111111111111';

-- =====================================================
-- BUDGETS POUR 2026 (ANNÉE COMPLÈTE)
-- =====================================================

-- Budgets pour 2026 (Janvier à Décembre)
INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES
  ('22222222-0001-2026-0001-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 1, 2026, 'Budget janvier 2026 - Nouvelle année'),
  ('22222222-0002-2026-0002-222222222222', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 2, 2026, 'Budget février 2026'),
  ('22222222-0003-2026-0003-333333333333', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 3, 2026, 'Budget mars 2026'),
  ('22222222-0004-2026-0004-444444444444', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 4, 2026, 'Budget avril 2026'),
  ('22222222-0005-2026-0005-555555555555', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 5, 2026, 'Budget mai 2026'),
  ('22222222-0006-2026-0006-666666666666', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 6, 2026, 'Budget juin 2026'),
  ('22222222-0007-2026-0007-777777777777', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 7, 2026, 'Budget juillet 2026 - Vacances d''été'),
  ('22222222-0008-2026-0008-888888888888', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 8, 2026, 'Budget août 2026 - Vacances'),
  ('22222222-0009-2026-0009-999999999999', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 9, 2026, 'Budget septembre 2026 - Rentrée'),
  ('22222222-0010-2026-0010-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 10, 2026, 'Budget octobre 2026'),
  ('22222222-0011-2026-0011-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 11, 2026, 'Budget novembre 2026'),
  ('22222222-0012-2026-0012-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 12, 2026, 'Budget décembre 2026 - Fêtes de fin d''année');

-- Budget Lines pour 2026 (toute l'année)
INSERT INTO public.budget_line (budget_id, template_line_id, name, amount, kind, recurrence)
SELECT
  budget.id::uuid,
  tl.id,
  tl.name,
  -- Augmentation de 2% pour l'inflation en 2026
  CASE
    WHEN tl.kind = 'income' THEN ROUND(tl.amount * 1.02, 2)
    ELSE ROUND(tl.amount * 1.02, 2)
  END as amount,
  tl.kind,
  tl.recurrence
FROM public.template_line tl
CROSS JOIN (
  VALUES
    ('22222222-0001-2026-0001-111111111111'),
    ('22222222-0002-2026-0002-222222222222'),
    ('22222222-0003-2026-0003-333333333333'),
    ('22222222-0004-2026-0004-444444444444'),
    ('22222222-0005-2026-0005-555555555555'),
    ('22222222-0006-2026-0006-666666666666'),
    ('22222222-0007-2026-0007-777777777777'),
    ('22222222-0008-2026-0008-888888888888'),
    ('22222222-0009-2026-0009-999999999999'),
    ('22222222-0010-2026-0010-aaaaaaaaaaaa'),
    ('22222222-0011-2026-0011-bbbbbbbbbbbb'),
    ('22222222-0012-2026-0012-cccccccccccc')
) AS budget(id)
WHERE tl.template_id = 'aaaa1111-aaaa-1111-aaaa-111111111111';

-- =====================================================
-- 5. CREATE TRANSACTIONS
-- =====================================================

-- Transactions for Janvier 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  -- Revenus
  ('11111111-0001-2025-0001-111111111111', 'Salaire Janvier', 3500.00, 'income', '2025-01-05 09:00:00', 'Salaire'),
  ('11111111-0001-2025-0001-111111111111', 'Projet freelance Site Web', 450.00, 'income', '2025-01-12 14:30:00', 'Freelance'),
  ('11111111-0001-2025-0001-111111111111', 'Projet freelance Logo', 350.00, 'income', '2025-01-20 16:00:00', 'Freelance'),

  -- Dépenses fixes
  ('11111111-0001-2025-0001-111111111111', 'Loyer Janvier', 1200.00, 'expense', '2025-01-01 08:00:00', 'Logement'),
  ('11111111-0001-2025-0001-111111111111', 'Assurance habitation', 25.00, 'expense', '2025-01-03 10:00:00', 'Assurance'),
  ('11111111-0001-2025-0001-111111111111', 'Box Internet', 39.99, 'expense', '2025-01-05 11:00:00', 'Abonnements'),
  ('11111111-0001-2025-0001-111111111111', 'Forfait mobile', 15.99, 'expense', '2025-01-05 11:30:00', 'Abonnements'),
  ('11111111-0001-2025-0001-111111111111', 'EDF', 92.50, 'expense', '2025-01-08 09:00:00', 'Énergie'),
  ('11111111-0001-2025-0001-111111111111', 'Pass Navigo', 75.00, 'expense', '2025-01-01 07:00:00', 'Transport'),

  -- Courses alimentaires
  ('11111111-0001-2025-0001-111111111111', 'Carrefour', 87.42, 'expense', '2025-01-02 18:30:00', 'Alimentation'),
  ('11111111-0001-2025-0001-111111111111', 'Monoprix', 45.20, 'expense', '2025-01-06 19:00:00', 'Alimentation'),
  ('11111111-0001-2025-0001-111111111111', 'Marché', 32.50, 'expense', '2025-01-07 10:30:00', 'Alimentation'),
  ('11111111-0001-2025-0001-111111111111', 'Franprix', 28.90, 'expense', '2025-01-09 20:00:00', 'Alimentation'),
  ('11111111-0001-2025-0001-111111111111', 'Boulangerie', 12.40, 'expense', '2025-01-10 08:00:00', 'Alimentation'),
  ('11111111-0001-2025-0001-111111111111', 'Carrefour', 95.30, 'expense', '2025-01-13 17:45:00', 'Alimentation'),
  ('11111111-0001-2025-0001-111111111111', 'Picard', 42.80, 'expense', '2025-01-15 18:15:00', 'Alimentation'),

  -- Restaurants
  ('11111111-0001-2025-0001-111111111111', 'Restaurant japonais', 35.00, 'expense', '2025-01-08 20:30:00', 'Restaurant'),
  ('11111111-0001-2025-0001-111111111111', 'Pizzeria', 28.50, 'expense', '2025-01-14 19:45:00', 'Restaurant'),
  ('11111111-0001-2025-0001-111111111111', 'Brunch dimanche', 45.00, 'expense', '2025-01-19 11:30:00', 'Restaurant'),

  -- Loisirs
  ('11111111-0001-2025-0001-111111111111', 'Cinéma', 12.90, 'expense', '2025-01-11 21:00:00', 'Loisirs'),
  ('11111111-0001-2025-0001-111111111111', 'Théâtre', 35.00, 'expense', '2025-01-18 20:00:00', 'Loisirs'),
  ('11111111-0001-2025-0001-111111111111', 'Musée', 15.00, 'expense', '2025-01-25 14:00:00', 'Loisirs'),

  -- Shopping
  ('11111111-0001-2025-0001-111111111111', 'H&M - Pull', 29.99, 'expense', '2025-01-04 15:30:00', 'Shopping'),
  ('11111111-0001-2025-0001-111111111111', 'Decathlon - Baskets', 59.99, 'expense', '2025-01-12 16:45:00', 'Shopping'),
  ('11111111-0001-2025-0001-111111111111', 'Zara - Pantalon', 49.99, 'expense', '2025-01-20 17:15:00', 'Shopping'),

  -- Épargne
  ('11111111-0001-2025-0001-111111111111', 'Virement Livret A', 500.00, 'saving', '2025-01-05 10:00:00', 'Épargne'),
  ('11111111-0001-2025-0001-111111111111', 'Épargne vacances', 200.00, 'saving', '2025-01-05 10:15:00', 'Épargne'),

  -- Dépenses imprévues (hors budget)
  ('11111111-0001-2025-0001-111111111111', 'Réparation vélo', 65.00, 'expense', '2025-01-16 14:00:00', 'Divers'),
  ('11111111-0001-2025-0001-111111111111', 'Cadeau anniversaire', 45.00, 'expense', '2025-01-22 18:00:00', 'Cadeaux');

-- Transactions for Février 2025 (moins de transactions pour l'instant)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  -- Revenus
  ('11111111-0002-2025-0002-222222222222', 'Salaire Février', 3500.00, 'income', '2025-02-05 09:00:00', 'Salaire'),

  -- Dépenses fixes
  ('11111111-0002-2025-0002-222222222222', 'Loyer Février', 1200.00, 'expense', '2025-02-01 08:00:00', 'Logement'),
  ('11111111-0002-2025-0002-222222222222', 'Pass Navigo', 75.00, 'expense', '2025-02-01 07:00:00', 'Transport'),
  ('11111111-0002-2025-0002-222222222222', 'Box Internet', 39.99, 'expense', '2025-02-05 11:00:00', 'Abonnements'),
  ('11111111-0002-2025-0002-222222222222', 'Forfait mobile', 15.99, 'expense', '2025-02-05 11:30:00', 'Abonnements'),

  -- Quelques courses
  ('11111111-0002-2025-0002-222222222222', 'Carrefour', 102.30, 'expense', '2025-02-02 18:30:00', 'Alimentation'),
  ('11111111-0002-2025-0002-222222222222', 'Marché', 38.50, 'expense', '2025-02-03 10:30:00', 'Alimentation'),

  -- Épargne
  ('11111111-0002-2025-0002-222222222222', 'Virement Livret A', 500.00, 'saving', '2025-02-05 10:00:00', 'Épargne');

-- Transactions principales pour Mars à Décembre 2025
-- Mars 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0003-2025-0003-333333333333', 'Salaire Mars', 3500.00, 'income', '2025-03-05 09:00:00', 'Salaire'),
  ('11111111-0003-2025-0003-333333333333', 'Loyer Mars', 1200.00, 'expense', '2025-03-01 08:00:00', 'Logement'),
  ('11111111-0003-2025-0003-333333333333', 'Pass Navigo', 75.00, 'expense', '2025-03-01 07:00:00', 'Transport'),
  ('11111111-0003-2025-0003-333333333333', 'Courses Carrefour', 115.50, 'expense', '2025-03-08 18:30:00', 'Alimentation'),
  ('11111111-0003-2025-0003-333333333333', 'Virement Livret A', 500.00, 'saving', '2025-03-05 10:00:00', 'Épargne');

-- Avril 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0004-2025-0004-444444444444', 'Salaire Avril', 3500.00, 'income', '2025-04-05 09:00:00', 'Salaire'),
  ('11111111-0004-2025-0004-444444444444', 'Prime trimestrielle', 1000.00, 'income', '2025-04-10 09:00:00', 'Prime'),
  ('11111111-0004-2025-0004-444444444444', 'Loyer Avril', 1200.00, 'expense', '2025-04-01 08:00:00', 'Logement'),
  ('11111111-0004-2025-0004-444444444444', 'Pass Navigo', 75.00, 'expense', '2025-04-01 07:00:00', 'Transport'),
  ('11111111-0004-2025-0004-444444444444', 'Virement Livret A', 800.00, 'saving', '2025-04-05 10:00:00', 'Épargne');

-- Mai 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0005-2025-0005-555555555555', 'Salaire Mai', 3500.00, 'income', '2025-05-05 09:00:00', 'Salaire'),
  ('11111111-0005-2025-0005-555555555555', 'Loyer Mai', 1200.00, 'expense', '2025-05-01 08:00:00', 'Logement'),
  ('11111111-0005-2025-0005-555555555555', 'Pass Navigo', 75.00, 'expense', '2025-05-01 07:00:00', 'Transport'),
  ('11111111-0005-2025-0005-555555555555', 'Virement Livret A', 500.00, 'saving', '2025-05-05 10:00:00', 'Épargne');

-- Juin 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0006-2025-0006-666666666666', 'Salaire Juin', 3500.00, 'income', '2025-06-05 09:00:00', 'Salaire'),
  ('11111111-0006-2025-0006-666666666666', 'Loyer Juin', 1200.00, 'expense', '2025-06-01 08:00:00', 'Logement'),
  ('11111111-0006-2025-0006-666666666666', 'Pass Navigo', 75.00, 'expense', '2025-06-01 07:00:00', 'Transport'),
  ('11111111-0006-2025-0006-666666666666', 'Virement Livret A', 500.00, 'saving', '2025-06-05 10:00:00', 'Épargne');

-- Juillet 2025 (Vacances)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0007-2025-0007-777777777777', 'Salaire Juillet', 3500.00, 'income', '2025-07-05 09:00:00', 'Salaire'),
  ('11111111-0007-2025-0007-777777777777', 'Loyer Juillet', 1200.00, 'expense', '2025-07-01 08:00:00', 'Logement'),
  ('11111111-0007-2025-0007-777777777777', 'Billets avion Japon', 1200.00, 'expense', '2025-07-03 10:00:00', 'Vacances'),
  ('11111111-0007-2025-0007-777777777777', 'Hôtel Tokyo', 800.00, 'expense', '2025-07-15 16:00:00', 'Vacances'),
  ('11111111-0007-2025-0007-777777777777', 'Virement Livret A', 200.00, 'saving', '2025-07-05 10:00:00', 'Épargne');

-- Août 2025 (Suite vacances)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0008-2025-0008-888888888888', 'Salaire Août', 3500.00, 'income', '2025-08-05 09:00:00', 'Salaire'),
  ('11111111-0008-2025-0008-888888888888', 'Loyer Août', 1200.00, 'expense', '2025-08-01 08:00:00', 'Logement'),
  ('11111111-0008-2025-0008-888888888888', 'Virement Livret A', 500.00, 'saving', '2025-08-05 10:00:00', 'Épargne');

-- Septembre 2025 (Rentrée)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0009-2025-0009-999999999999', 'Salaire Septembre', 3500.00, 'income', '2025-09-05 09:00:00', 'Salaire'),
  ('11111111-0009-2025-0009-999999999999', 'Loyer Septembre', 1200.00, 'expense', '2025-09-01 08:00:00', 'Logement'),
  ('11111111-0009-2025-0009-999999999999', 'Pass Navigo', 75.00, 'expense', '2025-09-01 07:00:00', 'Transport'),
  ('11111111-0009-2025-0009-999999999999', 'Fournitures bureau', 85.00, 'expense', '2025-09-02 14:00:00', 'Bureau'),
  ('11111111-0009-2025-0009-999999999999', 'Virement Livret A', 500.00, 'saving', '2025-09-05 10:00:00', 'Épargne');

-- Octobre 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0010-2025-0010-aaaaaaaaaaaa', 'Salaire Octobre', 3500.00, 'income', '2025-10-05 09:00:00', 'Salaire'),
  ('11111111-0010-2025-0010-aaaaaaaaaaaa', 'Loyer Octobre', 1200.00, 'expense', '2025-10-01 08:00:00', 'Logement'),
  ('11111111-0010-2025-0010-aaaaaaaaaaaa', 'Pass Navigo', 75.00, 'expense', '2025-10-01 07:00:00', 'Transport'),
  ('11111111-0010-2025-0010-aaaaaaaaaaaa', 'Virement Livret A', 500.00, 'saving', '2025-10-05 10:00:00', 'Épargne');

-- Novembre 2025
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0011-2025-0011-bbbbbbbbbbbb', 'Salaire Novembre', 3500.00, 'income', '2025-11-05 09:00:00', 'Salaire'),
  ('11111111-0011-2025-0011-bbbbbbbbbbbb', 'Loyer Novembre', 1200.00, 'expense', '2025-11-01 08:00:00', 'Logement'),
  ('11111111-0011-2025-0011-bbbbbbbbbbbb', 'Pass Navigo', 75.00, 'expense', '2025-11-01 07:00:00', 'Transport'),
  ('11111111-0011-2025-0011-bbbbbbbbbbbb', 'Black Friday Shopping', 250.00, 'expense', '2025-11-28 15:00:00', 'Shopping'),
  ('11111111-0011-2025-0011-bbbbbbbbbbbb', 'Virement Livret A', 500.00, 'saving', '2025-11-05 10:00:00', 'Épargne');

-- Décembre 2025 (Fêtes)
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('11111111-0012-2025-0012-cccccccccccc', 'Salaire Décembre', 3500.00, 'income', '2025-12-05 09:00:00', 'Salaire'),
  ('11111111-0012-2025-0012-cccccccccccc', 'Prime de fin d''année', 2000.00, 'income', '2025-12-20 09:00:00', 'Prime'),
  ('11111111-0012-2025-0012-cccccccccccc', 'Loyer Décembre', 1200.00, 'expense', '2025-12-01 08:00:00', 'Logement'),
  ('11111111-0012-2025-0012-cccccccccccc', 'Pass Navigo', 75.00, 'expense', '2025-12-01 07:00:00', 'Transport'),
  ('11111111-0012-2025-0012-cccccccccccc', 'Cadeaux Noël', 450.00, 'expense', '2025-12-15 16:00:00', 'Cadeaux'),
  ('11111111-0012-2025-0012-cccccccccccc', 'Réveillon', 180.00, 'expense', '2025-12-24 19:00:00', 'Fêtes'),
  ('11111111-0012-2025-0012-cccccccccccc', 'Virement Livret A', 1000.00, 'saving', '2025-12-05 10:00:00', 'Épargne');

-- Transactions principales pour 2026 (quelques transactions pour exemple)
-- Janvier 2026
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('22222222-0001-2026-0001-111111111111', 'Salaire Janvier 2026', 3570.00, 'income', '2026-01-05 09:00:00', 'Salaire'),
  ('22222222-0001-2026-0001-111111111111', 'Loyer Janvier 2026', 1224.00, 'expense', '2026-01-01 08:00:00', 'Logement'),
  ('22222222-0001-2026-0001-111111111111', 'Pass Navigo', 76.50, 'expense', '2026-01-01 07:00:00', 'Transport'),
  ('22222222-0001-2026-0001-111111111111', 'Virement Livret A', 510.00, 'saving', '2026-01-05 10:00:00', 'Épargne');

-- Juin 2026
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('22222222-0006-2026-0006-666666666666', 'Salaire Juin 2026', 3570.00, 'income', '2026-06-05 09:00:00', 'Salaire'),
  ('22222222-0006-2026-0006-666666666666', 'Loyer Juin 2026', 1224.00, 'expense', '2026-06-01 08:00:00', 'Logement'),
  ('22222222-0006-2026-0006-666666666666', 'Virement Livret A', 510.00, 'saving', '2026-06-05 10:00:00', 'Épargne');

-- Décembre 2026
INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, category)
VALUES
  ('22222222-0012-2026-0012-cccccccccccc', 'Salaire Décembre 2026', 3570.00, 'income', '2026-12-05 09:00:00', 'Salaire'),
  ('22222222-0012-2026-0012-cccccccccccc', 'Prime fin d''année 2026', 2040.00, 'income', '2026-12-20 09:00:00', 'Prime'),
  ('22222222-0012-2026-0012-cccccccccccc', 'Loyer Décembre 2026', 1224.00, 'expense', '2026-12-01 08:00:00', 'Logement'),
  ('22222222-0012-2026-0012-cccccccccccc', 'Cadeaux Noël 2026', 500.00, 'expense', '2026-12-18 16:00:00', 'Cadeaux'),
  ('22222222-0012-2026-0012-cccccccccccc', 'Virement Livret A', 1020.00, 'saving', '2026-12-05 10:00:00', 'Épargne');

-- =====================================================
-- 6. LOG SUMMARY
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== SEED DATA CREATED SUCCESSFULLY ===';
  RAISE NOTICE 'User: maxime.desogus@gmail.com / 12345678';
  RAISE NOTICE 'Templates: 2 (Budget Mensuel Standard, Budget Étudiant)';
  RAISE NOTICE 'Savings Goals: 3';
  RAISE NOTICE 'Monthly Budgets: 24 (2025 complet + 2026 complet)';
  RAISE NOTICE 'Transactions: ~100+ (transactions pour tous les mois)';
  RAISE NOTICE '=====================================';
END $$;