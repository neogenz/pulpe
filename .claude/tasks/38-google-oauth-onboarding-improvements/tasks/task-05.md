# Task: Complete Profile Analytics

## Problem

No visibility into the complete-profile funnel conversion. We need to track:
- When users complete each step of profile setup
- When users create their first budget (distinguishing Google vs email signup)
- What optional charges users fill in

## Proposed Solution

Add PostHog analytics tracking:
1. In store: `first_budget_created` event with signup method, pay_day presence, and charges count
2. In page: Step completion events (`profile_step1_completed`, `profile_step2_completed/skipped`)
3. Helper methods to determine signup method and count optional charges

## Dependencies

- Task 2: Profile Prefill from OAuth Metadata (builds on same files)

## Context

- Store: `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts`
- Page: `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`
- Determine signup method by checking `AuthApi.getOAuthUserMetadata()` presence
- Optional charges: housing, health, phone, transport, leasing
- First-time vs returning: `first_budget_created` only fires when budget created (returning users redirected earlier)

## Success Criteria

- `first_budget_created` event captures signup_method, has_pay_day, charges_count
- Step completion events fire at correct moments
- `profile_step2_skipped` fires when all optional charges are null/zero
- Unit tests mock PostHogService and verify all event captures
