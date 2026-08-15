-- Product locale is application data, not authentication metadata.
-- One row per user keeps the preference owner-scoped and independently mutable.

CREATE TABLE public.user_locale_preference (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale text NOT NULL
    CHECK (locale IN ('fr', 'en', 'de', 'it')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_user_locale_preference_updated_at
  BEFORE UPDATE ON public.user_locale_preference
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_locale_preference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own locale preference"
  ON public.user_locale_preference
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own locale preference"
  ON public.user_locale_preference
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own locale preference"
  ON public.user_locale_preference
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.user_locale_preference FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE
  ON public.user_locale_preference TO authenticated;

-- Preserve preferences written by an earlier version of the i18n branch.
INSERT INTO public.user_locale_preference (user_id, locale)
SELECT id, raw_user_meta_data->>'locale'
FROM auth.users
WHERE raw_user_meta_data->>'locale' IN ('fr', 'en', 'de', 'it')
ON CONFLICT (user_id) DO NOTHING;
