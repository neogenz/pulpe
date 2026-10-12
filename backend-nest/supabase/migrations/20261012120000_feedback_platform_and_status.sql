-- pulpe:migration-phase contract
-- pulpe:safe-after v0.51.1
-- Feedback now comes from the web too, and both clients ask whether the account
-- already answered before inviting again.
--
-- Contract because `ios_version` loses NOT NULL. Every deployed iOS build still
-- sends it; only web rows leave it empty, and the check keeps it required on iOS.

ALTER TABLE public.user_feedback
  ADD COLUMN platform text NOT NULL DEFAULT 'ios'
    CHECK (platform IN ('ios', 'web')),
  ALTER COLUMN ios_version DROP NOT NULL,
  ADD CONSTRAINT user_feedback_ios_version_required
    CHECK (platform <> 'ios' OR ios_version IS NOT NULL);

-- Reading stays closed: an account may only learn that its own rows exist.
-- `user_id` is the one readable column, so the comment and ratings never come
-- back through the client API.
GRANT SELECT (user_id) ON public.user_feedback TO authenticated;

CREATE POLICY "Users can see whether they submitted feedback"
  ON public.user_feedback
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
