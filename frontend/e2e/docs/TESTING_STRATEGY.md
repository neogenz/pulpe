# E2E Testing Strategy for Onboarding Flow

## Current Approach Assessment ✅

### What We're Doing Right

1. **Page Object Model**: Well-structured with clear separation of concerns
2. **Proper Selectors**: Using `data-testid` attributes follows best practices
3. **Test Isolation**: Fast individual step testing with localStorage setup
4. **Mixed Strategy**: Combining full flows with isolated testing

### Areas for Improvement

1. **Code Duplication**: localStorage setup repeated across tests
2. **Limited Test Categories**: Missing distinction between critical paths and validation
3. **Over-reliance on localStorage**: Some scenarios could benefit from API mocking

## Enhanced Testing Strategy

### 1. Test Categories (Pyramid Approach)

```
┌─────────────────────────────────────┐
│     Critical User Journeys (5%)     │  ← Full E2E, no localStorage
├─────────────────────────────────────┤
│    API Integration Tests (15%)      │  ← Mock APIs, realistic flow
├─────────────────────────────────────┤
│   Component Validation (60%)        │  ← localStorage fixtures
├─────────────────────────────────────┤
│    Guard Behavior Tests (20%)       │  ← Controlled state setup
└─────────────────────────────────────┘
```

### 2. Fixtures Strategy

**Use Case**: Fast, isolated component testing
**Implementation**: Pre-configured localStorage states via fixtures

```typescript
// ✅ Good: Using fixtures for isolated testing
test('should validate income inputs', async ({ onboardingWithPersonalInfo }) => {
  await onboardingWithPersonalInfo.gotoStep('income');
  // Test logic here
});

// ❌ Avoid: Inline localStorage setup
test('should validate income inputs', async ({ page }) => {
  await page.evaluate(() => { /* localStorage setup */ });
  // Test logic here
});
```

### 3. API Mocking Strategy

**Use Case**: Testing realistic data flow and API integration
**Implementation**: Mock endpoints instead of localStorage

```typescript
// ✅ Good: API-based state management
const stateManager = new OnboardingStateManager(page);
await stateManager.setupApiMockedState(data, { mockAuthentication: true });

// ✅ Good: Mock registration endpoints
await page.route('**/api/auth/signup', route => {
  route.fulfill({ status: 200, body: JSON.stringify(response) });
});
```

### 4. Critical Path Strategy

**Use Case**: End-to-end user journey validation
**Implementation**: No localStorage manipulation, realistic user flow

```typescript
// ✅ Good: Full user journey
test('complete onboarding as new user', async ({ onboardingPage }) => {
  await stateManager.setupRealisticUserJourney(); // Only mocks external APIs
  await onboardingPage.completeOnboardingFlow(validData);
});
```

## Migration Guidelines

### Current localStorage Approach (Keep for Component Tests)

```typescript
// ✅ Still valid for isolated component testing
await page.evaluate(() => {
  localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
    firstName: 'Test User',
    monthlyIncome: 5000
  }));
});
```

**When to use:**
- Testing individual step validation
- Fast feedback during development
- Component-specific behavior testing

### Enhanced Fixtures Approach (Recommended)

```typescript
// ✅ Better: Use fixtures for common setups
test('income validation', async ({ onboardingWithPersonalInfo }) => {
  // Fixture automatically sets up required state
  await onboardingWithPersonalInfo.gotoStep('income');
});
```

**Benefits:**
- Eliminates code duplication
- Clearer test intent
- Better maintenance

### API Mocking Approach (For Integration Tests)

```typescript
// ✅ Best: For testing API integration
const stateManager = new OnboardingStateManager(page);
await stateManager.setupApiMockedState(data);
```

**When to use:**
- Testing API integration points
- Validating realistic data flow
- Authentication scenarios

## Implementation Recommendations

### 1. Immediate Actions ✅

1. **Keep current localStorage tests** - they're working and fast
2. **Add fixtures** - reduce code duplication
3. **Categorize tests** - separate critical paths from validation

### 2. Gradual Improvements 🔄

1. **Implement enhanced fixtures** (see `onboarding-fixtures.ts`)
2. **Add API mocking utilities** (see `onboarding-state-manager.ts`)
3. **Create critical path tests** without localStorage manipulation

### 3. Long-term Goals 🎯

1. **80% fixture-based tests** for speed and reliability
2. **15% API integration tests** for realistic scenarios
3. **5% full E2E journeys** for critical business flows

## Best Practices Summary

### ✅ Do

- Use fixtures for common state setups
- Mock external APIs, not internal state
- Separate critical paths from component validation
- Use `data-testid` attributes consistently
- Implement realistic user journeys for business-critical flows

### ❌ Don't

- Inline localStorage setup in every test
- Mock everything (maintain some realistic flows)
- Mix test categories in the same test suite
- Ignore guard behavior testing
- Over-engineer simple validation tests

## Conclusion

The current localStorage approach is **not wrong** - it's a pragmatic solution that works well for isolated component testing. The recommended improvements focus on:

1. **Better organization** through fixtures and test categories
2. **Reduced duplication** through reusable setup utilities
3. **Enhanced coverage** with API mocking and critical path testing
4. **Maintained speed** for the majority of tests

This hybrid approach provides the best balance of speed, reliability, and realistic user simulation.