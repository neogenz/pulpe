# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pulpe is a personal budget management application for the Swiss market. Users plan their financial year using reusable monthly templates with automatic rollover mechanisms.

**Core Philosophy**: Planning > Tracking, Simplicity > Completeness (KISS & YAGNI), Isolation > DRY

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Angular 20+, Tailwind CSS v4, Angular Material v20, Vitest, Playwright
- **Backend**: NestJS 11+ with Bun runtime, Supabase (PostgreSQL + Auth + RLS)
- **Shared**: `@pulpe/shared` package with Zod schemas for API contracts

## Commands

```bash
pnpm dev                    # Full stack (frontend + backend + shared watch)
pnpm quality:fix            # Fix lint, format, type-check
pnpm test                   # Run all tests
pnpm build                  # Build all packages
```

See `frontend/CLAUDE.md` and `backend-nest/CLAUDE.md` for package-specific commands.

## Monorepo Structure

```
pulpe-workspace/
├── frontend/               # Angular 20 web app
├── backend-nest/           # NestJS API with Bun
├── shared/                 # @pulpe/shared - Zod schemas
└── turbo.json              # Turborepo orchestration
```

## Shared Package

`@pulpe/shared` is the single source of truth for API contracts:
- **Include**: API request/response types, form validation schemas, enums
- **Exclude**: Database types, backend implementation details, frontend UI types

## Deployment

- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Supabase Cloud

## Pre-commit

Lefthook runs `pnpm quality` on changed files. Skip with `--no-verify` if needed.

## Critical Notes

- Never use destructive commands (`db reset`) on Supabase
