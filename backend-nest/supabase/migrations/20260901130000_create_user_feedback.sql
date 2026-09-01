-- Private in-app feedback is write-only for authenticated clients. Reading and
-- moderation stay on trusted server tooling, outside the mobile API surface.

CREATE TABLE public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_rating smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  onboarding smallint CHECK (onboarding BETWEEN 1 AND 5),
  budget_clarity smallint CHECK (budget_clarity BETWEEN 1 AND 5),
  current_month smallint CHECK (current_month BETWEEN 1 AND 5),
  future_planning smallint CHECK (future_planning BETWEEN 1 AND 5),
  home_clarity smallint CHECK (home_clarity BETWEEN 1 AND 5),
  other smallint CHECK (other BETWEEN 1 AND 5),
  -- Unicode code points, matching Swift `unicodeScalars` and JavaScript string iteration.
  comment text CHECK (comment IS NULL OR char_length(comment) BETWEEN 1 AND 1000),
  app_version text NOT NULL CHECK (char_length(app_version) BETWEEN 1 AND 32),
  ios_version text NOT NULL CHECK (char_length(ios_version) BETWEEN 1 AND 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_feedback_user_created_at_idx
  ON public.user_feedback (user_id, created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_feedback FROM anon, authenticated;
GRANT INSERT ON public.user_feedback TO authenticated;

CREATE POLICY "Users can submit own feedback"
  ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
