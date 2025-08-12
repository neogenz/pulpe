# CLAUDE.md - Frontend

This file provides specific guidance for Claude Code when working with the Angular frontend application.

## Quick Start Commands

```bash
# Development
pnpm run start                     # Start dev server and open browser
pnpm run start:ci                  # Start dev server without opening browser
pnpm run dev                       # Alias for ng serve
pnpm run build                     # Build for production
pnpm run watch                     # Build in watch mode for development

# Testing
pnpm run test                      # Run unit tests with Vitest
pnpm run test:watch                # Run unit tests in watch mode
pnpm run test:e2e                  # Run end-to-end tests with Playwright
pnpm run test:e2e:ui               # Run Playwright tests with UI
pnpm run test:e2e:headed           # Run E2E tests in headed mode
pnpm run test:e2e:debug            # Debug E2E tests
pnpm run test:e2e:report           # Show E2E test report
pnpm run test:e2e:codegen          # Generate E2E test code

# Quality & Analysis
pnpm run lint                      # Run ESLint
pnpm run format                    # Apply Prettier formatting
pnpm run format:check              # Check Prettier formatting
pnpm run analyze                   # Bundle analyzer with treemap
pnpm run analyze:sme               # Source map explorer analysis
pnpm run analyze:deps              # Dependency analysis with madge
pnpm run deps:circular             # Check for circular dependencies
```

## Angular CLI Commands

- Use Angular CLI mcp to create angular object. Or Angular CLI if mcp is not accessible.

## Architecture

### Framework & Technologies

- **Angular 20** with standalone components
- **Change Detection**: OnPush strategy for performance optimization
- **Styling**: Tailwind CSS v4 + Angular Material v20
- **Auth**: Supabase client with guards and interceptors
- **Validation**: Zod schemas from `@pulpe/shared`
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Build**: Angular CLI with esbuild

### Architectural Principles

1. **Standalone Components**: No NgModules, everything is standalone
2. **Signal-based**: Use Angular signals for reactive state management
3. **Lazy Loading**: All features must be lazy-loaded for optimal performance
4. **Strict Isolation**: Features cannot depend on each other directly
5. **OnPush Strategy**: All components use OnPush change detection
6. **Acyclic Dependencies**: Strict one-way dependency graph enforced by eslint-plugin-boundaries

### Directory Structure

```
projects/webapp/src/app/
├── core/                    # Application-wide services, guards, interceptors
├── layout/                  # App shell components (header, footer, navigation)
├── ui/                      # Generic, reusable, stateless components
├── feature/                 # Business domain features (lazy-loaded)
├── pattern/                 # Reusable stateful components
└── styles/                  # Global styles and theming
```

### Architectural Types

#### Core (`core/`)

- **Purpose**: Central hub for shared, headless application logic
- **Content**: Services, guards, interceptors, state management setup
- **Loading**: Eager-loaded (part of main bundle)
- **Constraints**: No components, directives, or pipes with templates

#### Layout (`layout/`)

- **Purpose**: Application shell and main structure
- **Content**: Header, footer, navigation, main router-outlet
- **Loading**: Eager-loaded
- **Dependencies**: Can use `core` services and `ui` components

#### UI (`ui/`)

- **Purpose**: Reusable, stateless presentation components
- **Content**: Generic components, directives, pipes
- **Loading**: Cherry-picked by consuming modules
- **Constraints**: Must be stateless, no service injection, only @Input/@Output

#### Feature (`feature/`)

- **Purpose**: Business domain implementations
- **Content**: Smart components, feature services, routing
- **Loading**: Always lazy-loaded via `loadChildren`
- **Constraints**: Complete isolation - no direct dependencies between features

#### Pattern (`pattern/`)

- **Purpose**: Reusable stateful components
- **Content**: Cross-cutting functionality with state management
- **Loading**: Imported by features as needed
- **Example**: Document manager, approval widget, audit log

### Dependency Rules

