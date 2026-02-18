# iOS Environment Configuration

This folder defines runtime app configuration per Xcode build configuration.

## Files

- `Base.xcconfig`: shared defaults
- `Local.xcconfig`: local backend / local Supabase
- `Preview.xcconfig`: preview environment
- `Prod.xcconfig`: production environment

Optional local overrides (not committed):

- `Local.secrets.xcconfig`
- `Preview.secrets.xcconfig`
- `Prod.secrets.xcconfig`

Each environment file includes its optional `*.secrets.xcconfig` using:

```xcconfig
#include? "Local.secrets.xcconfig"
```

## Exposed keys (safe for client app)

- `APP_ENV`
- `API_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Never put in iOS config

- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_MASTER_KEY`

Those secrets must stay server-side only.
