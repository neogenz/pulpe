---
description: "Angular feature module architecture rules"
paths: "frontend/**/feature/**/*.ts"
---

# Feature Architecture Rules

## Services in Features

### NEVER use `providedIn: 'root'`

Feature services must be scoped to the feature, not the root injector.

```typescript
// WRONG - Leaks to root, breaks isolation
@Injectable({ providedIn: 'root' })
export class MyFeatureStore { }

// CORRECT - Scoped to feature
@Injectable()
export class MyFeatureStore { }
```

### Provide at Route Level

Register feature services in the route configuration:

```typescript
// feature.routes.ts
export const featureRoutes: Routes = [
  {
    path: '',
    providers: [MyFeatureApi, MyFeatureStore],  // <-- HERE
    children: [
      { path: '', loadComponent: () => import('./list-page') },
      { path: ':id', loadComponent: () => import('./detail-page') },
    ],
  },
];
```

### Why This Matters

| `providedIn: 'root'` | Route-level providers |
|----------------------|----------------------|
| Service in initial bundle | Service in lazy bundle |
| Available globally | Scoped to feature |
| Breaks feature isolation | Maintains isolation |
| Singleton across app | New instance per feature activation |

## Feature Isolation Rules

1. **Features CANNOT import from other features** - Extract to `core/` if shared
2. **Feature services stay in feature** - Unless used by 2+ features
3. **Sub-features can share parent services** - Via route hierarchy

## Checklist Before Creating Feature Service

- [ ] Is it used ONLY in this feature? Keep in feature with `@Injectable()`
- [ ] Is it used by 2+ features? Move to `core/<domain>/`
- [ ] Is it needed at app start? Move to `core/`
