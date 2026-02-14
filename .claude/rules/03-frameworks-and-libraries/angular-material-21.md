---
description: Angular Material 21 component APIs, breaking changes from v20, and correct usage patterns
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.html"
  - "frontend/**/*.scss"
---

# Angular Material 21

**Version installed: `@angular/material@21.0.5`**

Your training data may contain outdated Material 18/19/20 patterns. This rule is the source of truth for Material 21 APIs.

## Button Directives

```html
<!-- Material 21: unified matButton directive -->
<button matButton>Text button</button>
<button matButton="filled">Primary action</button>
<button matButton="outlined">Secondary action</button>
<button matButton="tonal">Tonal button</button>
<button matButton="elevated">Elevated button</button>

<!-- Icon buttons -->
<button matIconButton aria-label="Close">
  <mat-icon>close</mat-icon>
</button>

<!-- FAB -->
<button matFab><mat-icon>add</mat-icon></button>
<button matMiniFab><mat-icon>edit</mat-icon></button>
```

### Removed Selectors (DO NOT USE)

```html
<!-- NEVER: removed in v21 -->
mat-button
mat-raised-button
mat-flat-button
mat-stroked-button
mat-icon-button
mat-fab
mat-mini-fab
```

## Form Fields

```html
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Label</mat-label>
  <input matInput />
  <mat-hint>Hint text</mat-hint>
  <mat-error>Error message</mat-error>
</mat-form-field>
```

| Property | Values | Note |
|----------|--------|------|
| `appearance` | `outline`, `fill` | `legacy`, `standard` removed |
| `subscriptSizing` | `fixed` (default), `dynamic` | `dynamic` preferred — avoids reserved space |

Rules:
- **Always** use explicit `<mat-label>` — placeholder promotion removed
- **Always** prefer `subscriptSizing="dynamic"` (project convention)

## Imports Pattern

Import **modules** in standalone components:

```typescript
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
})
```

## Removed APIs in v21

### Animation Exports (all removed)

```typescript
// NEVER import these — removed in v21
matDialogAnimations
matBottomSheetAnimations
matExpansionAnimations
matFormFieldAnimations
matMenuAnimations
matSelectAnimations
matDrawerAnimations
matSnackBarAnimations
matSortAnimations
matStepperAnimations
matTabsAnimations
matTooltipAnimations
```

Components now use CSS-based animations internally.

### Removed Modules & Symbols

```typescript
// NEVER import — removed in v21
MatCommonModule
GranularSanityChecks
MATERIAL_SANITY_CHECKS
MAT_DIALOG_SCROLL_STRATEGY_PROVIDER
MAT_DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY
```

### Dialog Config

```typescript
// NEVER: componentFactoryResolver removed in v21
this.dialog.open(MyComponent, { componentFactoryResolver: ... });

// CORRECT: just open
this.dialog.open(MyComponent, { width: '400px' });
```

### SelectionModel Return Types Changed

```typescript
// v21: select/deselect/clear now return boolean
const changed: boolean = selectionModel.select(item);
const wasCleared: boolean = selectionModel.clear();
```

### Portal Directives

```typescript
// NEVER: removed
TemplatePortalDirective
PortalHostDirective

// USE instead:
CdkPortal
CdkPortalOutlet
```

### Tree Control

```typescript
// DEPRECATED in v21:
FlatTreeControl

// USE instead: levelAccessor or childrenAccessor
<mat-tree [dataSource]="dataSource" [levelAccessor]="getLevel">
```

### DateAdapter

```typescript
// NEVER: NativeDateAdapter no longer accepts Platform in constructor
// NEVER: useUtcForDisplay removed
// USE: Angular DI inject() — do not instantiate directly
```

## M3 Design Tokens

Material 21 uses `--mat-sys-*` CSS custom properties:

### Colors

```scss
// Primary
--mat-sys-primary
--mat-sys-on-primary
--mat-sys-primary-container
--mat-sys-on-primary-container

// Surface
--mat-sys-surface
--mat-sys-on-surface
--mat-sys-surface-container
--mat-sys-surface-container-low
--mat-sys-surface-container-high

// Outline
--mat-sys-outline
--mat-sys-outline-variant

// Error
--mat-sys-error
--mat-sys-on-error
```

### Typography

```scss
--mat-sys-display-large
--mat-sys-headline-large
--mat-sys-title-medium
--mat-sys-body-medium
--mat-sys-label-large
```

### Elevation

```scss
--mat-sys-level0    /* no shadow */
--mat-sys-level1    /* subtle */
--mat-sys-level2    /* medium */
--mat-sys-level3    /* prominent */
```

### Project Convention

Use Pulpe tokens (`--p-*`, `--pulpe-*`) over raw `--mat-sys-*` in components.
`--mat-sys-*` tokens are for theme definition and Material component overrides only.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `mat-raised-button` | `matButton="filled"` |
| `mat-flat-button` | `matButton="filled"` |
| `mat-stroked-button` | `matButton="outlined"` |
| `mat-icon-button` | `matIconButton` |
| `appearance="legacy"` | `appearance="outline"` |
| `appearance="standard"` | `appearance="outline"` |
| `matDialogAnimations` | Remove — now CSS-based |
| `FlatTreeControl` | `levelAccessor` / `childrenAccessor` |
| `color: #hex` in component | `color: var(--p-primary)` |
| `background: var(--mat-sys-primary)` in component | `background: var(--p-primary)` (use Pulpe tokens) |
