---
description: "Pattern layer - Reusable business components (drop-in, can use services)"
paths: "frontend/**/pattern/**/*"
---

# Pattern Layer

**Scope**: Reusable business components shared across features (can use services)

## Quick Rules

- Shared business logic patterns
- Used by multiple features
- **CAN inject services** from `core/`
- **CAN import UI components** from `ui/`
- NEVER import from `feature/` (would create circular dependency)

## Dependency Rules

```
pattern/ ──✅──> core/
pattern/ ──✅──> ui/
pattern/ ──✅──> styles/
pattern/ ──❌──> feature/
pattern/ ──❌──> layout/
pattern/ ──❌──> pattern/  (no pattern-to-pattern imports)
```

## When to Extract to Pattern

Extract a component to `pattern/` when:
- ✅ Used by 2+ features
- ✅ Contains reusable business logic
- ✅ Represents a domain concept (User, Order, Invoice)
- ✅ Needs to inject services from `core/`

Keep in `feature/` when:
- ❌ Used by only one feature
- ❌ Highly specific to one use case
- ❌ Would require too many inputs to be generic

## Pattern vs UI

| Aspect | UI Layer | Pattern Layer |
|--------|----------|---------------|
| **Services** | ❌ NEVER inject | ✅ Can inject from `core/` |
| **Dependencies** | ❌ NONE (self-contained) | ✅ `core/`, `ui/`, `styles/` |
| **Domain knowledge** | ❌ Generic widgets | ✅ Business concepts |
| **State** | ❌ Stateless (inputs only) | ✅ Can have local state, signals |
| **Reusability** | ✅ ANY application | ✅ THIS application only |
| **Examples** | Button, Card, Input | UserCard, OrderForm, InvoiceWidget |

## Examples

### Pattern Components (Business Logic)
```typescript
// ✅ PATTERN - Business component with service injection
@Component({
  selector: 'app-user-card',
  template: `
    <app-card>
      <h2>{{ user()?.name }}</h2>
      <p>{{ user()?.status }}</p>
    </app-card>
  `
})
export class UserCardComponent {
  readonly userId = input.required<string>();

  readonly #userService = inject(UserService); // OK in pattern

  readonly user = resource({
    params: () => ({ id: this.userId() }),
    loader: ({ params }) => this.#userService.getById(params.id)
  });
}
```

### Using UI Components in Pattern
```typescript
// ✅ Pattern can compose UI components
@Component({
  selector: 'app-order-timeline',
  template: `
    @for (order of orders(); track order.id) {
      <app-card>  <!-- UI component -->
        <h3>{{ order.type }}</h3>
        <app-badge [variant]="order.status">  <!-- UI component -->
          {{ order.status }}
        </app-badge>
      </app-card>
    }
  `
})
export class OrderTimelineComponent {
  readonly orderId = input.required<string>();

  readonly #orderService = inject(OrderService); // OK

  readonly orders = resource({
    params: () => ({ orderId: this.orderId() }),
    loader: ({ params }) => this.#orderService.getByOrder(params.orderId)
  });
}
```

## Anti-Patterns

❌ **Pattern importing from Feature**:
```typescript
// WRONG - Creates circular dependency
import { UserFeatureService } from '@feature/users';
```

❌ **Pattern importing from another Pattern**:
```typescript
// WRONG - Patterns should not depend on each other
import { UserCardComponent } from '@pattern/user-card';
```

If two patterns need shared logic:
- ✅ Extract shared logic to `core/`
- ✅ Extract shared UI to `ui/`

## Typical Pattern Components

- **Business forms**: User profile form, order summary form, invoice widget form
- **Domain widgets**: User card, order timeline, status widget
- **Workflow components**: Multi-step wizards, approval flows
- **Data displays**: Statistics cards, domain-specific charts
- **Composite components**: Components combining multiple UI elements with business logic

## Additional Notes

**For complete implementation examples**: Refer to your project's pattern layer README or module documentation
