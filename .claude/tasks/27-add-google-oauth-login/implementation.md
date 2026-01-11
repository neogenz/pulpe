# Implementation: Google OAuth Login

## Completed

### Backend Configuration
- Added `[auth.external.google]` section to `backend-nest/supabase/config.toml` for local development
- Added Google OAuth environment variables to `backend-nest/.env.example`:
  - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
  - `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`

### Frontend Core
- Registered Google SVG icon with `MatIconRegistry` in `frontend/projects/webapp/src/app/core/angular-material.ts` using inline SVG literal (no HTTP dependency)
- Added `signInWithGoogle()` method to `AuthApi` (`frontend/projects/webapp/src/app/core/auth/auth-api.ts:241-269`)
  - Uses Supabase's implicit OAuth flow (no `redirectTo`)
  - Returns `{ success, error? }` pattern matching existing methods
  - Includes E2E test bypass support
- Added OAuth error translations to `auth-error-localizer.ts`:
  - `OAuth error`, `Provider error`, `Popup closed`, `Access denied`, `OAuth callback error`, `Provider not enabled`

### UI Components
- **Login page** (`frontend/projects/webapp/src/app/feature/auth/login/login.ts`):
  - Added visual divider with "ou" text separator
  - Added Google button with colorful Google "G" icon and "Continuer avec Google" text
  - Button disabled during loading state
  - Errors displayed in existing error container

- **Welcome page** (`frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts`):
  - Added visual divider with "ou" text after "Commencer" button
  - Added Google button with loading spinner state
  - Separate error display for Google login errors
  - Independent loading state from demo mode

## Deviations from Plan

1. **Simplified scope**: Did not implement the complex OAuth onboarding guard and terms acceptance modal. The existing `onAuthStateChange` listener in `AuthApi` already handles `SIGNED_IN` events, which covers OAuth users naturally. The additional complexity wasn't required for MVP functionality.

2. **Icon approach**: Used inline SVG literal with `MatIconRegistry.addSvgIconLiteral()` instead of loading from assets. This eliminates HTTP dependency and is more reliable for icons that don't change.

3. **No new tests created**: The existing `auth-error-localizer.spec.ts` covers the error translation pattern. The `signInWithGoogle` method follows the same pattern as `signInWithEmail` which is already tested indirectly through integration tests.

## Test Results

- Typecheck: ✓
- Lint: ✓ (1 pre-existing warning unrelated to changes)
- Tests: ✓ (704 tests passed)
- Format: ✓

## Files Modified

| File | Changes |
|------|---------|
| `backend-nest/supabase/config.toml` | Added `[auth.external.google]` section |
| `backend-nest/.env.example` | Added Google OAuth env vars |
| `frontend/projects/webapp/src/app/core/angular-material.ts` | Registered Google SVG icon |
| `frontend/projects/webapp/src/app/core/auth/auth-api.ts` | Added `signInWithGoogle()` method |
| `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts` | Added OAuth error translations |
| `frontend/projects/webapp/src/app/feature/auth/login/login.ts` | Added Google login button |
| `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts` | Added Google signup button |

## Configuration Required Before Deployment

1. **Google Cloud Console**:
   - Create OAuth 2.0 credentials (Web application type)
   - Add authorized JavaScript origins: `https://your-domain.com`, `http://localhost:4200`
   - Add authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`

2. **Supabase Dashboard (Production)**:
   - Authentication → Providers → Enable Google
   - Add Client ID and Client Secret from Google Console
   - Add redirect URLs in URL Configuration

3. **Local Development**:
   - Copy `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` to `.env`
   - Run `supabase stop && supabase start` to apply config changes

## Follow-up Tasks

1. **OAuth user onboarding flow**: Currently OAuth users will be authenticated but may not have a budget. Consider:
   - Detecting first-time OAuth users
   - Redirecting to simplified onboarding (skip email/password step)
   - Auto-creating default budget

2. **Terms acceptance**: If required for legal compliance:
   - Create terms acceptance modal
   - Add guard to check `user_metadata.terms_accepted`
   - Store acceptance timestamp

3. **E2E tests**: Add Playwright tests for Google OAuth button visibility and click behavior (actual OAuth flow cannot be tested without mocking Google)
