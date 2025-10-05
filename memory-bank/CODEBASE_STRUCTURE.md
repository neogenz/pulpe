# Pulpe Budget - Codebase Structure

> **Auto-generated documentation** - Last updated:
2025-10-05 11:07:11

This document provides a comprehensive overview of the Pulpe Budget project structure.

## 📋 Project Overview

Pulpe Budget is a modern full-stack personal finance application built with:
- **Frontend**: Angular 20 with Material Design 3
- **Backend**: NestJS with Supabase (PostgreSQL)
- **Mobile**: iOS SwiftUI application
- **Architecture**: Monorepo with Turborepo orchestration

---

## 🏗️ High-Level Structure

### Root Directory Overview
```
.
├── backend-nest
│   ├── scripts
│   ├── src
│   └── supabase
├── frontend
│   ├── e2e
│   ├── playwright
│   ├── playwright-report
│   ├── projects
│   ├── scripts
│   └── test-results
├── memory-bank
└── shared
    └── src

15 directories
```

### Key Directories

#### 🎯 Main Applications
- `frontend/` - Angular 20 web application with Material Design 3
- `backend-nest/` - NestJS API server with Supabase integration
- `mobile/` - iOS SwiftUI native application
- `shared/` - Shared TypeScript types and Zod schemas

#### ⚙️ Configuration & Tooling
- `.cursor/` - Cursor AI editor rules and configurations
- `.github/` - GitHub Actions workflows and templates
- `memory-bank/` - AI assistant context and architectural documentation

---

## 📁 Detailed Structure

### Frontend Application
```
frontend/
├── angular.json
├── CHANGELOG.md
├── CLAUDE.md
├── e2e
│   ├── auth.setup.ts
│   ├── config
│   │   └── test-config.ts
│   ├── fixtures
│   │   └── test-fixtures.ts
│   ├── helpers
│   │   └── api-mocks.ts
│   ├── mocks
│   │   └── api-responses.ts
│   ├── pages
│   │   ├── auth
│   │   ├── budget-details.page.ts
│   │   ├── budget-templates.page.ts
│   │   ├── current-month.page.ts
│   │   ├── main-layout.page.ts
│   │   └── onboarding.page.ts
│   ├── README.md
│   ├── tests
│   │   ├── budget-line-edit-mobile.spec.ts
│   │   ├── critical-path
│   │   ├── essential-workflows.spec.ts
│   │   ├── features
│   │   └── smoke
│   ├── tsconfig.json
│   ├── types
│   │   └── e2e.types.ts
│   └── utils
│       ├── auth-bypass.ts
│       └── env-check.ts
├── eslint.config.js
├── Material Theme Figma.json
├── package.json
├── playwright
├── playwright-report
│   ├── data
│   │   ├── 7c77a7a567ea1499967b1a99d7707ba055b165c7.zip
│   │   ├── b428e5485b5d0a50375788dc1e9f98ea97f82bca.md
│   │   ├── b99a7c2878c0ec64d198a71b5255ee625bfadd51.webm
│   │   └── f27f5cf8bae05c2e970684e94fd50ae35565a477.png
│   ├── index.html
│   └── trace
│       ├── assets
│       ├── codeMirrorModule.C3UTv-Ge.css
│       ├── codicon.DCmgc-ay.ttf
│       ├── defaultSettingsView.NYBT19Ch.css
│       ├── index.BjQ9je-p.js
│       ├── index.CFOW-Ezb.css
│       ├── index.html
│       ├── playwright-logo.svg
│       ├── snapshot.html
│       ├── sw.bundle.js
│       ├── uiMode.BatfzHMG.css
│       ├── uiMode.D5wwC2E1.js
│       ├── uiMode.html
│       └── xtermModule.Beg8tuEN.css
├── playwright.config.ts
├── projects
│   └── webapp
│       ├── eslint.config.js
│       ├── public
│       ├── src
│       ├── tsconfig.app.json
│       └── tsconfig.spec.json
├── README.md
├── scripts
│   ├── generate-build-info.js
│   ├── generate-config.ts
│   └── upload-sourcemaps.js
├── STATE-PATTERN.md
├── test-results
│   └── tests-smoke-app-health-App-83005-ng-for-some-dynamic-chunks--Chromium---Smoke
│       ├── error-context.md
│       ├── test-failed-1.png
│       ├── trace.zip
│       └── video.webm
├── tsconfig.json
└── vitest.config.ts

26 directories, 56 files
```

### Backend API
```
backend-nest/
├── ARCHITECTURE.md
├── bunfig.toml
├── CHANGELOG.md
├── CLAUDE.md
├── DATABASE.md
├── Dockerfile
├── eslint.config.js
├── LOGGING.md
├── nest-cli.json
├── package-lock.json
├── package.json
├── README.md
├── schema.sql
├── scripts
│   └── ci-setup.sh
├── src
│   ├── app.module.ts
│   ├── common
│   │   ├── constants
│   │   ├── decorators
│   │   ├── dto
│   │   ├── exceptions
│   │   ├── filters
│   │   ├── guards
│   │   ├── interceptors
│   │   ├── middleware
│   │   └── utils
│   ├── config
│   │   └── environment.ts
│   ├── database
│   │   └── README.md
│   ├── main.ts
│   ├── modules
│   │   ├── auth
│   │   ├── budget
│   │   ├── budget-line
│   │   ├── budget-template
│   │   ├── debug
│   │   ├── demo
│   │   ├── index.ts
│   │   ├── supabase
│   │   ├── transaction
│   │   └── user
│   ├── test
│   │   ├── redaction.integration.spec.ts
│   │   ├── setup.ts
│   │   └── test-mocks.ts
│   └── types
│       ├── database.types.ts
│       └── supabase-helpers.ts
├── supabase
│   ├── config.toml
│   ├── migrations
│   │   ├── 20250812050259_remote_schema.sql
│   │   ├── 20250812064249_fix_function_search_path_security.sql
│   │   ├── 20250828165030_add_ending_balance_to_monthly_budget.sql
│   │   ├── 20250829130000_add_rollover_calculation_function.sql
│   │   ├── 20250905053019_fix_rollover_function_schema.sql
│   │   ├── 20250905062734_remote_schema.sql
│   │   ├── 20250913161355_remove_is_out_of_budget_column.sql
│   │   ├── 20250925000000_template_line_fk_cascade_null.sql
│   │   ├── 20250928090000_apply_template_line_operations.sql
│   │   ├── 20250928093000_fix_apply_template_line_operations.sql
│   │   └── 20250928145835_remove_variable_recurrence.sql
│   └── seed.sql
├── tsconfig.build.json
├── tsconfig.full-check.json
├── tsconfig.json
└── tsconfig.test.json

29 directories, 41 files
```

### Mobile Application
```
mobile/  [error opening dir]

0 directories, 0 files
