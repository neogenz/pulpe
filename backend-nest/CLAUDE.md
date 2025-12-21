# CLAUDE.md - Backend (NestJS)

This file provides guidance for Claude Code when working with the NestJS backend API.

## Quick Start Commands

### Development

```bash
bun run dev                    # Start with local Supabase (port 3000)
```

### Building & Testing

```bash
bun run build                  # Production build with minification
bun test                       # Run all tests
bun test:unit                  # Unit tests only
bun test:performance           # Performance tests with metrics
bun test [file.spec.ts]        # Specific test file
```

### Code Quality

```bash
bun run quality                # Type-check + Lint + Format
bun run quality:fix            # Fix auto-fixable issues
```

**BEFORE committing**: Run `bun run quality` to ensure code passes all checks.

### Database

```bash
bun run generate-types:local   # Generate types from local Supabase
```

**AFTER schema changes**: Always regenerate types.

## Module Structure

```
src/modules/[domain]/
├── [domain].controller.ts    # HTTP routes, validation, Swagger docs
├── [domain].service.ts       # Business logic, orchestration
├── [domain].module.ts        # Module configuration, DI setup
├── [domain].mapper.ts        # DTO ↔ Entity transformation
├── dto/                      # Request/Response DTOs with Zod
└── entities/                 # Business entities
```

## Key Architectural Patterns

### Authentication Flow

- **JWT Bearer tokens** validated via Supabase Auth
- **AuthGuard** protects all routes by default
- **@User() decorator** injects authenticated user
- **@SupabaseClient() decorator** provides authenticated DB client
- **Row Level Security (RLS)** enforces data isolation

### Data Validation Pipeline

```
Frontend (Zod) → Backend DTO (createZodDto) → Service → Database (RLS)
```

- Shared schemas from `@pulpe/shared`
- Runtime validation with Zod
- TypeScript strict mode
- Database constraints + RLS policies

### Service Pattern

```typescript
DB Row (snake_case) → Mapper → API Response (camelCase)
```

### Error Handling

- Global exception filter for consistent responses
- Structured logging with Pino
- Request ID tracking for debugging
- Proper HTTP status codes

## Database Architecture

### Supabase Integration

| Feature | Implementation |
|---------|----------------|
| Authentication | Supabase Auth with JWT |
| Database | PostgreSQL with RLS |
| Types | Auto-generated from schema |
| Isolation | `auth.uid()` in RLS policies |

### Key Tables

- `monthly_budget` - User budgets by month/year
- `transaction` - Financial transactions
- `template` - Budget templates (public + private)
- `template_line` - Template transaction items

## Environment Configuration

```env
# Required (.env)
NODE_ENV=development
PORT=3000
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Common Development Tasks

### Adding a New Module

1. Create module structure in `src/modules/[domain]/`
2. Define DTOs using `createZodDto` with shared schemas
3. Implement service with business logic
4. Create controller with guards and decorators
5. Add mapper for data transformation
6. Register module in `app.module.ts`

### Working with Database Types

```typescript
import type { Database } from '../../types/database.types';
type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
```

**AFTER schema changes**: Run `bun run generate-types:local`

### Debugging

- Enable debug logging: `DEBUG_HTTP_FULL=true`
- Swagger docs: `http://localhost:3000/docs`
- Request ID from headers for log correlation

## Logging with Pino

### Configuration

- **Development**: Pretty-printed with `pino-pretty`
- **Production**: JSON structured logs
- **Auto-correlation**: Request IDs propagated automatically

### Usage

```typescript
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(
    @InjectPinoLogger(MyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async doSomething(userId: string) {
    this.logger.info({ userId, operation: 'do_something' }, 'Operation started');
  }
}
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `error` | Server errors (5xx), critical exceptions |
| `warn` | Client errors (4xx), abnormal situations |
| `info` | Business operations, audit, metrics |
| `debug` | Technical details (dev only) |

## Testing

### Unit Tests

- Mock Supabase client for isolated testing
- Use `createMockSupabaseClient()` helper
- Test services and guards independently

### Performance Tests

- Run with `DEBUG_PERFORMANCE=true` for detailed output
- Load testing with metrics
- Response time and memory monitoring

## Important Conventions

### NestJS Best Practices

- Constructor injection for dependencies
- Thin controllers (HTTP only)
- Business logic in services
- Guards for authentication
- Custom decorators for request data

### Type Safety

- TypeScript strict mode enabled (see root CLAUDE.md Critical Rules)
- Validate external data with Zod
- Type guards for runtime checks

### Security

- All routes protected by default
- RLS policies enforce data isolation
- Input validation at multiple layers
- **NEVER** log sensitive data

## Key Files

| Purpose | Path |
|---------|------|
| App module | @src/app.module.ts |
| Environment | @src/config/environment.ts |
| Database types | @src/types/database.types.ts |
| Swagger | `http://localhost:3000/docs` |

## Important Rules

- **NEVER** use `any` types
- **ALWAYS** use Zod for external data validation
- **ALWAYS** use mappers for DTO ↔ Entity transformation
- **NEVER** expose database types in API responses
- **BEFORE** schema changes: Plan RLS policies
- **AFTER** schema changes: Regenerate types
