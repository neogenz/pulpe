-- pulpe:migration-phase contract
-- pulpe:safe-after v0.60.0
-- Feedback now comes from the Android app too. Until now it had to label itself
-- `web`, the only value that needs no iOS version, so its rows could not be
-- told apart from the webapp's.
--
-- Contract because replacing a check drops the old one. The new one only
-- widens what is accepted: every row and every deployed client still passes.

ALTER TABLE public.user_feedback
  DROP CONSTRAINT user_feedback_platform_check,
  ADD CONSTRAINT user_feedback_platform_check
    CHECK (platform IN ('ios', 'web', 'android'));
