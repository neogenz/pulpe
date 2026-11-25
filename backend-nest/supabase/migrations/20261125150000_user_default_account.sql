-- pulpe:migration-phase contract
-- pulpe:safe-after v0.66.2
-- Mon patrimoine (PUL-378): the default account, the asset a movement created
-- without naming an account is attached to. One row per user, none when there
-- is no default.
--
-- Contract only because the foreign keys are inline and the trigger function is
-- revoked, which the expand checker refuses; nothing deployed reads the table.
--
-- Deleting the asset clears the setting through the composite foreign key
-- (which also keeps another user's asset out); archiving it clears the setting
-- through a trigger. Unarchiving does not bring it back (CA35).

CREATE TABLE public.user_default_account (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (asset_id, user_id)
    REFERENCES public.asset (id, user_id) ON DELETE CASCADE
);

CREATE INDEX user_default_account_asset_id_user_id_idx
  ON public.user_default_account (asset_id, user_id);

CREATE TRIGGER update_user_default_account_updated_at
  BEFORE UPDATE ON public.user_default_account
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_default_account ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own default account"
  ON public.user_default_account
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own default account"
  ON public.user_default_account
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own default account"
  ON public.user_default_account
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own default account"
  ON public.user_default_account
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.user_default_account FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_default_account TO authenticated;

-- Invoker rights: the owner archiving their asset may delete their own row.
CREATE OR REPLACE FUNCTION public.clear_default_account_on_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.user_default_account d
  WHERE d.asset_id = NEW.id
    AND d.user_id = NEW.user_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_default_account_on_archive()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER clear_default_account_on_archive
  AFTER UPDATE OF archived_at ON public.asset
  FOR EACH ROW
  WHEN (NEW.archived_at IS NOT NULL)
  EXECUTE FUNCTION public.clear_default_account_on_archive();
