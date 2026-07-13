# Auth

## Authentication
- Supabase Auth issues JWTs for email/password and Google; iOS also supports Apple. Protected controllers validate bearer identity through `AuthGuard`.

## Authorization
- No application RBAC: controller guards plus Supabase RLS/RPC ownership checks isolate users.
- `X-Client-Key` is encryption material, not identity; selected encryption key-lifecycle endpoints opt out via `@SkipClientKey` in `encryption.controller.ts`.

## Sessions
- Backend is stateless and validates each request; clients persist/refresh sessions. iOS adds PIN/biometric locking and device-only Keychain storage.
- Production provider and token settings are dashboard-managed; repo config describes local Supabase only.