```
core     ← layout, feature, pattern
ui       ← layout, feature, pattern
pattern  ← feature
feature  ← (isolated, no sibling dependencies)
```

### Feature Structure

```
feature/[domain]/
├── components/              # Domain-specific components
├── services/               # Domain services and state
├── ui/                     # Feature-specific UI components
├── [domain].routes.ts      # Feature routing
└── [domain].ts            # Main feature component
```

## Development Patterns

### Component Guidelines

1. **Logic-free Components**: Delegate business logic to services
2. **OnPush Strategy**: Use `changeDetection: ChangeDetectionStrategy.OnPush`
3. **Signal-based**: Prefer signals over traditional observables
4. **Standalone**: All components must be standalone
5. **Private Fields**: Use `#fieldName` syntax instead of `private`

### Routing

- Use `loadChildren` with `.routes.ts` files for lazy loading
- Avoid `loadComponent` for feature-level routing
- Route guards in `core/guards/`

### State Management

- Use Angular signals for local state
- Feature-specific state services in `feature/[domain]/services/`
- Shared state in `core/services/`

### Testing

#### Unit Tests (Vitest)

- Test files: `*.spec.ts`
- Focus on component logic and service behavior
- Use Angular testing utilities with Vitest
- Mock external dependencies

#### E2E Tests (Playwright)

- Tests in `e2e/` directory
- Use `data-testid` attributes for element selection
- Page Object Model pattern
- Comprehensive user flow testing

### Design System - Material Design 3

The application implements **Material Design 3** (Material You) through a dual approach:

- **Angular Material v20** for component base implementation
- **Tailwind CSS v4** for custom styling and responsive design

#### Material Design 3 Core Principles

**CRITICAL**: All UI must strictly follow Material Design 3 specifications:

1. **Dynamic Color System**: Use color roles, not fixed colors
2. **Adaptive Surfaces**: Implement proper elevation and surface containers
3. **Expressive Typography**: Follow Material Design 3 type scale
4. **Responsive Layout**: Mobile-first approach with adaptive breakpoints
5. **Motion & Interaction**: Use Material motion patterns

#### Surface Containers & Elevation

Use correct surface containers based on content hierarchy:

```html
<!-- Primary content -->
<div class="bg-*">Content</div>
```

By using Tailwind overriding defined here : @frontend/projects/webapp/src/app/styles/vendors/\_tailwind.css

#### Color System Integration

**Angular Material + Tailwind Color Mapping**:

The color system uses CSS variables mapped in `@theme inline` section of @frontend/projects/webapp/src/app/styles/vendors/\_tailwind.css

**IMPORTANT**: Use arbitrary values syntax `bg-primary` since colors are defined as CSS variables.

#### Typography System

**Material Design 3 Type Scale** (via Tailwind utilities):

```html
<div class="text-*">Text</div>
```

By using Tailwind overriding defined here : @frontend/projects/webapp/src/app/styles/vendors/\_tailwind.css

#### Responsive Design - Mobile First

**MANDATORY**: All layouts must be responsive and mobile-first:

```html
<!-- Mobile first approach -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <!-- Content adapts from mobile to desktop -->
</div>

<!-- Touch targets - minimum 44px -->
<button class="min-h-[44px] min-w-[44px] p-3">Touch-friendly button</button>

<!-- Responsive spacing -->
<div class="p-4 md:p-6 lg:p-8">
  <!-- Spacing increases with screen size -->
</div>
```

#### Angular Material Component Usage

**Base Components**: Always start with Angular Material components:

```typescript
// Import Material components
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
```

**Customization**: Override with Material system variables:

```scss
// Component-specific overrides
.custom-button {
  --mdc-filled-button-container-color: var(--mat-sys-primary);
  --mdc-filled-button-label-text-color: var(--mat-sys-on-primary);
}
```

#### Tailwind CSS v4 Integration

