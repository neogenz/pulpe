# Release Gate recovery review

## Outcome

The release was recovered forward without reverting application code or mutating Supabase outside the protected production workflow. Maintenance remained fail-closed until migrations, the exact Railway backend, version gates and public checks were verified. Web publication, immutable release evidence and the iOS upload completed successfully.

## Root cause

The production authorization selected the latest Release Gate run and required its optional `pull_requests[]` association. GitHub returned an empty association after merge, while a later failed rerun masked an earlier successful immutable attempt. Authorization therefore failed before migrations and publication despite a valid gate attempt.

## Durable correction

- Bind the production PR to its exact release branch and candidate SHA.
- Discover matching Release Gate runs by workflow path, event, exact branch and exact SHA.
- Query every run attempt and its named job explicitly.
- Accept one exact completed successful attempt even when a later rerun failed.
- Fail closed on missing, ambiguous or unreadable evidence.
- Record the selected run, attempt and job plus the directly verified active Railway deployment in the immutable production proof.
- Verify Railway directly and deploy the exact production commit with `serviceInstanceDeployV2` when the active deployment differs; require the result to be latest and successful before publication.

## Recovery lessons

- Prefer provider-native dry runs and exact sets over rendered-table parsing.
- Keep production database writes exclusively in the protected workflow.
- Treat maintenance exit as compensable: restore maintenance if any post-exit check fails.
- A provider status mirrored into GitHub is not sufficient evidence of the active Railway commit.
- Temporary recovery branches and environment policies must be narrowly scoped and removed only after web and iOS completion. The recovery branch and its temporary iOS deployment policy were confirmed absent after completion.

## Release Please comparison

ScreenForge offers a simpler model: one Release Please PR creates an immutable tag and GitHub Release, and the tag starts a secretless validation job before the protected production deployment. This removes the need to reconstruct a PR association from `workflow_run` metadata. Its tag provenance check, pinned actions, short-lived GitHub App token, exact staged Vercel build promotion and separation between validation and production secrets are patterns worth retaining.

It is not a drop-in replacement for Pulpe. Pulpe promotes one candidate through `preview` and `main`, applies Supabase migrations, deploys Railway and distributes a separately versioned iOS build. Release Please would not have prevented the skipped Railway deployment, migration recovery, maintenance window or iOS coordination. ScreenForge's Release Please workflow is also not yet proven end to end: at review time it had no release PR, tag, GitHub Release or production deployment run.

Replacing Pulpe's release topology during incident remediation would add risk. Keep this corrective PR focused on exact evidence and provider verification; evaluate Release Please later in a dedicated spike that must preserve the preview-tested candidate, protected database writes, independent iOS versioning and human production approval.

## Verification contract

The CI security tests reject a return to `pull_requests[]` correlation, exercise a successful historical attempt followed by a failed rerun, fail closed on ambiguous named jobs or branch drift, require attempts and attempt-job endpoints, and check direct Railway commit verification. The release skill, deployment guide and AIDD deployment/VCS memory carry the same procedure.
