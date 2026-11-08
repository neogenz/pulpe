-- pulpe:migration-phase contract
-- pulpe:safe-after v0.59.0
-- Mon patrimoine: create an asset and its first value in one transaction.
--
-- The API wrote the asset, then its first snapshot, and deleted the asset by
-- hand when the second write failed; a failed cleanup left an asset with no
-- value. Both rows now land or neither does. Invoker rights: RLS and the
-- composite foreign keys still decide what the caller may write. The value is
-- the ciphertext the API encrypted. Contract, like the tables it writes: the
-- grant is required and the feature already waits for those migrations.

CREATE OR REPLACE FUNCTION public.create_asset_with_first_snapshot(
  p_category_id uuid,
  p_name text,
  p_currency text,
  p_direction text,
  p_in_pulpe boolean,
  p_value text
)
RETURNS public.asset
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_asset public.asset;
BEGIN
  INSERT INTO public.asset (user_id, category_id, name, currency, direction, in_pulpe)
  VALUES ((SELECT auth.uid()), p_category_id, p_name, p_currency, p_direction, p_in_pulpe)
  RETURNING * INTO v_asset;

  INSERT INTO public.asset_snapshot (user_id, asset_id, value)
  VALUES (v_asset.user_id, v_asset.id, p_value);

  RETURN v_asset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_asset_with_first_snapshot(
  uuid, text, text, text, boolean, text
) TO authenticated;