**Configuration**: Located in `projects/webapp/src/app/styles/vendors/_tailwind.css`

**Key Features**:

- Full Material Design 3 color palette mapped to Tailwind
- Typography scale utilities (`text-display-large`, `text-body-medium`, etc.)
- Angular Material radius variables (use arbitrary values: `rounded-corner-medium`)
- Dark mode support with `.dark-theme` class
- Custom financial color utilities (`text-financial-income`, `text-financial-negative`)
- Custom utility classes (`form-field-error-icon`, `icon-filled`)
- Built-in animations (`animate-fadeIn`, `animate-marquee`)

#### Mobile-First Breakpoints

**Responsive Design Guidelines**:

Follow Tailwind standards breakpoint.

**Standard Breakpoints**:

- Mobile: < 768px (default)
- Tablet: 768px - 1023px (`md:`)
- Desktop: 1024px - 1279px (`lg:`)
- Large Desktop: ≥ 1280px (`xl:`)

#### Form Design

**Material Design 3 Forms**:

```html
<mat-form-field>
  <mat-label>Enter your email</mat-label>
  <input matInput placeholder="pat@example.com" [formControl]="email" (blur)="updateErrorMessage()" required />
  @if (email.invalid) {
  <mat-error>{{errorMessage()}}</mat-error>
  }
</mat-form-field>
```

## Code Quality

### ESLint Configuration

- Angular-specific rules
- Boundary enforcement between architectural layers
- Import/export organization
- TypeScript strict mode

### Prettier Configuration

- Consistent formatting across TypeScript, HTML, SCSS
- Integrated with ESLint for conflict-free setup

### Performance Optimization

- Bundle analysis with `analyze` scripts
- Tree-shaking optimization
- Lazy loading for all features
- OnPush change detection strategy

## Authentication Flow

1. Supabase Auth integration in `core/services/auth.service.ts`
2. Auth guards protect feature routes
3. Interceptors add Bearer tokens to API requests
4. User context available throughout the app

## Error Handling

- Global error handler in `core/`
- Feature-specific error components
- User-friendly error messages
- Proper error logging and monitoring

## Build & Deployment

- Production build: `pnpm run build`
- Bundle analysis: `pnpm run analyze`
- Source map analysis: `pnpm run analyze:sme`
- Deployment-ready artifacts in `dist/webapp/`

## Key Files

- `projects/webapp/src/app/app.config.ts` - Application configuration
- `projects/webapp/src/main.ts` - Application bootstrap
- `projects/webapp/src/app/styles/` - Global styles and theming - HERE is the Tailwind overriding with Angular Material System Variables implementing well Material Design 3
- `projects/webapp/src/app/core/` - Core application services
- `e2e/` - End-to-end test suites

## UX Guidelines & Vocabulary

### Business Vocabulary (Critical for Consistency)

**IMPORTANT**: Pulpe maintains a strict separation between planning and reality. Follow this vocabulary precisely:

#### Core Terminology

- **`budget_lines` (Technical)** = **"prévisions"** (User-facing)
  - Use "prévisions" in ALL user interfaces
  - Never use "lignes budgétaires" (too technical)
  - Examples: "Nouvelle prévision", "Prévisions du budget", "Aucune prévision définie"

#### Financial Overview Labels

- **"Disponible à dépenser"** (not "Reste disponible")
- **"Épargne prévue"** (not "Économies")
- **"Fréquence"** (not "Récurrence")

#### Recurrence/Frequency Options

- **"Tous les mois"** (for `fixed` value) - recurring monthly expenses/income
- **"Une seule fois"** (for `one_off` value) - one-time transactions
- **"Variable"** (for `variable` value) - when applicable

#### Transaction Types

- **Default type**: `expense` (Dépense) - most common use case
- **Available types**:
  - "Revenu" (`income`)
  - "Dépense" (`expense`)
  - "Épargne" (`saving`)

### UX Principles Applied

