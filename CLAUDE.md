# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo with three main packages:
- `backend/` - Hono API with Supabase integration
- `frontend/` - Angular 20 application with standalone components
- `shared/` - Shared Zod schemas and TypeScript types

## Development Commands

### Backend (Hono + Supabase)
```bash
cd backend
bun install
bun run dev                    # Start development server with hot reload
bun run build                  # Build for production
bun run types:generate         # Generate TypeScript types from Supabase
bun run db:pull                # Pull database schema changes
bun run db:migrate:new         # Create new migration
```

### Frontend (Angular 20)
```bash
cd frontend
npm install
npm run start                  # Start dev server and open browser
npm run build                  # Build for production
npm run test                   # Run tests with Karma
npm run test:vitest            # Run tests with Vitest
npm run test:vitest:ui         # Run Vitest with UI
npm run lint                   # Run ESLint
npm run format:test            # Check Prettier formatting
npm run format:write           # Apply Prettier formatting
npm run analyze                # Bundle analyzer with treemap
npm run analyze:deps           # Dependency analysis with madge
```

### Shared Package
```bash
cd shared
npm run build                  # Compile TypeScript
npm run dev                    # Watch mode compilation
```

## Architecture

### Backend Architecture
- **Framework**: Hono.js with Bun runtime
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Validation**: Zod + OpenAPI
- **Structure**: Domain-driven with `domains/` folder containing business logic
- **Auth**: Cookie-based with Supabase sessions (HttpOnly cookies)
- **Types**: Auto-generated from Supabase schema

### Frontend Architecture  
- **Framework**: Angular 20 with standalone components
- **Change Detection**: Zoneless for better performance
- **Auth**: Supabase client with interceptors
- **Styling**: Tailwind CSS + Angular Material
- **Structure**: Feature-based architecture with `core/`, `feature/`, `ui/` separation
- **State**: Signal-based reactive patterns

### Key Patterns
- **Shared schemas**: Zod schemas in `shared/` package used by both backend and frontend
- **Type safety**: Full TypeScript coverage from database to UI
- **Domain separation**: Each business domain (budget, user, auth) has its own folder
- **Component architecture**: Standalone Angular components with minimal modules

## Validation & Type Safety

- Backend uses Zod schemas from `shared/` package for request/response validation
- Frontend uses the same schemas for client-side validation
- Database types are auto-generated: `bun run types:generate` in backend
- All API routes have OpenAPI documentation via Hono OpenAPI

## Authentication Flow

1. User signs up/in via frontend using Supabase SDK
2. Frontend obtains access tokens from Supabase auth
3. Frontend sends Bearer tokens in Authorization header for API calls
4. Backend middleware validates Bearer tokens and provides user context
5. RLS policies in Supabase handle data access control

## Testing

- Frontend: Karma + Vitest for unit tests
- Backend: No test framework currently configured
- Use `npm run test:vitest:ui` for interactive testing in frontend

## Code Style

- **TypeScript**: Strict mode enabled across all packages
- **Private fields**: Use `#fieldName` syntax instead of `private` (enforced by Cursor rule)
- **Formatting**: Prettier with project-specific configuration
- **Linting**: ESLint with Angular and TypeScript rules

## Database

- **ORM**: Direct Supabase client, no additional ORM
- **Migrations**: Managed through Supabase dashboard or CLI
- **Security**: Row Level Security (RLS) policies for data access
- **Types**: Auto-generated TypeScript types in `backend/src/types/database.ts`

## Important Files

- `backend/src/index.ts` - Main API entry point
- `frontend/src/app/core/core.ts` - Core Angular providers setup
- `shared/index.ts` - Exported schemas and types
- `backend/API.md` - Detailed API documentation
- `backend/RLS_SECURITY.md` - Database security documentation