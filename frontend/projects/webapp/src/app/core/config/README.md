# Configuration Architecture

Configuration system with build-time generation from environment variables and runtime validation using Zod schemas.

## Quick Start

```typescript
constructor(private config: ApplicationConfiguration) {}

const apiUrl = this.config.backendApiUrl();
const environment = this.config.environment();
```

## Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `PUBLIC_SUPABASE_URL` | `http://localhost:54321` | Supabase API URL |
| `PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase anonymous key |
| `PUBLIC_BACKEND_API_URL` | `http://localhost:3000/api/v1` | Backend API endpoint |
| `PUBLIC_ENVIRONMENT` | `development` | Environment type |

## PostHog Analytics (Optional)

```bash
PUBLIC_POSTHOG_API_KEY=phc_xxxxx                    # Required if enabled
PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com        # PostHog instance
PUBLIC_POSTHOG_ENABLED=true                         # Enable/disable analytics
PUBLIC_POSTHOG_CAPTURE_PAGEVIEWS=true              # Track page views
PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED=false     # Record sessions
PUBLIC_POSTHOG_SAMPLE_RATE=0.1                     # Recording sample rate
```

## Commands

```bash
pnpm run generate:config    # Generate config.json from .env variables
```

## Troubleshooting

- **Config not loading**: Run `pnpm run generate:config` to create config.json
- **Validation errors**: Check `.env` variables against `.env.example`
- **Type errors**: All variables are validated at build and runtime with Zod schemas