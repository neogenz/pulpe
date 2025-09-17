# Configuration Architecture

Configuration management system with build-time generation and runtime validation using Zod schemas.

## Quick Start

```typescript
// Inject the configuration service
constructor(private config: ApplicationConfiguration) {}

// Access configuration values
const supabaseUrl = this.config.supabaseUrl();
const apiUrl = this.config.backendApiUrl();
const environment = this.config.environment();
```

## Architecture

### Build-time Generation

1. **Load environment variables** from `.env` files or `process.env`
2. **Validate with EnvSchema** (string → native types transformation)
3. **Transform structure** via `envToConfig()` (flat → nested)
4. **Validate with ConfigSchema** (final structure verification)
5. **Generate `config.json`** in public directory

Script: `frontend/scripts/generate-config.ts`

### Runtime Loading

1. **HTTP GET** `/config.json` when application starts
2. **Validate with ConfigSchema** (integrity protection)
3. **Store in Angular signals** for reactive access
4. **Apply configuration** to application services

Service: `ApplicationConfiguration`

## Environment Sources

| Environment | Source | Versioned | Purpose |
|---|---|---|---|
| Development | `.env` | No | Local development variables |
| E2E Tests | `.env.e2e` | Yes | Mock values for reproducible tests |
| CI/CD | `.env.e2e` | Yes | GitHub Actions automated testing |
| Production | Vercel Dashboard | No | Production variables injected by platform |

## Configuration Schema

### Required Variables

```bash
# Supabase
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Backend API
PUBLIC_BACKEND_API_URL=https://api.example.com/api/v1

# PostHog Analytics
PUBLIC_POSTHOG_API_KEY=phc_xxxxx
PUBLIC_POSTHOG_HOST=https://eu.posthog.com
PUBLIC_POSTHOG_ENABLED=true

# Environment
PUBLIC_ENVIRONMENT=production
```

### Generated Structure

```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anonKey": "eyJhbGciOiJIUzI1NiIs..."
  },
  "backend": {
    "apiUrl": "https://api.example.com/api/v1"
  },
  "postHog": {
    "apiKey": "phc_xxxxx",
    "host": "https://eu.posthog.com",
    "enabled": true,
    "sessionRecording": {
      "enabled": false,
      "maskInputs": true,
      "sampleRate": 0.1
    }
  },
  "environment": "production"
}
```

## Usage

### In Services

```typescript
@Injectable()
export class MyService {
  constructor(private config: ApplicationConfiguration) {}

  async callApi() {
    const apiUrl = this.config.backendApiUrl();
    return this.http.get(`${apiUrl}/endpoint`);
  }
}
```

### In Components

```typescript
@Component({...})
export class MyComponent {
  private config = inject(ApplicationConfiguration);

  readonly isDevelopment = this.config.isDevelopment;
  readonly postHogConfig = this.config.postHogConfig;
}
```

## Adding New Configuration

1. **Update EnvSchema** in `config.schema.ts`:
```typescript
export const EnvSchema = z.object({
  // ... existing fields
  PUBLIC_NEW_CONFIG: z.string().url(),
});
```

2. **Update envToConfig** transformation:
```typescript
export function envToConfig(env: EnvironmentVariables) {
  return {
    // ... existing fields
    newConfig: env.PUBLIC_NEW_CONFIG,
  };
}
```

3. **Update ConfigSchema**:
```typescript
export const ConfigSchema = z.object({
  // ... existing fields
  newConfig: z.string().url(),
});
```

4. **Add to ApplicationConfiguration** service if needed.

## E2E Testing

Tests automatically use `.env.e2e` through Playwright configuration:

```typescript
// playwright.config.ts
webServer: {
  command: 'DOTENV_CONFIG_PATH=.env.e2e pnpm run start:ci',
  // ...
}
```

This ensures isolated test environments with mock configuration values.

## Security

### Safe to Expose
- Supabase anon key (protected by Row Level Security)
- Backend API URLs
- Environment names
- PostHog configuration

### Never Expose
- Supabase service role key
- Private API keys
- Database passwords
- JWT secrets

### Validation Features
- **Triple validation**: Build-time (2x) + Runtime (1x)
- **URL sanitization** before application use
- **Type safety** with Zod schemas
- **Fail-fast** approach without fallbacks

## Troubleshooting

### Config Not Loading
- Check network tab for 404 on `/config.json`
- Verify file exists in public directory
- Run `pnpm run generate:config` manually

### Validation Errors
- Check console for Zod validation errors
- Ensure all required environment variables are set
- Verify variable formats match schema requirements

### Type Errors
- Run `pnpm run type-check`
- Types are auto-generated from Zod schemas
- Check imports from proper modules

## File Structure

```
core/config/
├── README.md                    # This documentation
├── application-configuration.ts # Main service
├── config.schema.ts            # Zod schemas and transformations
└── types.ts                    # TypeScript types (if needed)
```