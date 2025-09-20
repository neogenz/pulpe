# Pulpe Budget - Codebase Structure

> **Auto-generated documentation** - Last updated:
2025-09-16 13:30:20

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
│   ├── deps
│   ├── e2e
│   ├── playwright
│   ├── playwright-report
│   ├── projects
│   ├── scripts
│   └── test-results
├── memory-bank
├── mobile
│   └── PulpeApp
└── shared
    └── src

18 directories
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
├── deps
│   └── webapp
│       ├── _all.jpg
│       ├── edit-transactions-dialog.png
│       └── ui.png
├── e2e
│   ├── auth.setup.ts
│   ├── config
│   │   └── test-config.ts
│   ├── fixtures
│   │   └── test-fixtures.ts
│   ├── helpers
│   │   └── api-mocks.ts
│   ├── IMPROVEMENT_RECOMMENDATIONS.md
│   ├── mocks
│   │   └── api-responses.ts
│   ├── pages
│   │   ├── auth
│   │   ├── budget-details.page.ts
│   │   ├── budget-templates.page.ts
│   │   ├── current-month.page.ts
│   │   ├── main-layout.page.ts
│   │   └── onboarding.page.ts
│   ├── PLAYWRIGHT-STANDARDS.md
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
│   └── index.html
├── playwright.config.ts
├── projects
│   └── webapp
│       ├── eslint.config.js
│       ├── public
│       ├── src
│       ├── tsconfig.app.json
│       └── tsconfig.spec.json
├── README.md
├── run-tests.md
├── scripts
│   ├── generate-build-info.js
│   ├── generate-config.js
│   └── upload-sourcemaps.js
├── STATE-PATTERN.md
├── test-results
├── tsconfig.json
└── vitest.config.ts

24 directories, 41 files
```

### Backend API
```
backend-nest/
├── ARCHITECTURE.md
├── bun.lock
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
│   │   └── 20250913161355_remove_is_out_of_budget_column.sql
│   └── seed.sql
├── tsconfig.build.json
├── tsconfig.full-check.json
├── tsconfig.json
└── tsconfig.test.json

28 directories, 38 files
```

### Mobile Application
```
mobile/
└── PulpeApp
    └── Core
        └── Components

4 directories, 0 files
```

### Shared Package
```
shared/
├── bun.lock
├── CHANGELOG.md
├── ESM_NOTES.md
├── index.ts
├── package.json
├── pnpm-lock.yaml
├── README.md
├── schemas.ts
├── src
│   ├── calculators
│   │   ├── budget-formulas.spec.ts
│   │   ├── budget-formulas.ts
│   │   └── index.ts
│   └── types.ts
├── tsconfig.esm.json
├── tsconfig.json
└── vitest.config.ts

