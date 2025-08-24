# Playwright E2E Testing Standards

This document outlines the standards and best practices for writing E2E tests with Playwright in the Pulpe project.

## Core Principles

1. **KISS (Keep It Simple, Stupid)**: Write simple, straightforward tests that are easy to understand and maintain.
2. **YAGNI (You Aren't Gonna Need It)**: Don't add functionality until it's needed.
3. **Trust Playwright's Auto-Waiting**: Leverage built-in waiting mechanisms instead of manual timeouts.
4. **Business-Focused**: Tests should reflect real user scenarios and business requirements.

## Selector Strategy

### Priority Order (Most to Least Preferred)

1. **data-testid**: Custom attributes for testing (`getByTestId()`)
   ```typescript
   await page.getByTestId('login-submit-button').click();
   ```

2. **Role-based**: Semantic HTML roles (`getByRole()`)
   ```typescript
   await page.getByRole('button', { name: 'Submit' }).click();
   ```

3. **Label-based**: Form labels and aria-labels (`getByLabel()`)
   ```typescript
   await page.getByLabel('Email').fill('user@example.com');
   ```

4. **Text-based**: Visible text content (`getByText()`)
   ```typescript
   await page.getByText('Welcome').click();
   ```

5. **CSS/XPath**: Only as last resort
   ```typescript
   // Avoid this pattern
   await page.locator('.btn-primary').click();
   ```

## Page Object Standards

### Structure

```typescript
import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.page.getByTestId('email-input').fill(email);
    await this.page.getByTestId('password-input').fill(password);
    await this.page.getByTestId('login-submit-button').click();
    await this.page.waitForURL(/\/app/);
  }

  async expectLoginFormVisible() {
    await expect(this.page.getByTestId('login-form')).toBeVisible();
  }
}
```

### Rules

1. **Max 50 lines per Page Object**
2. **No conditional logic** (no `if` statements)
3. **One responsibility per method**
4. **Use async/await consistently**
5. **Leverage auto-waiting** (no `waitForTimeout`)

## Anti-Patterns to Avoid

### ❌ Don't Use waitForTimeout

```typescript
// BAD
await page.waitForTimeout(2000);

// GOOD
await page.waitForLoadState('networkidle');
await element.waitFor({ state: 'visible' });
```

### ❌ Don't Use Complex Selectors

```typescript
// BAD
await page.locator('.container > div:nth-child(2) button.submit').click();

// GOOD
await page.getByTestId('submit-button').click();
```

### ❌ Don't Use Conditional Logic in Page Objects

```typescript
// BAD
async clickButton() {
  if (await this.button.isVisible()) {
    await this.button.click();
  }
}

// GOOD
async clickButton() {
  await this.button.click(); // Let Playwright handle the waiting
}
```

## Test Structure

### Test Organization

```
e2e/
├── fixtures/          # Shared test fixtures and setup
├── pages/            # Page Objects
│   ├── auth/        # Authentication-related pages
│   ├── budget/      # Budget management pages
│   └── ...
├── tests/
│   ├── critical-path/  # Core user journeys
│   ├── features/      # Feature-specific tests
│   └── smoke/         # Basic health checks
└── utils/            # Test utilities and helpers
```

### Test Template

```typescript
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code
  });

  test('should perform business action', async ({ page }) => {
    // Arrange
    await page.goto('/feature');
    
    // Act
    await page.getByTestId('action-button').click();
    
    // Assert
    await expect(page.getByTestId('result')).toBeVisible();
  });
});
```

## Waiting Strategies

### Preferred Methods

1. **Auto-waiting with expect**
   ```typescript
   await expect(element).toBeVisible(); // Waits up to 5s by default
   ```

2. **Wait for specific states**
   ```typescript
   await page.waitForLoadState('networkidle');
   await element.waitFor({ state: 'visible' });
   ```

3. **Wait for URL changes**
   ```typescript
   await page.waitForURL(/\/dashboard/);
   ```

4. **Wait for network responses**
   ```typescript
   const responsePromise = page.waitForResponse('**/api/data');
   await page.click('button');
   await responsePromise;
   ```

## Data-TestId Naming Convention

Use kebab-case with descriptive hierarchy:

```
data-testid="component-element-action"

Examples:
- data-testid="login-form"
- data-testid="transaction-submit-button"
- data-testid="budget-card-details-button"
- data-testid="month-card-${id}" (dynamic)
```

## API Mocking

### Simple Mock

```typescript
await page.route('**/api/endpoint', route => 
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: 'mocked' })
  })
);
```

### Conditional Mock

```typescript
await page.route('**/api/**', route => {
  if (route.request().method() === 'GET') {
    return route.fulfill({ status: 200, body: '[]' });
  }
  return route.continue();
});
```

## Performance Considerations

1. **Run tests in parallel** when possible
2. **Use fixtures** to share setup between tests
3. **Mock external APIs** to reduce flakiness
4. **Keep tests focused** on single scenarios
5. **Avoid long test chains** that depend on each other

## Debugging Tips

1. **Use headed mode**: `pnpm test:e2e --headed`
2. **Use debug mode**: `pnpm test:e2e --debug`
3. **Take screenshots**: Built into Playwright on failure
4. **Use trace viewer**: `pnpm test:e2e --trace on`
5. **Check videos**: Automatically recorded on failure

## Maintenance

### Regular Tasks

1. **Remove unused tests** quarterly
2. **Update selectors** when UI changes
3. **Review flaky tests** weekly
4. **Update documentation** with each major change

### Adding New Tests

1. Add `data-testid` to Angular components first
2. Create/update Page Objects
3. Write business-focused test scenarios
4. Verify tests pass locally
5. Update documentation if needed

## Commands

```bash
# Run all tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e path/to/test.spec.ts

# Run with UI mode
pnpm test:e2e --ui

# Run in headed mode
pnpm test:e2e --headed

# Generate report
pnpm test:e2e --reporter=html
```

## Version

Last updated: 2025-08-24
Playwright version: Latest
Angular version: 20+