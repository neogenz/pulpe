# Project Overview: Pulpe Workspace

## Purpose
Pulpe is a financial planning application that helps users manage their budgets, track expenses, and plan for the future. The project is built as a comprehensive financial planning tool with the philosophy of "Planning > Tracking" and "Anticipation > Reaction".

## Architecture
This is a monorepo containing multiple components:

### Backend (NestJS + Supabase + Bun)
- **Location**: `backend-nest/`
- **Technology**: NestJS API with Supabase integration and Bun runtime
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **API Documentation**: Swagger/OpenAPI at `/docs`
- **API Versioning**: URI-based versioning (v1) - all endpoints prefixed with `/api/v1`

### Frontend (Angular 20)
- **Location**: `frontend/`
- **Technology**: Angular 20 application with standalone components and signals
- **Styling**: Tailwind CSS v4 + Angular Material v20 (Material Design 3)
- **Architecture**: Feature-based with strict isolation (core/, feature/, ui/, pattern/, layout/)
- **State Management**: Signal-based reactive patterns
- **Testing**: Vitest (unit) + Playwright (E2E)

### Mobile (iOS SwiftUI)
- **Location**: `mobile/`
- **Technology**: iOS app built with SwiftUI
- **Target**: iOS 17.0+
- **Architecture**: MVVM pattern with service layer
- **Features**: Onboarding, budgets, transactions, templates, settings

### Shared Package
- **Location**: `shared/`
- **Technology**: Shared Zod schemas and TypeScript types
- **Purpose**: Type safety between backend and frontend

## Current System
- **Platform**: macOS (Darwin 24.5.0)
- **Xcode**: 16.4
- **Package Manager**: pnpm (workspace), Bun (backend), XcodeGen (mobile)