3 directories, 15 files
```

---

## 📊 Statistics

### File Count by Type
```
TypeScript files:   3042
Angular templates:  143
Style files:        65
JavaScript files:   5657
JSON files:         3298
Markdown files:     393
Test files:         225
```

### Directory Statistics
```
Total directories:  3418
Frontend dirs:      293
Backend dirs:       90
Mobile dirs:        1016
Shared dirs:        17
```

---

## 🔍 Complete Project Tree

<details>
<summary>Click to expand complete structure</summary>

```
.
├── .claude
│   ├── commands
│   │   ├── context7.md
│   │   ├── epct.md
│   │   ├── fix-ide-errors.md
│   │   ├── frontend
│   │   │   └── architect.md
│   │   ├── general-expert.md
│   │   ├── review.md
│   │   ├── run-tasks.md
│   │   └── update-changelog.md
│   ├── settings.json
│   └── settings.local.json
├── .cursor
│   ├── prompts
│   │   └── angular
│   │       ├── best-practices.md
│   │       ├── llm-full.txt
│   │       └── llm.txt
│   └── rules
│       ├── 00-architecture
│       │   ├── 0-angular-architecture-structure.mdc
│       │   └── 0-angular-component-separation.mdc
│       ├── 01-standards
│       │   ├── 1-clean-code-frontend.mdc
│       │   ├── 1-clean-code.mdc
│       │   └── 1-naming-conventions.mdc
│       ├── 02-programming-languages
│       │   ├── 2-typescript-naming-conventions.mdc
│       │   ├── 2-typescript-private-fields.mdc
│       │   └── 2-typescript.mdc
│       ├── 03-frameworks-and-libraries
│       │   ├── 3-angular-all-best-practices.mdc
│       │   ├── 3-angular-component-exports.mdc
│       │   ├── 3-angular-component-placement.mdc
│       │   ├── 3-angular-core-provider.mdc
│       │   ├── 3-angular-dependency-injection.mdc
│       │   ├── 3-angular-feature.mdc
│       │   ├── 3-angular-import.mdc
│       │   ├── 3-angular-material-buttons.mdc
│       │   ├── 3-angular-signal.mdc
│       │   ├── 3-angular-stable-identification.mdc
│       │   ├── 3-angular-v20-official-doc.mdc
│       │   ├── 3-angular-views.mdc
│       │   ├── 3-angular@20-naming-conventions.mdc
│       │   ├── 3-date-fns.mdc
│       │   ├── 3-hono-best-practices.mdc
│       │   ├── 3-hono-openapi.mdc
│       │   ├── 3-nestjs-error-handling.mdc
│       │   ├── 3-nestjs-pino-logging.mdc
│       │   ├── 3-nestjs-service-patterns.mdc
│       │   └── 3-tailwind@4.1.mdc
│       ├── 04-tools-and-configurations
│       │   ├── .gitkeep
│       │   ├── 4-angular-build-analysis-tools.mdc
│       │   ├── 4-angular-dependency-rules.mdc
│       │   ├── 4-angular-eslint-boundaries-rules.mdc
│       │   └── 4-package-installation.mdc
│       ├── 05-workflows-and-processes
│       │   ├── .gitkeep
│       │   └── 5-bug-finder.mdc
│       ├── 06-templates-and-models
│       │   └── .gitkeep
│       ├── 07-quality-assurance
│       │   ├── .gitkeep
│       │   ├── 7-testing-angular@20-vitest.mdc
│       │   ├── 7-testing-backend.mdc
│       │   ├── 7-testing-frontend.mdc
│       │   ├── 7-testing-standards.mdc
│       │   ├── 7-tests-integration.mdc
│       │   └── 7-tests-units.mdc
│       ├── 08-domain-specific-rules
│       │   └── .gitkeep
│       ├── 09-other
│       │   ├── .gitkeep
│       │   ├── 9-pulpe-workspace.mdc
│       │   └── self-improve.mdc
│       ├── meta-generator.mdc
│       └── shared-package-usage.mdc
├── .dockerignore
├── .env
├── .github
│   └── workflows
│       ├── ci.yml
│       ├── claude-code-review.yml
│       ├── claude.yml
│       └── supabase-deploy.yml
├── .gitignore
├── .mcp.json
├── .npmrc
├── .vercelignore
├── .vscode
│   └── settings.json
├── backend-nest
│   ├── .claude
│   │   ├── agents
│   │   │   └── angular-docs-researcher.md
│   │   └── settings.local.json
│   ├── .dockerignore
│   ├── .env.ci
│   ├── .env.development
│   ├── .env.example
│   ├── .env.local
│   ├── .gitignore
│   ├── .prettierignore
│   ├── .prettierrc
│   ├── .vscode
│   │   └── settings.json
│   ├── ARCHITECTURE.md
│   ├── bun.lock
│   ├── bunfig.toml
│   ├── CHANGELOG.md
│   ├── CLAUDE.md
│   ├── DATABASE.md
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── LOGGING.md
│   ├── nest-cli.json
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   ├── schema.sql
│   ├── scripts
│   │   └── ci-setup.sh
│   ├── src
│   │   ├── app.module.ts
│   │   ├── common
│   │   │   ├── constants
│   │   │   │   └── error-definitions.ts
│   │   │   ├── decorators
│   │   │   │   └── user.decorator.ts
│   │   │   ├── dto
│   │   │   │   └── response.dto.ts
│   │   │   ├── exceptions
│   │   │   │   ├── business.exception.spec.ts
│   │   │   │   └── business.exception.ts
│   │   │   ├── filters
│   │   │   │   ├── filters.module.ts
│   │   │   │   ├── global-exception.filter.spec.ts
│   │   │   │   └── global-exception.filter.ts
│   │   │   ├── guards
│   │   │   │   ├── auth.guard.spec.ts
│   │   │   │   └── auth.guard.ts
│   │   │   ├── interceptors
│   │   │   │   └── response.interceptor.ts
│   │   │   ├── middleware
│   │   │   │   ├── payload-size.middleware.ts
│   │   │   │   └── response-logger.middleware.ts
│   │   │   └── utils
│   │   │       └── error-handler.ts
│   │   ├── config
│   │   │   └── environment.ts
│   │   ├── database
│   │   │   └── README.md
│   │   ├── main.ts
│   │   ├── modules
│   │   │   ├── auth
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── dto
│   │   │   │       └── auth-response.dto.ts
│   │   │   ├── budget
│   │   │   │   ├── budget.calculator.ts
│   │   │   │   ├── budget.constants.ts
│   │   │   │   ├── budget.controller.ts
│   │   │   │   ├── budget.mappers.ts
│   │   │   │   ├── budget.module.ts
│   │   │   │   ├── budget.performance.spec.ts
│   │   │   │   ├── budget.repository.ts
│   │   │   │   ├── budget.service.spec.ts
│   │   │   │   ├── budget.service.ts
│   │   │   │   ├── budget.validator.ts
│   │   │   │   ├── dto
│   │   │   │   │   └── budget-swagger.dto.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── schemas
│   │   │   │       └── rpc-responses.schema.ts
│   │   │   ├── budget-line
│   │   │   │   ├── budget-line.controller.ts
│   │   │   │   ├── budget-line.mappers.ts
│   │   │   │   ├── budget-line.module.ts
│   │   │   │   ├── budget-line.service.spec.ts
│   │   │   │   ├── budget-line.service.ts
│   │   │   │   ├── dto
│   │   │   │   │   ├── budget-line-swagger.dto.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── entities
│   │   │   │   │   ├── budget-line.entity.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── index.ts
│   │   │   ├── budget-template
│   │   │   │   ├── budget-template.controller.ts
│   │   │   │   ├── budget-template.mappers.ts
│   │   │   │   ├── budget-template.module.ts
│   │   │   │   ├── budget-template.service.deletion.spec.ts
│   │   │   │   ├── budget-template.service.spec.ts
│   │   │   │   ├── budget-template.service.ts
│   │   │   │   ├── dto
│   │   │   │   │   ├── budget-template-swagger.dto.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── index.ts
│   │   │   ├── debug
│   │   │   │   ├── debug.controller.ts
│   │   │   │   └── debug.module.ts
│   │   │   ├── index.ts
│   │   │   ├── supabase
│   │   │   │   ├── supabase.module.ts
│   │   │   │   └── supabase.service.ts
│   │   │   ├── transaction
│   │   │   │   ├── dto
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── transaction-swagger.dto.ts
│   │   │   │   ├── entities
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── transaction.entity.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── transaction.controller.ts
│   │   │   │   ├── transaction.mappers.ts
│   │   │   │   ├── transaction.module.ts
│   │   │   │   ├── transaction.service.spec.ts
│   │   │   │   └── transaction.service.ts
│   │   │   └── user
│   │   │       ├── dto
│   │   │       │   ├── index.ts
│   │   │       │   └── user-profile.dto.ts
│   │   │       ├── entities
│   │   │       │   ├── index.ts
│   │   │       │   └── user.entity.ts
│   │   │       ├── index.ts
│   │   │       ├── user.controller.ts
│   │   │       └── user.module.ts
│   │   ├── test
│   │   │   ├── redaction.integration.spec.ts
│   │   │   ├── setup.ts
│   │   │   └── test-mocks.ts
│   │   └── types
│   │       ├── database.types.ts
│   │       └── supabase-helpers.ts
│   ├── supabase
│   │   ├── .gitignore
│   │   ├── .temp
│   │   │   ├── cli-latest
│   │   │   ├── gotrue-version
│   │   │   ├── pooler-url
│   │   │   ├── postgres-version
│   │   │   ├── project-ref
│   │   │   ├── rest-version
│   │   │   └── storage-version
│   │   ├── config.toml
│   │   ├── migrations
│   │   │   ├── 20250812050259_remote_schema.sql
│   │   │   ├── 20250812064249_fix_function_search_path_security.sql
│   │   │   ├── 20250828165030_add_ending_balance_to_monthly_budget.sql
│   │   │   ├── 20250829130000_add_rollover_calculation_function.sql
│   │   │   ├── 20250905053019_fix_rollover_function_schema.sql
│   │   │   ├── 20250905062734_remote_schema.sql
│   │   │   └── 20250913161355_remove_is_out_of_budget_column.sql
│   │   └── seed.sql
│   ├── tsconfig.build.json
│   ├── tsconfig.full-check.json
│   ├── tsconfig.json
│   └── tsconfig.test.json
├── bun.lock
├── CI.md
├── CLAUDE.md
├── deployment-guide.md
├── frontend
│   ├── .angular
│   │   └── cache
│   │       └── 20.2.2
│   │           └── webapp
│   │               ├── .tsbuildinfo
│   │               ├── angular-compiler.db
│   │               ├── angular-compiler.db-lock
│   │               └── vite
│   │                   ├── com.chrome.devtools.json
│   │                   ├── deps
│   │                   │   ├── _metadata.json
│   │                   │   ├── @angular_cdk_a11y.js
│   │                   │   ├── @angular_cdk_a11y.js.map
│   │                   │   ├── @angular_cdk_bidi.js
│   │                   │   ├── @angular_cdk_bidi.js.map
│   │                   │   ├── @angular_cdk_layout.js
│   │                   │   ├── @angular_cdk_layout.js.map
│   │                   │   ├── @angular_cdk_scrolling.js
│   │                   │   ├── @angular_cdk_scrolling.js.map
│   │                   │   ├── @angular_cdk_text-field.js
│   │                   │   ├── @angular_cdk_text-field.js.map
│   │                   │   ├── @angular_common_http.js
│   │                   │   ├── @angular_common_http.js.map
│   │                   │   ├── @angular_common_locales_de-CH.js
│   │                   │   ├── @angular_common_locales_de-CH.js.map
│   │                   │   ├── @angular_common_locales_extra_de-CH.js
│   │                   │   ├── @angular_common_locales_extra_de-CH.js.map
│   │                   │   ├── @angular_common_locales_extra_fr-CH.js
│   │                   │   ├── @angular_common_locales_extra_fr-CH.js.map
│   │                   │   ├── @angular_common_locales_fr-CH.js
│   │                   │   ├── @angular_common_locales_fr-CH.js.map
│   │                   │   ├── @angular_common.js
│   │                   │   ├── @angular_common.js.map
│   │                   │   ├── @angular_core_rxjs-interop.js
│   │                   │   ├── @angular_core_rxjs-interop.js.map
│   │                   │   ├── @angular_core.js
│   │                   │   ├── @angular_core.js.map
│   │                   │   ├── @angular_forms.js
│   │                   │   ├── @angular_forms.js.map
│   │                   │   ├── @angular_material_bottom-sheet.js
│   │                   │   ├── @angular_material_bottom-sheet.js.map
│   │                   │   ├── @angular_material_button.js
│   │                   │   ├── @angular_material_button.js.map
│   │                   │   ├── @angular_material_card.js
│   │                   │   ├── @angular_material_card.js.map
│   │                   │   ├── @angular_material_checkbox.js
│   │                   │   ├── @angular_material_checkbox.js.map
│   │                   │   ├── @angular_material_chips.js
│   │                   │   ├── @angular_material_chips.js.map
│   │                   │   ├── @angular_material_core.js
│   │                   │   ├── @angular_material_core.js.map
│   │                   │   ├── @angular_material_datepicker.js
│   │                   │   ├── @angular_material_datepicker.js.map
│   │                   │   ├── @angular_material_dialog.js
│   │                   │   ├── @angular_material_dialog.js.map
│   │                   │   ├── @angular_material_divider.js
│   │                   │   ├── @angular_material_divider.js.map
│   │                   │   ├── @angular_material_form-field.js
│   │                   │   ├── @angular_material_form-field.js.map
│   │                   │   ├── @angular_material_icon.js
│   │                   │   ├── @angular_material_icon.js.map
│   │                   │   ├── @angular_material_input.js
│   │                   │   ├── @angular_material_input.js.map
│   │                   │   ├── @angular_material_list.js
│   │                   │   ├── @angular_material_list.js.map
│   │                   │   ├── @angular_material_menu.js
│   │                   │   ├── @angular_material_menu.js.map
│   │                   │   ├── @angular_material_progress-bar.js
│   │                   │   ├── @angular_material_progress-bar.js.map
│   │                   │   ├── @angular_material_progress-spinner.js
│   │                   │   ├── @angular_material_progress-spinner.js.map
│   │                   │   ├── @angular_material_radio.js
│   │                   │   ├── @angular_material_radio.js.map
│   │                   │   ├── @angular_material_select.js
│   │                   │   ├── @angular_material_select.js.map
│   │                   │   ├── @angular_material_sidenav.js
│   │                   │   ├── @angular_material_sidenav.js.map
│   │                   │   ├── @angular_material_snack-bar.js
│   │                   │   ├── @angular_material_snack-bar.js.map
│   │                   │   ├── @angular_material_table.js
│   │                   │   ├── @angular_material_table.js.map
│   │                   │   ├── @angular_material_tabs.js
│   │                   │   ├── @angular_material_tabs.js.map
│   │                   │   ├── @angular_material_toolbar.js
│   │                   │   ├── @angular_material_toolbar.js.map
│   │                   │   ├── @angular_material_tooltip.js
│   │                   │   ├── @angular_material_tooltip.js.map
│   │                   │   ├── @angular_material-date-fns-adapter.js
│   │                   │   ├── @angular_material-date-fns-adapter.js.map
│   │                   │   ├── @angular_platform-browser_animations_async.js
│   │                   │   ├── @angular_platform-browser_animations_async.js.map
│   │                   │   ├── @angular_platform-browser.js
│   │                   │   ├── @angular_platform-browser.js.map
│   │                   │   ├── @angular_router.js
│   │                   │   ├── @angular_router.js.map
│   │                   │   ├── @pulpe_shared.js
│   │                   │   ├── @pulpe_shared.js.map
│   │                   │   ├── @supabase_supabase-js.js
│   │                   │   ├── @supabase_supabase-js.js.map
│   │                   │   ├── browser-S7SCZ6NT.js
│   │                   │   ├── browser-S7SCZ6NT.js.map
│   │                   │   ├── browser-ZRDSZ3ME.js
│   │                   │   ├── browser-ZRDSZ3ME.js.map
│   │                   │   ├── chunk-26U4QCRZ.js
│   │                   │   ├── chunk-26U4QCRZ.js.map
│   │                   │   ├── chunk-2O5XUMX4.js
│   │                   │   ├── chunk-2O5XUMX4.js.map
│   │                   │   ├── chunk-32PNBHS6.js
│   │                   │   ├── chunk-32PNBHS6.js.map
│   │                   │   ├── chunk-3NMKPGSZ.js
│   │                   │   ├── chunk-3NMKPGSZ.js.map
│   │                   │   ├── chunk-3UH7AKAZ.js
│   │                   │   ├── chunk-3UH7AKAZ.js.map
│   │                   │   ├── chunk-4PMAD4NC.js
│   │                   │   ├── chunk-4PMAD4NC.js.map
│   │                   │   ├── chunk-5KOKPGG4.js
│   │                   │   ├── chunk-5KOKPGG4.js.map
│   │                   │   ├── chunk-6VUHGGV6.js
│   │                   │   ├── chunk-6VUHGGV6.js.map
│   │                   │   ├── chunk-6X4VG433.js
│   │                   │   ├── chunk-6X4VG433.js.map
│   │                   │   ├── chunk-7EAUKVNC.js
│   │                   │   ├── chunk-7EAUKVNC.js.map
│   │                   │   ├── chunk-7VNEILLY.js
│   │                   │   ├── chunk-7VNEILLY.js.map
│   │                   │   ├── chunk-A4VAMMZD.js
│   │                   │   ├── chunk-A4VAMMZD.js.map
│   │                   │   ├── chunk-AJEPIPV2.js
│   │                   │   ├── chunk-AJEPIPV2.js.map
│   │                   │   ├── chunk-AM4Z5R4U.js
│   │                   │   ├── chunk-AM4Z5R4U.js.map
│   │                   │   ├── chunk-ASBPD3OW.js
│   │                   │   ├── chunk-ASBPD3OW.js.map
│   │                   │   ├── chunk-B7AAE2QJ.js
│   │                   │   ├── chunk-B7AAE2QJ.js.map
│   │                   │   ├── chunk-BHM3VYBE.js
│   │                   │   ├── chunk-BHM3VYBE.js.map
│   │                   │   ├── chunk-BRNP62TT.js
│   │                   │   ├── chunk-BRNP62TT.js.map
│   │                   │   ├── chunk-CER3QSR2.js
│   │                   │   ├── chunk-CER3QSR2.js.map
│   │                   │   ├── chunk-CXVBD2TS.js
│   │                   │   ├── chunk-CXVBD2TS.js.map
│   │                   │   ├── chunk-D2GQLFAX.js
│   │                   │   ├── chunk-D2GQLFAX.js.map
│   │                   │   ├── chunk-ELKLND53.js
│   │                   │   ├── chunk-ELKLND53.js.map
│   │                   │   ├── chunk-EQEFF56U.js
│   │                   │   ├── chunk-EQEFF56U.js.map
│   │                   │   ├── chunk-F7VIDG4G.js
│   │                   │   ├── chunk-F7VIDG4G.js.map
│   │                   │   ├── chunk-FIND2VUG.js
│   │                   │   ├── chunk-FIND2VUG.js.map
│   │                   │   ├── chunk-GBGGKRM5.js
│   │                   │   ├── chunk-GBGGKRM5.js.map
│   │                   │   ├── chunk-GEVZQ3JO.js
│   │                   │   ├── chunk-GEVZQ3JO.js.map
│   │                   │   ├── chunk-GVQUXYIT.js
│   │                   │   ├── chunk-GVQUXYIT.js.map
│   │                   │   ├── chunk-KKYT2BUF.js
│   │                   │   ├── chunk-KKYT2BUF.js.map
│   │                   │   ├── chunk-LZP254TU.js
│   │                   │   ├── chunk-LZP254TU.js.map
│   │                   │   ├── chunk-M5DJLJJV.js
│   │                   │   ├── chunk-M5DJLJJV.js.map
│   │                   │   ├── chunk-NN4Z5VEE.js
│   │                   │   ├── chunk-NN4Z5VEE.js.map
│   │                   │   ├── chunk-OBFYHJ3O.js
│   │                   │   ├── chunk-OBFYHJ3O.js.map
│   │                   │   ├── chunk-OCWNC6AN.js
│   │                   │   ├── chunk-OCWNC6AN.js.map
│   │                   │   ├── chunk-PPW4SKUS.js
│   │                   │   ├── chunk-PPW4SKUS.js.map
│   │                   │   ├── chunk-QCKSB6Z2.js
│   │                   │   ├── chunk-QCKSB6Z2.js.map
│   │                   │   ├── chunk-QXTO7XT7.js
│   │                   │   ├── chunk-QXTO7XT7.js.map
│   │                   │   ├── chunk-R327OCYJ.js
│   │                   │   ├── chunk-R327OCYJ.js.map
│   │                   │   ├── chunk-RTWMHO6M.js
│   │                   │   ├── chunk-RTWMHO6M.js.map
│   │                   │   ├── chunk-TGUPZPSI.js
│   │                   │   ├── chunk-TGUPZPSI.js.map
│   │                   │   ├── chunk-TYFCJ6SL.js
│   │                   │   ├── chunk-TYFCJ6SL.js.map
│   │                   │   ├── chunk-TYKMITME.js
│   │                   │   ├── chunk-TYKMITME.js.map
│   │                   │   ├── chunk-UT4IXFSB.js
│   │                   │   ├── chunk-UT4IXFSB.js.map
│   │                   │   ├── chunk-WCRC6LNO.js
│   │                   │   ├── chunk-WCRC6LNO.js.map
│   │                   │   ├── chunk-WK3SUAS7.js
│   │                   │   ├── chunk-WK3SUAS7.js.map
│   │                   │   ├── chunk-WP5YBONE.js
│   │                   │   ├── chunk-WP5YBONE.js.map
│   │                   │   ├── chunk-WT7IWZSC.js
│   │                   │   ├── chunk-WT7IWZSC.js.map
│   │                   │   ├── chunk-XBFZWJAK.js
│   │                   │   ├── chunk-XBFZWJAK.js.map
│   │                   │   ├── chunk-YL5ANJZ4.js
│   │                   │   ├── chunk-YL5ANJZ4.js.map
│   │                   │   ├── chunk-YOXY6LEJ.js
│   │                   │   ├── chunk-YOXY6LEJ.js.map
│   │                   │   ├── chunk-YSLRTX44.js
│   │                   │   ├── chunk-YSLRTX44.js.map
│   │                   │   ├── chunk-ZCD4MOVP.js
│   │                   │   ├── chunk-ZCD4MOVP.js.map
│   │                   │   ├── chunk-ZOYKGJ6O.js
│   │                   │   ├── chunk-ZOYKGJ6O.js.map
│   │                   │   ├── date-fns_locale.js
│   │                   │   ├── date-fns_locale.js.map
│   │                   │   ├── date-fns.js
│   │                   │   ├── date-fns.js.map
│   │                   │   ├── lottie-web.js
│   │                   │   ├── lottie-web.js.map
│   │                   │   ├── ngx-lottie.js
│   │                   │   ├── ngx-lottie.js.map
│   │                   │   ├── package.json
│   │                   │   ├── posthog-js.js
│   │                   │   ├── posthog-js.js.map
│   │                   │   ├── rxjs_operators.js
│   │                   │   ├── rxjs_operators.js.map
│   │                   │   ├── rxjs.js
│   │                   │   ├── rxjs.js.map
│   │                   │   ├── uuid.js
│   │                   │   ├── uuid.js.map
│   │                   │   ├── zod.js
│   │                   │   └── zod.js.map
│   │                   └── deps_ssr
│   │                       ├── _metadata.json
│   │                       └── package.json
│   ├── .claude
│   │   └── settings.local.json
│   ├── .editorconfig
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── .npmrc
│   ├── .nvmrc
│   ├── .postcssrc.json
│   ├── .prettierignore
│   ├── .prettierrc
│   ├── .vscode
│   │   ├── extensions.json
│   │   ├── launch.json
│   │   └── tasks.json
│   ├── angular.json
│   ├── CHANGELOG.md
│   ├── CLAUDE.md
│   ├── deps
│   │   └── webapp
│   │       ├── _all.jpg
│   │       ├── edit-transactions-dialog.png
│   │       └── ui.png
│   ├── e2e
│   │   ├── auth.setup.ts
│   │   ├── config
│   │   │   └── test-config.ts
│   │   ├── fixtures
│   │   │   └── test-fixtures.ts
│   │   ├── helpers
│   │   │   └── api-mocks.ts
│   │   ├── IMPROVEMENT_RECOMMENDATIONS.md
│   │   ├── mocks
│   │   │   └── api-responses.ts
│   │   ├── pages
│   │   │   ├── auth
│   │   │   │   └── login.page.ts
│   │   │   ├── budget-details.page.ts
│   │   │   ├── budget-templates.page.ts
│   │   │   ├── current-month.page.ts
│   │   │   ├── main-layout.page.ts
│   │   │   └── onboarding.page.ts
│   │   ├── PLAYWRIGHT-STANDARDS.md
│   │   ├── README.md
│   │   ├── tests
│   │   │   ├── budget-line-edit-mobile.spec.ts
│   │   │   ├── critical-path
│   │   │   │   ├── core-navigation.spec.ts
│   │   │   │   └── session.spec.ts
│   │   │   ├── essential-workflows.spec.ts
│   │   │   ├── features
│   │   │   │   ├── authentication.spec.ts
│   │   │   │   ├── budget-line-deletion.spec.ts
│   │   │   │   ├── budget-line-editing.spec.ts
│   │   │   │   ├── budget-template-deletion.spec.ts
│   │   │   │   ├── budget-template-management.spec.ts
│   │   │   │   ├── monthly-budget-management.spec.ts
│   │   │   │   ├── navigation.spec.ts
│   │   │   │   ├── onboarding-business-requirements.spec.ts
│   │   │   │   ├── onboarding-navigation-store.spec.ts
│   │   │   │   ├── template-details-view.spec.ts
│   │   │   │   ├── template-selection-behavior.spec.ts
│   │   │   │   └── user-onboarding-flow.spec.ts
│   │   │   └── smoke
│   │   │       └── app-health.spec.ts
│   │   ├── tsconfig.json
│   │   ├── types
│   │   │   └── e2e.types.ts
│   │   └── utils
│   │       ├── auth-bypass.ts
│   │       └── env-check.ts
│   ├── eslint.config.js
│   ├── Material Theme Figma.json
│   ├── package.json
│   ├── playwright
│   │   └── .auth
│   │       └── user.json
│   ├── playwright-report
│   │   └── index.html
│   ├── playwright.config.ts
│   ├── projects
│   │   └── webapp
│   │       ├── eslint.config.js
│   │       ├── public
│   │       │   ├── config.json
│   │       │   ├── favicon.ico
│   │       │   └── lottie
│   │       │       ├── README.md
│   │       │       ├── variations
│   │       │       │   ├── welcome-v1.json
│   │       │       │   └── welcome-v2.json
│   │       │       └── welcome-animation.json
│   │       ├── src
│   │       │   ├── _variables.scss
│   │       │   ├── app
│   │       │   │   ├── app.config.ts
│   │       │   │   ├── app.routes.ts
│   │       │   │   ├── app.ts
│   │       │   │   ├── core
│   │       │   │   │   ├── analytics
│   │       │   │   │   │   ├── analytics.spec.ts
│   │       │   │   │   │   ├── analytics.ts
│   │       │   │   │   │   ├── global-error-handler.ts
│   │       │   │   │   │   ├── http-error-interceptor.ts
│   │       │   │   │   │   ├── index.ts
│   │       │   │   │   │   ├── posthog-utils.spec.ts
│   │       │   │   │   │   ├── posthog-utils.ts
│   │       │   │   │   │   ├── posthog.spec.ts
│   │       │   │   │   │   └── posthog.ts
│   │       │   │   │   ├── angular-material.ts
│   │       │   │   │   ├── auth
│   │       │   │   │   │   ├── auth-api.ts
│   │       │   │   │   │   ├── auth-error-localizer.spec.ts
│   │       │   │   │   │   ├── auth-error-localizer.ts
│   │       │   │   │   │   ├── auth-guard.ts
│   │       │   │   │   │   ├── auth-interceptor.spec.ts
│   │       │   │   │   │   ├── auth-interceptor.ts
│   │       │   │   │   │   ├── auth-providers.ts
│   │       │   │   │   │   ├── index.ts
│   │       │   │   │   │   ├── public-guard.ts
│   │       │   │   │   │   └── README.md
│   │       │   │   │   ├── budget
│   │       │   │   │   │   ├── budget-api.ts
│   │       │   │   │   │   ├── budget-calculator.spec.ts
│   │       │   │   │   │   ├── budget-calculator.ts
│   │       │   │   │   │   └── index.ts
│   │       │   │   │   ├── config
│   │       │   │   │   │   ├── application-configuration.spec.ts
│   │       │   │   │   │   ├── application-configuration.ts
│   │       │   │   │   │   ├── config.schema.ts
│   │       │   │   │   │   ├── README.md
│   │       │   │   │   │   └── types.ts
│   │       │   │   │   ├── core.ts
│   │       │   │   │   ├── locale.ts
│   │       │   │   │   ├── logging
│   │       │   │   │   │   ├── logger.spec.ts
│   │       │   │   │   │   └── logger.ts
│   │       │   │   │   ├── README.md
│   │       │   │   │   ├── rollover
│   │       │   │   │   │   └── rollover-types.ts
│   │       │   │   │   ├── routing
│   │       │   │   │   │   ├── breadcrumb-state.ts
│   │       │   │   │   │   ├── index.ts
│   │       │   │   │   │   ├── README.md
│   │       │   │   │   │   ├── routes-constants.ts
│   │       │   │   │   │   ├── title-display.ts
│   │       │   │   │   │   └── title-strategy.ts
│   │       │   │   │   ├── template
│   │       │   │   │   │   ├── index.ts
│   │       │   │   │   │   └── template-api.ts
│   │       │   │   │   ├── testing
│   │       │   │   │   │   ├── index.ts
│   │       │   │   │   │   └── test-utils.ts
│   │       │   │   │   ├── transaction
│   │       │   │   │   │   ├── index.ts
│   │       │   │   │   │   └── transaction-api.ts
│   │       │   │   │   └── utils
│   │       │   │   │       ├── validators.spec.ts
│   │       │   │   │       └── validators.ts
│   │       │   │   ├── feature
│   │       │   │   │   ├── auth
│   │       │   │   │   │   └── login
│   │       │   │   │   │       └── login.ts
│   │       │   │   │   ├── budget
│   │       │   │   │   │   ├── budget-details
│   │       │   │   │   │   │   ├── budget-details-page.spec.ts
│   │       │   │   │   │   │   ├── budget-details-page.ts
│   │       │   │   │   │   │   ├── budget-financial-overview.ts
│   │       │   │   │   │   │   ├── budget-line-api
│   │       │   │   │   │   │   │   ├── budget-line-api.spec.ts
│   │       │   │   │   │   │   │   └── budget-line-api.ts
│   │       │   │   │   │   │   ├── budget-table
│   │       │   │   │   │   │   │   ├── budget-table-data-provider.spec.ts
│   │       │   │   │   │   │   │   ├── budget-table-data-provider.ts
│   │       │   │   │   │   │   │   ├── budget-table-models.ts
│   │       │   │   │   │   │   │   └── budget-table.ts
│   │       │   │   │   │   │   ├── create-budget-line
│   │       │   │   │   │   │   │   └── add-budget-line-dialog.ts
│   │       │   │   │   │   │   ├── edit-budget-line
│   │       │   │   │   │   │   │   └── edit-budget-line-dialog.ts
│   │       │   │   │   │   │   ├── models
│   │       │   │   │   │   │   │   ├── budget-details-view-model.ts
│   │       │   │   │   │   │   │   ├── budget-line-view-model.ts
│   │       │   │   │   │   │   │   └── transaction-view-model.ts
│   │       │   │   │   │   │   └── store
│   │       │   │   │   │   │       ├── budget-details-state.ts
│   │       │   │   │   │   │       ├── budget-details-store-integration.spec.ts
│   │       │   │   │   │   │       ├── budget-details-store.spec.ts
│   │       │   │   │   │   │       └── budget-details-store.ts
│   │       │   │   │   │   ├── budget-list
│   │       │   │   │   │   │   ├── budget-list-mapper
│   │       │   │   │   │   │   │   ├── budget-list.mapper.spec.ts
│   │       │   │   │   │   │   │   └── budget-list.mapper.ts
│   │       │   │   │   │   │   ├── budget-list-page.ts
│   │       │   │   │   │   │   ├── budget-list-store.ts
│   │       │   │   │   │   │   └── create-budget
│   │       │   │   │   │   │       ├── budget-creation-dialog.spec.ts
│   │       │   │   │   │   │       ├── budget-creation-dialog.ts
│   │       │   │   │   │   │       ├── services
│   │       │   │   │   │   │       │   ├── template-store.spec.ts
│   │       │   │   │   │   │       │   ├── template-store.ts
│   │       │   │   │   │   │       │   ├── template-totals-calculator.spec.ts
│   │       │   │   │   │   │       │   └── template-totals-calculator.ts
│   │       │   │   │   │   │       ├── template-details-dialog.ts
│   │       │   │   │   │   │       └── ui
│   │       │   │   │   │   │           ├── template-list-item.spec.ts
│   │       │   │   │   │   │           ├── template-list-item.ts
│   │       │   │   │   │   │           ├── template-view-model.ts
│   │       │   │   │   │   │           ├── templates-list.spec.ts
│   │       │   │   │   │   │           └── templates-list.ts
│   │       │   │   │   │   ├── budget.routes.ts
│   │       │   │   │   │   └── ui
│   │       │   │   │   │       ├── budget-error.ts
│   │       │   │   │   │       └── month-card-item.ts
│   │       │   │   │   ├── budget-templates
│   │       │   │   │   │   ├── budget-templates.routes.ts
│   │       │   │   │   │   ├── budget-templates.spec.ts
│   │       │   │   │   │   ├── components
│   │       │   │   │   │   │   ├── dialogs
│   │       │   │   │   │   │   │   ├── template-usage-dialog.spec.ts
│   │       │   │   │   │   │   │   └── template-usage-dialog.ts
│   │       │   │   │   │   │   ├── template-card.ts
│   │       │   │   │   │   │   ├── template-list.ts
│   │       │   │   │   │   │   └── templates-error.ts
│   │       │   │   │   │   ├── create
│   │       │   │   │   │   │   ├── components
│   │       │   │   │   │   │   │   ├── create-template-form.ts
│   │       │   │   │   │   │   │   ├── template-validators.spec.ts
│   │       │   │   │   │   │   │   └── template-validators.ts
│   │       │   │   │   │   │   ├── create-template-page.ts
│   │       │   │   │   │   │   └── ui
│   │       │   │   │   │   │       └── default-warning-panel.ts
│   │       │   │   │   │   ├── delete
│   │       │   │   │   │   │   └── template-delete-dialog.ts
│   │       │   │   │   │   ├── details
│   │       │   │   │   │   │   ├── components
│   │       │   │   │   │   │   │   ├── edit-transactions-dialog.spec.ts
│   │       │   │   │   │   │   │   ├── edit-transactions-dialog.ts
│   │       │   │   │   │   │   │   ├── index.ts
│   │       │   │   │   │   │   │   ├── README.md
│   │       │   │   │   │   │   │   └── transactions-table.ts
│   │       │   │   │   │   │   ├── services
│   │       │   │   │   │   │   │   ├── template-details-state.ts
│   │       │   │   │   │   │   │   ├── template-details-store.ts
│   │       │   │   │   │   │   │   ├── template-line-state.ts
│   │       │   │   │   │   │   │   ├── template-line-store.integration.spec.ts
│   │       │   │   │   │   │   │   ├── template-line-store.spec.ts
│   │       │   │   │   │   │   │   └── template-line-store.ts
│   │       │   │   │   │   │   ├── template-detail.spec.ts
│   │       │   │   │   │   │   └── template-detail.ts
│   │       │   │   │   │   ├── list
│   │       │   │   │   │   │   └── template-list-page.ts
│   │       │   │   │   │   └── services
│   │       │   │   │   │       ├── budget-templates-api.spec.ts
│   │       │   │   │   │       ├── budget-templates-api.ts
│   │       │   │   │   │       ├── budget-templates-state.ts
│   │       │   │   │   │       ├── budget-templates-store.spec.ts
│   │       │   │   │   │       └── transaction-form.ts
│   │       │   │   │   ├── current-month
│   │       │   │   │   │   ├── components
│   │       │   │   │   │   │   ├── add-transaction-bottom-sheet.ts
│   │       │   │   │   │   │   ├── budget-progress-bar.spec.ts
│   │       │   │   │   │   │   ├── budget-progress-bar.ts
│   │       │   │   │   │   │   ├── dashboard-error.ts
│   │       │   │   │   │   │   ├── edit-transaction-dialog.ts
│   │       │   │   │   │   │   ├── edit-transaction-form.spec.ts
│   │       │   │   │   │   │   ├── edit-transaction-form.ts
│   │       │   │   │   │   │   ├── financial-accordion.ts
│   │       │   │   │   │   │   ├── financial-entry.ts
│   │       │   │   │   │   │   ├── one-time-expenses-list.ts
│   │       │   │   │   │   │   ├── recurring-expenses-list.ts
│   │       │   │   │   │   │   └── transaction-chip-filter.ts
│   │       │   │   │   │   ├── current-month.routes.ts
│   │       │   │   │   │   ├── current-month.spec.ts
│   │       │   │   │   │   ├── current-month.ts
│   │       │   │   │   │   ├── models
│   │       │   │   │   │   │   └── financial-entry.model.ts
│   │       │   │   │   │   ├── services
│   │       │   │   │   │   │   ├── current-month-state.ts
│   │       │   │   │   │   │   ├── current-month-store.spec.ts
│   │       │   │   │   │   │   └── current-month-store.ts
│   │       │   │   │   │   └── utils
│   │       │   │   │   │       ├── financial-entry-mapper.ts
│   │       │   │   │   │       └── transaction-form-validators.ts
│   │       │   │   │   ├── legal
│   │       │   │   │   │   ├── components
│   │       │   │   │   │   │   ├── privacy-policy.ts
│   │       │   │   │   │   │   └── terms-of-service.ts
│   │       │   │   │   │   └── legal.routes.ts
│   │       │   │   │   ├── onboarding
│   │       │   │   │   │   ├── models
│   │       │   │   │   │   │   ├── onboarding-layout-data.ts
│   │       │   │   │   │   │   └── onboarding-step.ts
│   │       │   │   │   │   ├── onboarding-constants.ts
│   │       │   │   │   │   ├── onboarding-layout.ts
│   │       │   │   │   │   ├── onboarding-state.ts
│   │       │   │   │   │   ├── onboarding-step-guard.spec.ts
│   │       │   │   │   │   ├── onboarding-step-guard.ts
│   │       │   │   │   │   ├── onboarding-store-integration.spec.ts
│   │       │   │   │   │   ├── onboarding-store-unit.spec.ts
│   │       │   │   │   │   ├── onboarding-store.ts
│   │       │   │   │   │   ├── onboarding.routes.ts
│   │       │   │   │   │   ├── onboarding.types.spec.ts
│   │       │   │   │   │   ├── onboarding.types.ts
│   │       │   │   │   │   ├── services
│   │       │   │   │   │   │   └── onboarding-api.ts
│   │       │   │   │   │   ├── steps
│   │       │   │   │   │   │   ├── health-insurance.ts
│   │       │   │   │   │   │   ├── housing.ts
│   │       │   │   │   │   │   ├── income.ts
│   │       │   │   │   │   │   ├── leasing-credit.ts
│   │       │   │   │   │   │   ├── personal-info.ts
│   │       │   │   │   │   │   ├── phone-plan.ts
│   │       │   │   │   │   │   ├── registration.ts
│   │       │   │   │   │   │   ├── transport.ts
│   │       │   │   │   │   │   └── welcome.ts
│   │       │   │   │   │   └── ui
│   │       │   │   │   │       └── currency-input.ts
│   │       │   │   │   └── README.md
│   │       │   │   ├── layout
│   │       │   │   │   ├── main-layout.spec.ts
│   │       │   │   │   ├── main-layout.ts
│   │       │   │   │   ├── navigation-menu.ts
│   │       │   │   │   └── README.md
│   │       │   │   ├── pattern
│   │       │   │   │   └── README.md
│   │       │   │   ├── styles
│   │       │   │   │   ├── _base.scss
│   │       │   │   │   ├── _dialogs.scss
│   │       │   │   │   ├── _financial-colors.scss
│   │       │   │   │   ├── _sizes.scss
│   │       │   │   │   ├── _tabs.scss
│   │       │   │   │   ├── main.scss
│   │       │   │   │   ├── themes
│   │       │   │   │   │   ├── _dark.scss
│   │       │   │   │   │   ├── _theme-colors.scss
│   │       │   │   │   │   └── _warn.scss
│   │       │   │   │   └── vendors
│   │       │   │   │       └── _tailwind.css
│   │       │   │   ├── testing
│   │       │   │   │   ├── mock-factories.ts
│   │       │   │   │   └── mock-posthog.ts
│   │       │   │   └── ui
│   │       │   │       ├── breadcrumb
│   │       │   │       │   ├── breadcrumb-item.directive.ts
│   │       │   │       │   ├── breadcrumb-separator.directive.ts
│   │       │   │       │   ├── breadcrumb.examples.ts
│   │       │   │       │   ├── breadcrumb.spec.ts
│   │       │   │       │   ├── breadcrumb.ts
│   │       │   │       │   └── README.md
│   │       │   │       ├── calendar
│   │       │   │       │   ├── calendar-types.ts
│   │       │   │       │   ├── index.ts
│   │       │   │       │   ├── month-tile.ts
│   │       │   │       │   └── year-calendar.ts
│   │       │   │       ├── dialogs
│   │       │   │       │   └── confirmation-dialog.ts
│   │       │   │       ├── error-card.ts
│   │       │   │       ├── financial-summary
│   │       │   │       │   └── financial-summary.ts
│   │       │   │       ├── index.ts
│   │       │   │       ├── loading
│   │       │   │       │   ├── base-loading.ts
│   │       │   │       │   └── index.ts
│   │       │   │       ├── README.md
│   │       │   │       ├── rollover-format
│   │       │   │       │   ├── index.ts
│   │       │   │       │   ├── rollover-format.pipe.spec.ts
│   │       │   │       │   └── rollover-format.pipe.ts
│   │       │   │       └── transaction-display
│   │       │   │           ├── index.ts
│   │       │   │           ├── recurrence-label.pipe.spec.ts
│   │       │   │           ├── recurrence-label.pipe.ts
│   │       │   │           ├── transaction-icon.pipe.spec.ts
│   │       │   │           ├── transaction-icon.pipe.ts
│   │       │   │           ├── transaction-label.pipe.spec.ts
│   │       │   │           └── transaction-label.pipe.ts
│   │       │   ├── environments
│   │       │   │   ├── build-info.ts
│   │       │   │   ├── environment.development.ts
│   │       │   │   └── environment.ts
│   │       │   ├── index.html
│   │       │   ├── main.ts
│   │       │   ├── styles.scss
│   │       │   └── test-setup.ts
│   │       ├── tsconfig.app.json
│   │       └── tsconfig.spec.json
│   ├── README.md
│   ├── run-tests.md
│   ├── scripts
│   │   ├── generate-build-info.js
│   │   ├── generate-config.js
│   │   └── upload-sourcemaps.js
│   ├── STATE-PATTERN.md
│   ├── test-results
│   │   └── .last-run.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── lefthook.yml
├── memory-bank
│   ├── ARCHITECTURE.md
│   ├── CODEBASE_STRUCTURE.md
│   ├── DATABASE.mmd
│   ├── DECISION.md
│   ├── DESGIN.md
│   ├── generate-codebase-structure.sh
│   ├── INFRASTRUCTURE.md
│   ├── PROJECT_BRIEF.md
│   └── SPECS.md
├── mobile
│   ├── .claude
│   │   └── settings.local.json
│   └── PulpeApp
│       └── Core
│           └── Components
├── MONOREPO.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── railway.json
├── README.md
├── shared
│   ├── .prettierignore
│   ├── .prettierrc
│   ├── bun.lock
│   ├── CHANGELOG.md
│   ├── ESM_NOTES.md
│   ├── index.ts
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── README.md
│   ├── schemas.ts
│   ├── src
│   │   ├── calculators
│   │   │   ├── budget-formulas.spec.ts
│   │   │   ├── budget-formulas.ts
│   │   │   └── index.ts
│   │   └── types.ts
│   ├── tsconfig.esm.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── supabase-github-ci.md
├── sync-env.sh
├── turbo.json
└── vercel.json

177 directories, 767 files
```

</details>

---

## 🚀 Quick Navigation

### Development Commands
- **Start all services**: `pnpm dev`
- **Frontend only**: `pnpm dev:frontend`
- **Backend only**: `pnpm dev:backend`
- **Run tests**: `pnpm test`
- **Build all**: `pnpm build`

### Key Configuration Files
- `turbo.json` - Turborepo configuration
- `package.json` - Root package configuration
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `CLAUDE.md` - AI assistant instructions

### Documentation
- `README.md` - Project overview and setup
- `CLAUDE.md` - Development guidelines
- `CI.md` - Continuous integration setup
- `supabase-github-ci.md` - Supabase CI/CD guide

---

*Generated automatically by `generate-codebase-structure.sh`*
*To regenerate: `cd memory-bank && ./generate-codebase-structure.sh`*
