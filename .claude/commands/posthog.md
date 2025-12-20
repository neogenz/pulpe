---
description: PostHog integration expert for analytics, tracking, and error monitoring
allowed-tools: Read, Edit, MultiEdit, Write, Glob, Grep, WebFetch
---

You are a PostHog integration specialist. Help implement analytics, event tracking, feature flags, session replay, and error tracking following PostHog best practices.

# PostHog JavaScript Web SDK Reference

## Initialization

```typescript
posthog.init('<ph_project_api_key>', {
  api_host: '<ph_client_api_host>',
  person_profiles: 'identified_only', // 'always' | 'identified_only'
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  },
});
```

## Core Methods

### Event Capture

```typescript
// Basic event
posthog.capture('user_signed_up');

// With properties
posthog.capture('cta-button-clicked', {
  button_name: 'Get Started',
  page: 'homepage'
});

// With person properties
posthog.capture('event_name', {
  $set: { name: 'Max Hedgehog' },
  $set_once: { initial_url: '/blog' },
});
```

### User Identification

```typescript
// Basic identification
posthog.identify('user_12345');

// With properties
posthog.identify('user_12345', {
  email: 'user@example.com',
  plan: 'premium'
});

// With set and set_once
posthog.identify('user_12345',
  { last_login: new Date() },      // $set - updates every time
  { signup_date: new Date() }      // $set_once - sets only once
);

// Get current user ID
const userId = posthog.get_distinct_id();
```

### Person Properties

```typescript
// Set properties (creates $set event)
posthog.setPersonProperties(
  { name: 'Max Hedgehog' },        // $set
  { initial_url: '/blog' }         // $set_once
);
```

### Reset (Logout)

```typescript
// Reset on user logout
posthog.reset();

// Reset with device_id
posthog.reset(true);
```

### Alias

```typescript
// Link anonymous user to account on signup
posthog.alias('user_12345');

// Explicit alias with original ID
posthog.alias('user_12345', 'anonymous_abc123');
```

## Group Analytics

```typescript
// Associate user with organization
posthog.group('company', 'company_id_in_your_db');

// With properties
posthog.group('company', 'company_id_in_your_db', {
  name: 'Awesome Inc.',
  employees: 11,
});

// Get current groups
posthog.getGroups();

// Reset groups
posthog.resetGroups();
```

## Super Properties

Properties automatically added to all events:

```typescript
// Register (overwrites existing)
posthog.register({ plan: 'premium' });

// Register with expiration
posthog.register({ campaign: 'summer_sale' }, 7); // expires in 7 days

// Register once (won't overwrite)
posthog.register_once({
  first_login_date: new Date().toISOString(),
  initial_referrer: document.referrer
});

// Session-only properties
posthog.register_for_session({
  current_page_type: 'checkout',
  ab_test_variant: 'control'
});

// Remove
posthog.unregister('plan_type');
posthog.unregister_for_session('current_flow');
```

## Feature Flags

### Basic Usage

```typescript
// Boolean check
if (posthog.isFeatureEnabled('new-feature')) {
  // show new feature
}

// Get variant value
const variant = posthog.getFeatureFlag('button-color');
if (variant === 'red') {
  // show red button
}

// Get payload
const payload = posthog.getFeatureFlagPayload('flag-key');
```

### Ensuring Flags Are Loaded

```typescript
posthog.onFeatureFlags((flags, flagVariants, { errorsLoading }) => {
  if (posthog.isFeatureEnabled('flag-key')) {
    // do something
  }
});
```

### Reload Flags

```typescript
posthog.reloadFeatureFlags();
```

### Override Properties for Flags

```typescript
// Set person properties
posthog.setPersonPropertiesForFlags({ property1: 'value' });
posthog.resetPersonPropertiesForFlags();

// Set group properties
posthog.setGroupPropertiesForFlags({ company: { name: 'CYZ' } });
posthog.resetGroupPropertiesForFlags('company');
```

## Session Replay

```typescript
// Control recording
posthog.startSessionRecording();
posthog.stopSessionRecording();
posthog.sessionRecordingStarted(); // boolean

// Override controls
posthog.startSessionRecording({ sampling: true, linked_flag: true });

// Get replay URL
posthog.get_session_replay_url({ withTimestamp: true, timestampLookBack: 30 });

// Get session ID
posthog.get_session_id();
```

## Error Tracking

### Manual Exception Capture

```typescript
try {
  // something that might throw
} catch (error) {
  posthog.captureException(error);
}

// With additional properties
posthog.captureException(error, {
  customProperty: 'value',
  anotherProperty: ['value1', 'value2'],
});

// With custom fingerprint for grouping
posthog.captureException(error, {
  $exception_fingerprint: 'CustomExceptionGroup',
});
```

### Automatic Capture Configuration

```typescript
posthog.init('<ph_project_api_key>', {
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  },
});
```

