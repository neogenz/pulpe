-- Ferme l'accès `authenticated` à user_encryption_key.
--
-- 20260212100000 avait ouvert GRANT SELECT (user_id) + UPDATE (key_check,
-- updated_at) à `authenticated` pour que le RPC de rekey, SECURITY INVOKER
-- appelé avec le JWT utilisateur, puisse écrire le canari. Conséquence : un
-- jeton volé pouvait écrire key_check directement via PostgREST et rendre le
-- coffre du propriétaire indéchiffrable.
--
-- Le rekey passe désormais par le service_role, comme tous les autres accès à
-- user_encryption_key (SupabaseEncryptionKeyRepository). Deux surfaces se
-- ferment d'un coup : l'UPDATE direct sur la table, et l'appel forgé du RPC
-- avec un p_key_check arbitraire.
--
-- La fonction reste SECURITY INVOKER : appelée par le service_role elle n'est
-- plus soumise au RLS, donc l'appartenance des lignes n'est plus garantie par
-- les policies. Chaque UPDATE est explicitement borné à p_user_id, et les
-- assertions de nombre de lignes font échouer toute la transaction si le
-- payload contient une ligne qui n'appartient pas à l'utilisateur.

DROP FUNCTION IF EXISTS public.rekey_user_encrypted_data(jsonb, jsonb, jsonb, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data(
  p_user_id uuid,
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb,
  p_key_check text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_rows integer;
  v_expected integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'rekey: p_user_id is required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verrou exclusif sur la ligne de clé : sérialise les rekeys concurrents
  PERFORM 1 FROM public.user_encryption_key
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- budget_line.amount + original_amount (propriété via monthly_budget)
  v_expected := jsonb_array_length(p_budget_lines);
  IF v_expected > 0 THEN
    UPDATE public.budget_line bl
    SET amount = item.amount,
        original_amount = item.original_amount
    FROM jsonb_to_recordset(p_budget_lines) AS item(id uuid, amount text, original_amount text)
    WHERE bl.id = item.id
      AND EXISTS (
        SELECT 1 FROM public.monthly_budget mb
        WHERE mb.id = bl.budget_id AND mb.user_id = p_user_id
      );

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: budget_line expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- transaction.amount + original_amount (propriété via monthly_budget)
  v_expected := jsonb_array_length(p_transactions);
  IF v_expected > 0 THEN
    UPDATE public.transaction t
    SET amount = item.amount,
        original_amount = item.original_amount
    FROM jsonb_to_recordset(p_transactions) AS item(id uuid, amount text, original_amount text)
    WHERE t.id = item.id
      AND EXISTS (
        SELECT 1 FROM public.monthly_budget mb
        WHERE mb.id = t.budget_id AND mb.user_id = p_user_id
      );

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: transaction expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- template_line.amount + original_amount (propriété via template)
  v_expected := jsonb_array_length(p_template_lines);
  IF v_expected > 0 THEN
    UPDATE public.template_line tl
    SET amount = item.amount,
        original_amount = item.original_amount
    FROM jsonb_to_recordset(p_template_lines) AS item(id uuid, amount text, original_amount text)
    WHERE tl.id = item.id
      AND EXISTS (
        SELECT 1 FROM public.template tpl
        WHERE tpl.id = tl.template_id AND tpl.user_id = p_user_id
      );

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: template_line expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- savings_goal.target_amount + original_target_amount + initial_amount
  v_expected := jsonb_array_length(p_savings_goals);
  IF v_expected > 0 THEN
    UPDATE public.savings_goal sg
    SET target_amount = item.target_amount,
        original_target_amount = item.original_target_amount,
        initial_amount = item.initial_amount
    FROM jsonb_to_recordset(p_savings_goals) AS item(id uuid, target_amount text, original_target_amount text, initial_amount text)
    WHERE sg.id = item.id
      AND sg.user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: savings_goal expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- monthly_budget.ending_balance
  v_expected := jsonb_array_length(p_monthly_budgets);
  IF v_expected > 0 THEN
    UPDATE public.monthly_budget mb
    SET ending_balance = item.ending_balance
    FROM jsonb_to_recordset(p_monthly_budgets) AS item(id uuid, ending_balance text)
    WHERE mb.id = item.id
      AND mb.user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: monthly_budget expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- key_check (atomique avec les updates de données ci-dessus)
  IF p_key_check IS NOT NULL THEN
    UPDATE public.user_encryption_key
    SET key_check = p_key_check, updated_at = now()
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'rekey: key_check update expected 1 row, got %', v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

-- Le RPC n'est plus appelable avec un JWT utilisateur
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rekey_user_encrypted_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text) TO service_role;

-- Retour au modèle d'origine (20260129200000) : service_role uniquement
REVOKE ALL ON public.user_encryption_key FROM authenticated;
REVOKE ALL ON public.user_encryption_key FROM anon;
GRANT ALL ON public.user_encryption_key TO service_role;

-- Les policies ouvertes à `authenticated` (20260214140000) deviennent mortes
DROP POLICY IF EXISTS "authenticated_select_own_key" ON public.user_encryption_key;
DROP POLICY IF EXISTS "authenticated_update_own_key_check" ON public.user_encryption_key;
DROP POLICY IF EXISTS "select_policy" ON public.user_encryption_key;
DROP POLICY IF EXISTS "update_policy" ON public.user_encryption_key;

-- Ces deux policies ne sont la barrière de personne, et il faut le savoir avant
-- de s'appuyer dessus. `service_role` porte BYPASSRLS : elles ne sont jamais
-- évaluées pour lui. Et pour tout autre rôle, le `REVOKE ALL` ci-dessus retire
-- le privilège de table, donc l'accès échoue avant même que RLS soit consulté.
-- Vérifié : en rejouant le GRANT de 20260212100000 à `authenticated`, la table
-- renvoie 0 ligne avec ces policies comme sans elles — RLS activé sans aucune
-- policy refuse déjà tout. Ce qui protège la table, c'est le REVOKE, pas ceci.
-- On les garde parce qu'elles écrivent l'intention (service_role uniquement) ;
-- ne pas les compter comme une seconde couche, elles n'en sont pas une.
CREATE POLICY "select_policy" ON public.user_encryption_key
  FOR SELECT
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "update_policy" ON public.user_encryption_key
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
