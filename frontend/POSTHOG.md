# PostHog Analytics Integration

## Overview

PostHog has been integrated into the Pulpe application for analytics and error tracking. The implementation follows KISS principles with fault tolerance and minimal complexity.

## Architecture

### Core Components

1. **PostHogService** (`core/analytics/posthog.service.ts`)
   - Singleton service managing PostHog initialization and events
   - Reactive state management using Angular signals
   - Fault-tolerant with 5-second initialization timeout
   - Never blocks app startup

2. **AppErrorHandler** (`core/error/error-handler.ts`)
   - Delegates unhandled errors to PostHog
   - Maintains separation of concerns
   - Silent fail if PostHog unavailable

3. **Configuration** (`core/config/config.schema.ts`)
   - PostHog settings in external JSON files
   - Optional configuration (can be disabled)
   - Environment-specific settings

## Configuration

### Development (`config.local.json`)
```json
{
  "posthog": {
    "apiKey": "",
    "apiHost": "https://app.posthog.com",
    "enabled": false
  }
}
```

### Production (`config.production.json`)
```json
{
  "posthog": {
    "apiKey": "phc_your_api_key_here",
    "apiHost": "https://app.posthog.com",
    "enabled": true
  }
}
```

## Usage

### Basic Event Tracking
```typescript
import { PostHogService, PostHogEvents } from '@core/analytics';

@Component({...})
export class MyComponent {
  readonly #posthog = inject(PostHogService);
  
  onButtonClick() {
    this.#posthog.capture(PostHogEvents.FEATURE_USED, {
      feature: 'budget_creation',
      action: 'button_click'
    });
  }
}
```

### User Identification
```typescript
// After successful login
this.#posthog.identify(user.id, {
  email: user.email,
  created_at: user.createdAt
});

// On logout
this.#posthog.reset();
```

### Page Views
```typescript
// In route components
ngOnInit() {
  this.#posthog.capturePageView('Budget Details', {
    budget_id: this.budgetId
  });
}
```

### Error Tracking
Automatic via `AppErrorHandler` - no manual setup needed.

## Event Catalog

Predefined events in `PostHogEvents`:

### Authentication
- `USER_SIGNED_UP`
- `USER_SIGNED_IN`
- `USER_SIGNED_OUT`
- `SESSION_EXPIRED`

### Budget Management
- `BUDGET_CREATED`
- `BUDGET_UPDATED`
- `BUDGET_DELETED`

### Template Management
- `TEMPLATE_CREATED`
- `TEMPLATE_UPDATED`
- `TEMPLATE_DELETED`
- `TEMPLATE_APPLIED`

### Transactions
- `TRANSACTION_ADDED`
- `TRANSACTION_UPDATED`
- `TRANSACTION_DELETED`

### Onboarding
- `ONBOARDING_STARTED`
- `ONBOARDING_STEP_COMPLETED`
- `ONBOARDING_COMPLETED`
- `ONBOARDING_SKIPPED`

## Testing

### Mock Service
```typescript
import { MockPostHogService } from '@core/analytics/posthog.service.mock';

TestBed.configureTestingModule({
  providers: [
    { provide: PostHogService, useClass: MockPostHogService }
  ]
});
```

### Verify Events
```typescript
it('should track budget creation', () => {
  const posthogSpy = spyOn(posthogService, 'capture');
  
  component.createBudget();
  
  expect(posthogSpy).toHaveBeenCalledWith('budget_created', {
    template_id: 'template-123'
  });
});
```

## Privacy & Security

- **No auto-capture**: Only explicit events are tracked
- **No session recording in dev**: Disabled by default
- **User consent**: Can be toggled via configuration
- **Sensitive data**: Never log PII in event properties

## Debugging

Check PostHog initialization status:
```typescript
if (this.#posthog.isReady()) {
  console.log('PostHog is ready');
}

if (this.#posthog.hasError()) {
  console.log('PostHog initialization failed');
}
```

Enable debug logging in console:
```javascript
localStorage.setItem('ph_debug', 'true');
```

## Maintenance

### Updating PostHog
```bash
pnpm update posthog-js
```

### Viewing Analytics
1. Log into [PostHog Dashboard](https://app.posthog.com)
2. Select your project
3. View events, errors, and user insights

## Troubleshooting

### PostHog not initializing
- Check API key in config
- Verify network connectivity
- Check browser console for errors

### Events not appearing
- Ensure `enabled: true` in config
- Check `isReady()` status
- Verify event names match catalog

### Type errors with rrweb
- Ensure rrweb types are installed:
  ```bash
  pnpm add -D @rrweb/types@2.0.0-alpha.17 rrweb-snapshot@2.0.0-alpha.17
  ```