This vocabulary and UX must follows **Nielsen's 10 Usability Heuristics**, **Bastien & Scapin 8 Ergonomic Criteria**, and **ISO 9241-210:2019**:

1. **Match between system and real world**: "Tous les mois" vs technical "Montant fixe"
2. **Recognition rather than recall**: Clear, descriptive labels
3. **Consistency**: Same vocabulary across all components
4. **Error prevention**: Logical defaults (Dépense, Tous les mois)

### Message Patterns

- **Success**: "Prévision ajoutée."
- **Delete success**: "Prévision supprimée."
- **Confirmation**: "Êtes-vous sûr de vouloir supprimer cette prévision ?"
- **Empty states**: "Aucune prévision définie", "Commencer à planifier"

## Angular Material Best Practices

- **Button Directives (v20)**: Utilise les nouvelles directives Angular Material v20 :
  - `matButton` (text par défaut)
  - `matButton="filled"` (remplace mat-flat-button)
  - `matButton="outlined"` (remplace mat-stroked-button)
  - `matButton="elevated"` (remplace mat-raised-button)
  - `matButton="tonal"`
  - `matIconButton` (remplace mat-icon-button)
  - `matFab` (remplace mat-fab)
  - `matMiniFab` (remplace mat-mini-fab)

## Testing Utilities

- **Location**: `/app/core/testing/`
- **`createMockResourceRef<T>(initialValue)`**: Mock Angular's ResourceRef for tests

```typescript
import { createMockResourceRef } from '../../../core/testing';

const mockResource = createMockResourceRef<BudgetTemplate[]>([]);
mockResource.value.set([{ id: '1', name: 'Template' }]);
```

## State Management Best Practices

- Directly use public state service when the context is lightweight to avoid unnecessary boilerplate
- Advantages of direct state access:
  - Simplify code structure
  - Reduce code duplication
  - More direct access to service properties
  - Clearer and more straightforward implementation

## Application Information System

### Overview

The application implements a modern build information system following 2025 standards for Angular 20. It provides comprehensive metadata about the application including version, build details, environment configuration, and Git commit information.

### Architecture

#### Core Service: `ApplicationInfo` (Angular 20 Naming Convention)

**Location**: `core/services/application-info.ts`

- **Modern Naming**: Follows Angular 20 convention (no `.service` suffix)
- **Signal-based**: Uses Angular signals for reactive state management
- **Standalone Injectable**: Compatible with standalone components architecture

#### Build Information Generation

**Script**: `scripts/generate-build-info.js`

Automatically generates build metadata at compile time:

```bash
# Generate build info before development
pnpm run generate:build-info:dev

# Generate build info before production build  
pnpm run generate:build-info
```

**Generated Files**:
- `src/environments/build-info.ts` - Production build metadata
- `src/environments/build-info.development.ts` - Development build metadata

#### Debug Component: `AppInfoDebug`

**Location**: `ui/debug-screen/app-info-debug.ts`

- **Material Design 3**: Full MD3 compliance with Tailwind CSS v4
- **Responsive**: Mobile-first design with adaptive breakpoints
- **Feature-rich**: Interactive options, copy functionality, expandable sections
- **Development-only**: Accessible via `/app/debug` route (only when `enableDebug: true`)

### Available Data

The `ApplicationInfo` service exposes the following information through signals:

```typescript
interface ApplicationInfo {
  environment: {
    production: boolean;
  };
  versionEnv: {
    version: string;           // "2025.8.0"
    commitHash: string;        // Full Git commit hash
    shortCommitHash: string;   // 7-character Git hash
    buildDate: string;         // ISO timestamp
    buildTimestamp: number;    // Unix timestamp
  };
  config: {
    apiPath: string;           // "/api/v1"
    backendUrl: string;        // "http://localhost:3000"
    environmentName: string;   // "development" | "production"
    enableDebug: boolean;      // Debug mode flag
    isProduction: boolean;     // Production flag
    fullApiUrl: string;        // Computed full API URL
  };
}
```