### Customize Exceptions with before_send

```typescript
posthog.init('<ph_project_api_key>', {
  before_send: (event) => {
    if (event && event.event === '$exception') {
      const exceptionList = event.properties?.['$exception_list'] || [];
      const exception = exceptionList[0];

      if (exception) {
        event.properties['custom_property'] = 'custom_value';
        event.properties['$exception_fingerprint'] = 'MyCustomGroup';
      }
    }
    return event;
  },
});
```

### Suppress Exceptions

```typescript
posthog.init('<ph_project_api_key>', {
  before_send: (event) => {
    if (event.event === '$exception') {
      const exceptionList = event.properties['$exception_list'] || [];
      const exception = exceptionList[0];

      if (exception?.['$exception_type'] === 'UnwantedError') {
        return false; // suppress this exception
      }
    }
    return event;
  },
});
```

## Surveys

```typescript
// Get active surveys
posthog.getActiveMatchingSurveys((surveys) => {
  // do something with surveys
});

// Get all surveys
posthog.getSurveys((surveys) => {
  // do something
});

// Render survey programmatically
posthog.renderSurvey('survey_id', '#survey-container');

// Check if survey can be rendered
posthog.canRenderSurveyAsync('survey_id').then((result) => {
  if (result.visible) {
    // Survey can be rendered
  }
});

// Capture survey events
posthog.capture('survey shown', { $survey_id: survey.id });
posthog.capture('survey dismissed', { $survey_id: survey.id });
posthog.capture('survey sent', {
  $survey_id: survey.id,
  $survey_response: 'user response'
});
```

## Privacy Controls

```typescript
// Opt in/out
posthog.opt_in_capturing();
posthog.opt_out_capturing();

// Check status
posthog.has_opted_in_capturing();
posthog.has_opted_out_capturing();
posthog.is_capturing();

// Clear opt in/out status
posthog.clear_opt_in_out_capturing();
```

## Event Sampling & Filtering

### Using before_send

```typescript
import { sampleByEvent, sampleByDistinctId, sampleBySessionId } from 'posthog-js/lib/src/customizations';

posthog.init('<ph_project_api_key>', {
  // Sample specific events
  before_send: sampleByEvent(['$dead_click', '$web_vitals'], 0.5),

  // Or sample by distinct ID (40% of users)
  before_send: sampleByDistinctId(0.4),

  // Or sample by session (25% of sessions)
  before_send: sampleBySessionId(0.25),

  // Chain multiple functions
  before_send: [
    sampleByDistinctId(0.5),
    sampleByEvent(['$web_vitals'], 0.1),
  ],
});
```

## Event Listeners

```typescript
// Listen to captured events
posthog.on('eventCaptured', (event) => {
  console.log(event);
});

// Session ID changes
posthog.onSessionId((sessionId, windowId) => {
  // sync with backend
});

// Surveys loaded
posthog.onSurveysLoaded((surveys, context) => {
  // do something
});
```

## Debugging

```typescript
// Enable debug mode
posthog.debug(true);

// Or via URL: ?__posthog_debug=true
```

# Exception Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `$exception_list` | List | List of exceptions with type, value, stacktrace, mechanism |
| `$exception_fingerprint` | String | Fingerprint for grouping |
| `$exception_level` | String | Severity level |
| `$exception_types` | Array | Exception types for filtering |
| `$exception_values` | Array | Exception messages |
| `$exception_sources` | Array | Source files |
| `$exception_handled` | Boolean | Whether exception was handled |

# Web Analytics Events

PostHog automatically captures:
- `$pageview` - Page views
- `$pageleave` - Page leaves
- `$autocapture` - Clicks, form submissions, input changes
- `$web_vitals` - Core Web Vitals metrics

## Captured Properties

- `$current_url` - Current page URL
- `$referrer` - Referrer URL
- `$device_type` - Desktop/Mobile/Tablet
- `$browser` - Browser name
- `$os` - Operating system
- UTM parameters: `utm_source`, `utm_medium`, `utm_campaign`, etc.

# Best Practices

## Event Naming

Use `[object] [verb]` format:
- `project created`
- `user signed up`
- `invite sent`

## Anonymous vs Identified Events

- **Anonymous**: No person profile, cheaper (up to 4x), good for web analytics
- **Identified**: Creates person profile, enables user tracking across sessions

Use `person_profiles: 'identified_only'` (default) to capture anonymous by default, identified only after calling `identify()`.

## Error Tracking

1. **Enable exception autocapture** in project settings
2. **Upload source maps** for minified code
3. **Use custom fingerprints** to group related exceptions
4. **Set custom properties** for filtering and alerting
5. **Suppress noisy exceptions** client-side with `before_send`

## Performance

- Use `before_send` to sample high-volume events
- Block known bot user agents with `custom_blocked_useragents`
- Use cookieless tracking for privacy-focused sites
