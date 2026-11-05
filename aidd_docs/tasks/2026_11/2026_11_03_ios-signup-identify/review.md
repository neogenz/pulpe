# Review: iOS identifies the account at signup

- Rounds: 1
- Started: 2026-11-03

## Round 1 · r-7c3e

- Date: 2026-11-03
- By: Maxime De Sogus
- Diff: `main...9e97789b9`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 5/5 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Every iOS signup path identifies the account with its signup event — `SocialLoginButtons.swift:93`, `SocialLoginButtons.swift:143`, `RegistrationStep.swift:153`, `AnalyticsService.swift:467`
- [x] Person properties keep their rules: blank email dropped, trimmed name, `supabase_user_id`, `early_adopter` — `AnalyticsService.swift:449`
- [x] Post-auth identification still runs, and still skips an expired session — `AppState+Auth.swift:113`
- [x] A test fails when a signup stops identifying the account — `AnalyticsServiceTests.swift:298`
- [x] A real signup creates an identified PostHog person that owns `signup_completed` — run on 9e97789b9, 2026-11-03: email signup on a Local build with PostHog on, one app session; `$identify` 08:08:09.108 then `signup_completed` 08:08:09.114 under the Supabase id, person `is_identified`, pre-signup anonymous events merged in

### Findings

- `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:298` : the name says "before the event" but nothing asserts ordering, only that the account ends up identified → rename to `captureSignupCompleted_newAccount_identifiesTheAccount` — 🟢 minor, standards
- `ios/Pulpe/Core/Analytics/AnalyticsService.swift:449` : the blank-email rule moved here with no test reading the identify payload, and the cached identity is private → cover it if the payload gets a test seam — 🟢 minor, code-health
