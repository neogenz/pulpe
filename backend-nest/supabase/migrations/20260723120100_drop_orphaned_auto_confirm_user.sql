-- Security audit 2026-07-23 — remove the orphaned auto_confirm_user().
--
-- The function was created by 20250812050259 but no CREATE TRIGGER in this
-- repo ever attaches it: live signup auto-confirmation comes from the Auth
-- setting mailer_autoconfirm, not from this code. Deliberately NO CASCADE — if
-- a manually-created trigger depends on it in some environment, this migration
-- fails loudly (investigate that trigger first) instead of silently breaking
-- user inserts.

DROP FUNCTION IF EXISTS public.auto_confirm_user();
