# UI Components Architecture

The `ui/` directory contains a library of generic, reusable, and purely presentational ("dumb") standalone components that are completely decoupled from application business logic.

## Purpose & Content

**Purpose**: Provide a library of generic, reusable UI components that can be consumed by any part of the application.

**Content**:

- **Only standalone components, directives, and pipes** (template context based)
- Generic, reusable presentational elements
- Communication exclusively via `input()` and `output()` signal functions
- No services or headless logic

**Loading**: Eager/lazy - bundler optimizes placement based on usage through cherry-picking.

## What Belongs in UI

### ✅ Include

- Generic UI components (buttons, cards, modals, avatars)
- Reusable directives (drag, drop, focusTrap)
- Pure pipes for display formatting
- Data display components (tables, lists)
- Loading indicators and spinners
- Typography and icon components
- Custom design system components

### ❌ Exclude

- Components that inject services (use `pattern/`)
- Components bound to specific state
- Business logic or API calls
- Feature-specific components
- Services or other injectables
- Components that import from `core/`

## Core Characteristics

All UI components MUST be:

- **Stateless**: Never inject services or access state directly
- **Pure**: No side effects, only transform inputs to outputs
- **Generic**: Reusable across multiple features, patterns, and layouts
- **Presentational**: Only concerned with how things look and user interactions
- **Standalone**: Self-contained with explicit template context
- **Decoupled**: Cannot import from `core/`, `feature/`, or `pattern/`

## Folder Structure

```
ui/
├── button/
│   ├── button.component.ts
│   └── button.component.spec.ts
├── card/
│   ├── card.component.ts
│   └── card.model.ts           # Component-specific interfaces
├── data-table/
│   ├── data-table.component.ts
│   └── data-table.model.ts
├── avatar/
│   ├── avatar.component.ts
│   └── avatar.model.ts         # Self-contained Avatar interface
├── directives/
│   ├── drag.directive.ts
│   └── drop.directive.ts
└── pipes/
    └── format-date.pipe.ts
```

## Example Implementation

### Generic UI Component

```typescript
// ui/avatar/avatar.model.ts
export interface AvatarData {
  imageUrl?: string;
  name: string;
  initials?: string;
}

// ui/avatar/avatar.component.ts
@Component({
  selector: "app-ui-avatar",

  imports: [CommonModule],
  template: `
    <div class="avatar" [class.avatar--large]="size() === 'large'">
      @if (data().imageUrl) {
        <img [src]="data().imageUrl" [alt]="data().name" />
      } @else {
        <span class="avatar__initials">{{ initials() }}</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiAvatarComponent {
  // Self-contained interface, not importing from core
  readonly data = input.required<AvatarData>();
  readonly size = input<"small" | "medium" | "large">("medium");
  readonly clicked = output<void>();

  protected readonly initials = computed(() => {
    const d = this.data();
    return (
      d.initials ||
      d.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    );
  });
}
```

## Usage Examples

### In Feature Component

```typescript
// feature/users/components/user-list.component.ts
import { UiAvatarComponent } from "@app/ui/avatar/avatar.component";
import { UiButtonComponent } from "@app/ui/button/button.component";

@Component({
  imports: [UiAvatarComponent, UiButtonComponent, CommonModule],
  template: `
    @for (user of users(); track user.id) {
      <div class="user-item">
        <!-- UI component receives data via input -->
        <app-ui-avatar
          [data]="{
            imageUrl: user.avatarUrl,
            name: user.fullName,
          }"
          (clicked)="selectUser(user)"
        />

        <app-ui-button variant="primary" (clicked)="editUser(user)"> Edit </app-ui-button>
      </div>
    }
  `,
})
export class UserListComponent {
  // Feature component handles state and business logic
  private userService = inject(UserService);
  readonly users = this.userService.users;

  selectUser(user: User) {
    /* ... */
  }
  editUser(user: User) {
    /* ... */
  }
}
```

## When to Create UI Components

Create a UI component when:

1. **3+ occurrences**: The same visual pattern appears in 3+ features (isolation > DRY)
2. **Generic enough**: Component can work with any data via inputs/outputs
3. **No state dependency**: Component doesn't need services or state management
4. **Custom design**: You need styling beyond what libraries provide
5. **Consistent behavior**: You want uniform interaction patterns

## Bundling Behavior

UI components are optimized by the bundler based on usage:

1. **Used only in layout** → Bundled in eager `main.js`
2. **Used in layout + features** → Bundled in eager `main.js`
3. **Used in multiple lazy features** → Extracted to shared chunk
4. **Used in single lazy feature** → Consider moving to that feature

> 💡 Keep component location precise: If only used in one place, move it there!

## Handling Types and Interfaces

### Preferred Approach: Self-Contained Interfaces

UI components should define their own interfaces:

```typescript
// ui/user-card/user-card.model.ts
export interface UserCardData {
  name: string;
  role: string;
  department?: string;
}

// ui/user-card/user-card.component.ts
export class UserCardComponent {
  readonly data = input.required<UserCardData>();
}
```

**Benefits:**

- Component is self-documenting
- Describes only needed properties
- Maintains independence from domain models
- Prevents coupling to `core/` types

### Alternative: Granular Inputs

```typescript
export class UserCardComponent {
  readonly name = input.required<string>();
  readonly role = input.required<string>();
  readonly department = input<string>();
}
```

## Dependency Rules

UI components can import from:

- ✅ Other `ui/` components
- ✅ Angular framework
- ✅ Third-party UI libraries (PrimeNG, etc.)

UI components CANNOT import from:

- ❌ `core/` - No services or state
- ❌ `feature/` - Stay generic
- ❌ `pattern/` - Patterns use UI, not vice versa
- ❌ `layout/` - Layouts consume UI

## PrimeNG vs Custom UI

- **Prefer PrimeNG** when it meets requirements
- **Create custom UI** for:
  - Brand-specific designs
  - Simplified APIs over complex components
  - Composition of multiple PrimeNG components
  - Performance-critical implementations

## Common Pitfalls to Avoid

1. **Injecting services**: If tempted to inject a service, refactor to use inputs/outputs
2. **Complex logic**: Extract to parent component or create a `pattern/`
3. **Feature-specific UI**: Keep in the feature until needed elsewhere
4. **Premature extraction**: Wait for 3+ occurrences before moving to `ui/`
5. **State management**: Never use signals for internal state beyond computed values
