# Backend NestJS - Pulpe Budget API

This is a NestJS migration of the original Hono/Bun backend, providing the same API functionality with a different framework approach.

## Features

- **NestJS Framework**: Modern TypeScript framework with decorators and dependency injection
- **OpenAPI/Swagger**: Auto-generated API documentation at `/api/docs`
- **Zod Validation**: Request/response validation using shared Zod schemas
- **Supabase Integration**: Authentication and database operations
- **TypeScript**: Full type safety from database to API responses
- **Shared Models**: Uses `@pulpe/shared` package for consistent types

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Development**:
   ```bash
   pnpm run start:dev
   ```

4. **Build**:
   ```bash
   pnpm run build
   ```

5. **Production**:
   ```bash
   pnpm run start:prod
   ```

## API Documentation

- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/openapi
- **Health Check**: http://localhost:3000/health

## Architecture

### Project Structure
```
src/
├── config/              # Environment configuration
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators (@User, @SupabaseClient)
│   ├── guards/          # Authentication guards
│   └── pipes/           # Validation pipes (Zod)
├── modules/             # Feature modules
│   ├── auth/            # Authentication endpoints
│   ├── budget/          # Budget management
│   ├── transaction/     # Transaction management
│   ├── user/            # User profile management
│   └── supabase/        # Supabase service integration
├── app.module.ts        # Root application module
└── main.ts              # Application bootstrap
```

### Key Components

#### Authentication Guard
```typescript
@UseGuards(AuthGuard)  // Requires Bearer token
@UseGuards(OptionalAuthGuard)  // Optional authentication
```

#### Zod Validation
```typescript
@UsePipes(new ZodBodyPipe(budgetCreateRequestSchema))
```

#### User & Supabase Injection
```typescript
async method(
  @User() user: AuthenticatedUser,
  @SupabaseClient() supabase: AuthenticatedSupabaseClient,
) { /* ... */ }
```

## API Endpoints

All endpoints are prefixed with `/api`:

### Authentication
- `GET /api/auth/validate` - Validate JWT token

### User Management
- `GET /api/users/me` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/public-info` - Public info (optional auth)
- `PUT /api/users/onboarding-completed` - Mark onboarding complete
- `GET /api/users/onboarding-status` - Get onboarding status

### Budget Management
- `GET /api/budgets` - List all budgets
- `POST /api/budgets` - Create new budget
- `GET /api/budgets/:id` - Get budget by ID
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### Transaction Management
- `GET /api/transactions/budget/:budgetId` - List transactions for budget
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/:id` - Get transaction by ID
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

## Differences from Original Backend

### Framework Changes
- **Hono → NestJS**: Different framework with decorators and DI
- **Bun → Node.js/pnpm**: Different runtime and package manager
- **OpenAPIHono → @nestjs/swagger**: Different OpenAPI implementation

### Architecture Improvements
- **Modular Structure**: Clear separation of concerns with modules
- **Dependency Injection**: Better testability and loose coupling
- **Decorators**: Type-safe parameter extraction (@User, @SupabaseClient)
- **Exception Handling**: Built-in HTTP exceptions
- **Validation**: Integrated Zod validation with pipes

### Maintained Features
- **Same API contracts**: Identical request/response schemas
- **Shared models**: Uses same `@pulpe/shared` package
- **Supabase integration**: Same authentication and RLS patterns
- **OpenAPI documentation**: Same API documentation features

## Development

### Scripts
```bash
pnpm run start:dev     # Development with hot reload
pnpm run build         # Build for production
pnpm run start:prod    # Run production build
pnpm run lint          # Run ESLint
pnpm run test          # Run tests
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:4200
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Migration Notes

This NestJS backend is a complete migration from the original Hono backend. It provides:

1. **Same API surface**: All endpoints work identically
2. **Shared validation**: Uses same Zod schemas from `@pulpe/shared`
3. **Compatible responses**: Same response formats
4. **RLS security**: Same Supabase Row Level Security patterns

The frontend should work without any changes when pointed to this backend.