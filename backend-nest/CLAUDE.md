# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

### Development

```bash
# Start with local Supabase (recommended)
bun run dev                    # Starts Supabase + watches for changes (port 3000)
```

### Building & Production

```bash
bun run build                  # Build for production with minification
```

### Testing

```bash
# Test commands
bun test                       # Run all tests
bun test:unit                  # Unit tests only
bun test:performance           # Performance tests with metrics

# Specific test patterns
bun test [file.spec.ts]        # Run specific test file
DEBUG_PERFORMANCE=true bun test # Enable performance debugging
```

### Code Quality

```bash
# Quality checks (run before committing)
bun run quality                # Type-check + Lint + Format check
bun run quality:fix            # Fix all auto-fixable issues
```

### Database Operations

```bash
# Type generation
bun run generate-types:local   # Generate types from local Supabase
bun run generate-types         # Generate from production
```

## High-level Architecture

### NestJS Module Structure

```
src/modules/[domain]/
├── [domain].controller.ts    # HTTP routes, validation, Swagger docs
├── [domain].service.ts       # Business logic, orchestration
├── [domain].module.ts        # Module configuration, DI setup
├── [domain].mapper.ts        # DTO ↔ Entity transformation
├── dto/                      # Request/Response DTOs with Zod
└── entities/                 # Business entities
```

### Key Architectural Patterns

#### 1. Authentication Flow

- **JWT Bearer tokens** validated via Supabase Auth
- **AuthGuard** protects all routes by default
- **@User() decorator** injects authenticated user
- **@SupabaseClient() decorator** provides authenticated DB client
- **Row Level Security (RLS)** enforces data isolation at DB level

#### 2. Data Validation Pipeline

```typescript
Frontend (Zod) → Backend DTO (createZodDto) → Service Validation → Database (RLS)
```

- Shared schemas from `@pulpe/shared` package
- Runtime validation with Zod
- Type safety with TypeScript strict mode
- Database constraints and RLS policies

#### 3. Service Pattern

Services handle business logic and use mappers for data transformation:

```typescript
DB Row (snake_case) → Mapper → API Response (camelCase)
```

#### 4. Error Handling

- Global exception filter for consistent error responses
- Structured logging with Pino
- Request ID tracking for debugging
- Proper HTTP status codes and error messages

### Database Architecture

#### Supabase Integration

- **Authentication**: Supabase Auth with JWT
- **Database**: PostgreSQL with Row Level Security
- **Types**: Auto-generated from database schema
- **RLS Policies**: User data isolation via `auth.uid()`

#### Key Tables

- `monthly_budget`: User budgets by month/year
- `transaction`: Financial transactions
- `template`: Budget templates (public + private)
- `template_line`: Template transaction items

### Environment Configuration

```env
# Required variables (.env file)
NODE_ENV=development
PORT=3000
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Testing Strategy

#### Unit Tests

- Mock Supabase client for isolated testing
- Test services and guards independently
- Use `createMockSupabaseClient()` helper

#### Performance Tests

- Load testing with metrics
- Response time tracking
- Memory usage monitoring
- Run with `DEBUG_PERFORMANCE=true` for detailed output

### Common Development Tasks

#### Adding a New Module

1. Create module structure in `src/modules/[domain]/`
2. Define DTOs using `createZodDto` with shared schemas
3. Implement service with business logic
4. Create controller with proper guards and decorators
5. Add mapper for data transformation
6. Register module in `app.module.ts`

#### Working with Database Types

1. Make schema changes in Supabase Studio or migrations
2. Run `bun run generate-types:local` to update types
3. Use generated types in services:

```typescript
import type { Database } from '../../types/database.types';
type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
```

#### Debugging Requests

- Enable debug logging: `DEBUG_HTTP_FULL=true`
- Check Swagger docs at `http://localhost:3000/docs`
- Use request ID from response headers for log correlation

### Logging with Pino

#### Configuration

The application uses **nestjs-pino** for structured logging with high performance:

- **Development**: Pretty-printed colorful output with `pino-pretty`
- **Production**: JSON structured logs for observability platforms
- **Auto-correlation**: Request IDs generated and propagated automatically

#### Usage in Services

```typescript
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(
    @InjectPinoLogger(MyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async businessMethod(user: User, data: SomeData) {
    const startTime = Date.now();

    this.logger.info(
      {
        operation: 'business_method',
        userId: user.id,
        entityId: result.id,
        duration: Date.now() - startTime,
      },
      'Business operation completed',
    );
  }
}
```

#### Log Levels

- **error**: Server errors (5xx), critical exceptions
- **warn**: Client errors (4xx), abnormal situations
- **info**: Important business operations, audit, metrics
- **debug**: Technical details, validation (dev only)

### Important Conventions

#### NestJS Best Practices

- Use constructor injection for dependencies
- Keep controllers thin (HTTP only)
- Business logic in services
- Use guards for authentication
- Custom decorators for request data

#### Type Safety

- TypeScript strict mode enabled
- No `any` types allowed
- Validate all external data with Zod
- Use type guards for runtime checks

#### Security

- All routes protected by default
- RLS policies enforce data isolation
- Input validation at multiple layers
- No sensitive data in logs or responses
