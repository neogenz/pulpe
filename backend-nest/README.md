# Backend NestJS - Pulpe Budget API

This is a NestJS backend for the Pulpe Budget application, providing a REST API with authentication and budget management features.

## Features

- **NestJS Framework**: Modern TypeScript framework with decorators and dependency injection
- **OpenAPI/Swagger**: Auto-generated API documentation at `/api/docs`
- **Zod Validation**: Request/response validation using shared Zod schemas
- **Supabase Integration**: Authentication and database operations
- **TypeScript**: Full type safety from database to API responses
- **Shared Models**: Uses `@pulpe/shared` package for consistent types
- **Logging**: Structured logging with Pino
- **Global Error Handling**: Centralized exception handling

## Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Development**:
   ```bash
   bun run start:dev
   ```

4. **Build**:
   ```bash
   bun run build
   ```

5. **Production**:
   ```bash
   bun run start:prod
   ```

## API Documentation

- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/openapi
- **Health Check**: http://localhost:3000/health

## Architecture

### Project Structure
```
src/
├── config/              # Environment configuration and validation
├── common/              # Shared utilities and cross-cutting concerns
│   ├── decorators/      # Custom decorators (@User)
│   ├── dto/             # Common DTOs (response wrapper)
│   ├── filters/         # Global exception filters
│   ├── guards/          # Authentication guards
│   ├── interceptors/    # Response interceptors
│   ├── logger/          # Application logger service
│   ├── middleware/      # Request middleware (request ID)
│   └── pipes/           # Validation pipes (Zod)
├── modules/             # Feature modules
│   ├── auth/            # Authentication endpoints
│   ├── budget/          # Budget management
│   ├── debug/           # Debug endpoints
│   ├── supabase/        # Supabase service integration
│   ├── transaction/     # Transaction management
│   └── user/            # User profile management
├── app.module.ts        # Root application module
└── main.ts              # Application bootstrap
```

### Key Components

#### Authentication Guard
```typescript
@UseGuards(AuthGuard)  // Requires Bearer token authentication
```

#### Zod Validation
```typescript
@UsePipes(new ZodValidationPipe(budgetCreateRequestSchema))
```

#### User Injection
```typescript
async method(
  @User() user: AuthenticatedUser,
) { /* ... */ }
```

## API Endpoints

All endpoints are prefixed with `/api`:

### Authentication
- `GET /api/auth/validate` - Validate JWT token

### User Management
- `GET /api/users/profile` - Get user profile

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

### Debug (Development only)
- `GET /api/debug/health` - Health check endpoint

## Development

### Scripts
```bash
bun run start:dev      # Development with hot reload
bun run build          # Build for production  
bun run start:prod     # Run production build
bun run start          # Start development server
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:4200
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

## Technology Stack

- **Runtime**: Bun (JavaScript runtime)
- **Framework**: NestJS with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod schemas from `@pulpe/shared`
- **Authentication**: Supabase Auth with Bearer tokens
- **Documentation**: OpenAPI/Swagger
- **Logging**: Pino with structured logging