### Usage Examples

#### Service Injection (Angular 20 Style)

```typescript
import { inject } from '@angular/core';
import { ApplicationInfo } from '@core/services/application-info';

@Component({
  selector: 'pulpe-my-component',
  standalone: true,
  template: `
    <p>Version: {{ appInfo.formattedVersion() }}</p>
    <p>Environment: {{ appInfo.config().environmentName }}</p>
  `
})
export class MyComponent {
  readonly appInfo = inject(ApplicationInfo);
}
```

#### Computed Values

The service provides reactive computed values:

```typescript
readonly formattedVersion = computed(() => 
  `${versionInfo.version} (${versionInfo.shortCommitHash})`
);

readonly formattedBuildDate = computed(() => 
  // Localized date formatting based on display options
);

readonly isDebugMode = computed(() => this.config().enableDebug);
```

#### Display Options

```typescript
// Update date format display
applicationInfo.updateDisplayOptions({ 
  dateFormat: 'relative' // 'short' | 'long' | 'relative'
});

// Get JSON representation
const jsonData = applicationInfo.toJSON(true); // includeAll = true

// Get string representation  
const summary = applicationInfo.toString(); // "2025.8.0 (fdbbf7b) - development"
```

### Build Integration

#### Package.json Scripts

All development and build scripts automatically generate build information:

```json
{
  "scripts": {
    "start": "npm run generate:build-info:dev && ng serve --open",
    "dev": "npm run generate:build-info:dev && ng serve --host 0.0.0.0",
    "build": "npm run generate:build-info && ng build",
    "generate:build-info": "node scripts/generate-build-info.js"
  }
}
```

#### CI/CD Compatibility

- **Git Integration**: Automatically detects Git commit information
- **Fallback Handling**: Graceful degradation when Git is not available
- **Docker Ready**: Works in containerized environments
- **Environment Aware**: Different metadata for dev/staging/production

### Debug Screen Features

Access via `/app/debug` route (development only):

1. **Version Information**
   - Formatted version display
   - Environment indicators
   - Build timestamp with relative time

2. **Git Details**
   - Full and short commit hashes  
   - Expandable sections for detailed info

3. **API Configuration**
   - Backend URL and API paths
   - Full API URL construction
   - Environment-specific settings

4. **Interactive Features**
   - Copy all information to clipboard
   - Copy JSON data separately
   - Toggle date format options
   - Expandable detail sections

5. **Material Design 3**
   - Adaptive color system
   - Proper surface containers
   - Responsive typography scale
   - Touch-friendly interactions

### Environment Configuration

**Development** (`environment.development.ts`):
```typescript
{
  production: false,
  apiPath: '/api/v1',
  backendUrl: 'http://localhost:3000',
  environmentName: 'development', 
  enableDebug: true
}
```

**Production** (`environment.ts`):
```typescript
{
  production: true,
  apiPath: '/api/v1',
  backendUrl: 'http://localhost:3000',
  environmentName: 'production',
  enableDebug: false
}
```

### Best Practices

1. **Use Signals**: Leverage the reactive computed values for optimal performance
2. **Development Only**: Keep debug screens accessible only in non-production environments  
3. **Build Integration**: Always run build info generation before compilation
4. **Error Handling**: Service includes fallback mechanisms for missing build data
5. **Type Safety**: Full TypeScript coverage with comprehensive interfaces

### Troubleshooting

#### Build Info Generation Issues

```bash
# Manual generation
node scripts/generate-build-info.js

# Check generated files
ls -la src/environments/build-info*
```

#### Route Access Issues

- Debug route is only available when `environment.enableDebug: true`
- Ensure user is authenticated (protected by `authGuard`)
- Check browser console for routing errors

#### Missing Build Data

The service gracefully handles missing build information:
- Uses package.json version as fallback
- Provides default timestamps for development
- Shows meaningful defaults in UI