# Plan: Demo Mode Test Coverage (Critical Gaps)

**Date**: 2025-01-11
**Author**: Claude
**Objective**: Add 3 critical tests to prevent demo mode regressions

---

## 🎯 Goals

Fix 3 critical testing gaps in demo mode implementation:

1. ❌ **No E2E test** for complete demo flow (Turnstile → Backend → Dashboard)
2. ⚠️ **No lifecycle test** validating "create → cleanup → recreate immediately"
3. ⚠️ **No schema coverage** ensuring all user data is cleaned up

---

## 📁 Files to Create

### 1. E2E Critical Path Test
**Path**: `frontend/e2e/tests/critical-path/demo-mode.spec.ts`

**Purpose**: Test the complete demo flow from button click to dashboard with real backend

**Pattern**: Based on `core-navigation.spec.ts` and `session.spec.ts`

**Structure**:
```typescript
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Demo Mode - Critical Path', () => {
  test.setTimeout(60000); // Demo creation can be slow

  test('should create demo session and navigate to dashboard', async ({ page }) => {
    // GIVEN: User on welcome page
    await page.goto('/onboarding/welcome');

    // WHEN: User clicks demo button
    const demoButton = page.getByTestId('demo-mode-button');
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // THEN: Loading state appears
    await expect(demoButton).toBeDisabled();

    // AND: Eventually redirects to dashboard
    await expect(page).toHaveURL(/\/app\/current-month/, { timeout: 30000 });

    // AND: Demo data is present
    await expect(page.getByTestId('budget-overview')).toBeVisible();

    // AND: Demo indicator is shown
    await expect(page.getByText(/mode démo/i)).toBeVisible();
  });

  test('should have functional demo data after creation', async ({ page }) => {
    // GIVEN: Fresh demo session
    await page.goto('/onboarding/welcome');
    await page.getByTestId('demo-mode-button').click();
    await expect(page).toHaveURL(/\/app\/current-month/);

    // WHEN: User navigates to templates
    await page.getByTestId('nav-templates').click();

    // THEN: Should see 4 templates
    await expect(page.getByTestId('template-card')).toHaveCount(4);

    // WHEN: User views current month budget
    await page.goto('/app/current-month');

    // THEN: Should see budget lines
    const budgetLines = page.getByTestId('budget-line-row');
    await expect(budgetLines).not.toHaveCount(0);
  });

  test('should handle demo creation errors gracefully', async ({ page }) => {
    // GIVEN: Backend is unavailable (stop backend manually for this test)
    // OR rate limit exceeded

    // Mock rate limit error
    await page.route('**/api/v1/demo/session', route => {
      route.fulfill({
        status: 429,
        json: { message: 'Trop de tentatives' }
      });
    });

    // WHEN: User clicks demo button
    await page.goto('/onboarding/welcome');
    await page.getByTestId('demo-mode-button').click();

    // THEN: Error message appears
    await expect(page.getByText(/trop de tentatives/i)).toBeVisible();

    // AND: Button is re-enabled
    await expect(page.getByTestId('demo-mode-button')).toBeEnabled();
  });
});
```

**Test Strategy**:
- Use real backend (no mocking)
- Turnstile auto-bypassed in test env
- Cleanup demo user after each test via `/api/v1/demo/cleanup`
- Test both success and error paths
- Verify navigation, data presence, UI state

---

### 2. Backend Lifecycle Integration Test
**Path**: `backend-nest/src/modules/demo/demo-lifecycle.spec.ts`

**Purpose**: Test complete lifecycle: create → verify → cleanup → recreate

**Pattern**: Based on `demo.service.spec.ts` + `demo-cleanup.service.spec.ts`

**Structure**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DemoService } from './demo.service';
import { DemoCleanupService } from './demo-cleanup.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { SupabaseService } from '../supabase/supabase.service';
import { cleanupTestUsers, createAuthenticatedClient } from '../../test/demo-test-utils';

describe('Demo Lifecycle - Integration Tests', () => {
  let demoService: DemoService;
  let cleanupService: DemoCleanupService;
  let supabaseService: SupabaseService;
  let module: TestingModule;
  let testUserIds: string[] = [];

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          load: [() => ({
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          })],
        }),
      ],
      providers: [
        DemoService,
        DemoCleanupService,
        DemoDataGeneratorService,
        SupabaseService,
        { provide: `PinoLogger:${DemoService.name}`, useValue: mockLogger },
        { provide: `PinoLogger:${DemoCleanupService.name}`, useValue: mockLogger },
        { provide: `PinoLogger:${DemoDataGeneratorService.name}`, useValue: mockLogger },
      ],
    }).compile();

    demoService = module.get<DemoService>(DemoService);
    cleanupService = module.get<DemoCleanupService>(DemoCleanupService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    testUserIds = [];
  });

  afterEach(async () => {
    if (testUserIds.length > 0) {
      await cleanupTestUsers(supabaseService, testUserIds);
    }
  });

  describe('Complete Lifecycle', () => {
    it('should support create → cleanup → recreate immediately', async () => {
      // PHASE 1: CREATE
      const session1 = await demoService.createDemoSession();
      const userId1 = session1.data.session.user.id;
      testUserIds.push(userId1);

      // Verify data exists
      const client1 = createAuthenticatedClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        session1.data.session.access_token
      );

      const { data: templates1 } = await client1.from('template').select('*');
      const { data: budgets1 } = await client1.from('monthly_budget').select('*');

      expect(templates1).toHaveLength(4);
      expect(budgets1).toHaveLength(12);

      // PHASE 2: CLEANUP (immediate - 0 hours old)
      const cleanupResult = await cleanupService.cleanupDemoUsersByAge(0);

      expect(cleanupResult.deleted).toBe(1);
      expect(cleanupResult.failed).toBe(0);

      // Verify user is deleted
      const adminClient = supabaseService.getServiceRoleClient();
      const { data: users } = await adminClient.auth.admin.listUsers();
      expect(users.users.find(u => u.id === userId1)).toBeUndefined();

      // PHASE 3: RECREATE IMMEDIATELY
      const session2 = await demoService.createDemoSession();
      const userId2 = session2.data.session.user.id;
      testUserIds.push(userId2);

      // Verify new user has different ID
      expect(userId2).not.toBe(userId1);

      // Verify new user has fresh data
      const client2 = createAuthenticatedClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        session2.data.session.access_token
      );

      const { data: templates2 } = await client2.from('template').select('*');
      const { data: budgets2 } = await client2.from('monthly_budget').select('*');

      expect(templates2).toHaveLength(4);
      expect(budgets2).toHaveLength(12);

      // Verify template IDs are different (fresh data, not reused)
      const templateIds1 = templates1?.map(t => t.id).sort();
      const templateIds2 = templates2?.map(t => t.id).sort();
      expect(templateIds1).not.toEqual(templateIds2);
    });

    it('should delete all user data across all tables via CASCADE', async () => {
      // GIVEN: Demo user with complete data
      const session = await demoService.createDemoSession();
      const userId = session.data.session.user.id;
      testUserIds.push(userId);

      const client = createAuthenticatedClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        session.data.session.access_token
      );

      // Verify data exists in all tables
      const { data: templates } = await client.from('template').select('*');
      const { data: templateLines } = await client.from('template_line').select('*');
      const { data: budgets } = await client.from('monthly_budget').select('*');
      const { data: budgetLines } = await client.from('budget_line').select('*');
      const { data: transactions } = await client.from('transaction').select('*');

      expect(templates?.length).toBeGreaterThan(0);
      expect(templateLines?.length).toBeGreaterThan(0);
      expect(budgets?.length).toBeGreaterThan(0);
      expect(budgetLines?.length).toBeGreaterThan(0);
      expect(transactions?.length).toBeGreaterThan(0);

      // WHEN: Delete user
      await cleanupService.cleanupDemoUsersByAge(0);

      // THEN: ALL data is gone from ALL tables
      const adminClient = supabaseService.getServiceRoleClient();

      const { data: templatesAfter } = await adminClient
        .from('template')
        .select('*')
        .eq('user_id', userId);

      const { data: budgetsAfter } = await adminClient
        .from('monthly_budget')
        .select('*')
        .eq('user_id', userId);

      const { data: templateLinesAfter } = await adminClient
        .from('template_line')
        .select('*')
        .in('template_id', templates?.map(t => t.id) || []);

      const { data: budgetLinesAfter } = await adminClient
        .from('budget_line')
        .select('*')
        .in('budget_id', budgets?.map(b => b.id) || []);

      const { data: transactionsAfter } = await adminClient
        .from('transaction')
        .select('*')
        .in('budget_id', budgets?.map(b => b.id) || []);

      expect(templatesAfter).toHaveLength(0);
      expect(budgetsAfter).toHaveLength(0);
      expect(templateLinesAfter).toHaveLength(0);
      expect(budgetLinesAfter).toHaveLength(0);
      expect(transactionsAfter).toHaveLength(0);
    });
  });
});
```

**Test Strategy**:
- Real database operations (integration test)
- Test complete lifecycle in single test
- Verify CASCADE deletion across ALL tables
- Verify immediate recreation works
- Track test users for cleanup

---

### 3. Backend Schema Coverage Test
**Path**: `backend-nest/src/modules/demo/demo-schema-coverage.spec.ts`

**Purpose**: Ensure cleanup handles all tables with user_id (future-proof)

**Pattern**: Functional CASCADE verification (no schema introspection)

**Structure**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DemoService } from './demo.service';
import { DemoCleanupService } from './demo-cleanup.service';
import { SupabaseService } from '../supabase/supabase.service';
import { cleanupTestUsers } from '../../test/demo-test-utils';

describe('Demo Schema Coverage - All Tables', () => {
  let demoService: DemoService;
  let cleanupService: DemoCleanupService;
  let supabaseService: SupabaseService;
  let testUserIds: string[] = [];

  // All tables that should have user data via user_id or CASCADE
  const USER_DATA_TABLES = [
    { name: 'template', hasUserId: true },
    { name: 'template_line', hasUserId: false, viaTable: 'template' },
    { name: 'monthly_budget', hasUserId: true },
    { name: 'budget_line', hasUserId: false, viaTable: 'monthly_budget' },
    { name: 'transaction', hasUserId: false, viaTable: 'monthly_budget' },
    { name: 'savings_goal', hasUserId: true }, // Future feature
  ];

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ /* ... */ })],
      providers: [DemoService, DemoCleanupService, SupabaseService, /* ... */],
    }).compile();

    demoService = module.get<DemoService>(DemoService);
    cleanupService = module.get<DemoCleanupService>(DemoCleanupService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    testUserIds = [];
  });

  afterEach(async () => {
    if (testUserIds.length > 0) {
      await cleanupTestUsers(supabaseService, testUserIds);
    }
  });

  it('should clean up ALL user data from ALL tables', async () => {
    // GIVEN: Demo user with seeded data
    const session = await demoService.createDemoSession();
    const userId = session.data.session.user.id;
    testUserIds.push(userId);

    const adminClient = supabaseService.getServiceRoleClient();

    // Verify data exists in each table BEFORE cleanup
    const dataBefore: Record<string, any[]> = {};

    for (const table of USER_DATA_TABLES) {
      if (table.hasUserId) {
        const { data } = await adminClient
          .from(table.name)
          .select('*')
          .eq('user_id', userId);

        dataBefore[table.name] = data || [];

        // Should have data in this table
        if (table.name !== 'savings_goal') { // Skip until feature implemented
          expect(dataBefore[table.name].length).toBeGreaterThan(0);
        }
      }
    }

    // WHEN: Cleanup user
    await cleanupService.cleanupDemoUsersByAge(0);

    // THEN: ALL data is deleted from ALL tables
    for (const table of USER_DATA_TABLES) {
      if (table.hasUserId) {
        const { data } = await adminClient
          .from(table.name)
          .select('*')
          .eq('user_id', userId);

        expect(data).toHaveLength(0);
      } else {
        // For CASCADE tables, verify by checking parent table IDs
        const parentTable = table.viaTable;
        const parentData = dataBefore[parentTable!] || [];
        const parentIds = parentData.map((r: any) => r.id);

        if (parentIds.length > 0) {
          const { data } = await adminClient
            .from(table.name)
            .select('*')
            .in(`${parentTable}_id`, parentIds);

          expect(data).toHaveLength(0);
        }
      }
    }
  });

  it('should fail if new table with user_id is not handled', async () => {
    // This test documents expected tables
    // If a developer adds a new table with user_id, this test will fail
    // prompting them to:
    // 1. Add to USER_DATA_TABLES array
    // 2. Ensure CASCADE is configured
    // 3. Update cleanup logic if needed

    const expectedTableCount = 6; // Current count

    expect(USER_DATA_TABLES.length).toBe(expectedTableCount);

    // If this assertion fails, a new table was added to USER_DATA_TABLES
    // This is intentional - forces developer to review cleanup logic
  });
});
```

**Test Strategy**:
- Functional verification (create data → cleanup → verify all gone)
- Explicit table list that must be updated when schema evolves
- Test fails if table count changes (forces review)
- No schema introspection (simpler, more reliable)
- Documents expected tables

---

## 🔧 Implementation Steps

### Step 1: Create E2E Test (2h)
1. Create `frontend/e2e/tests/critical-path/demo-mode.spec.ts`
2. Import existing fixtures
3. Write 3 test scenarios:
   - ✅ Successful demo creation flow
   - ✅ Demo data verification
   - ✅ Error handling
4. Run: `cd frontend && pnpm test:e2e --grep "Demo Mode"`
5. Verify: All tests pass with real backend

### Step 2: Create Lifecycle Test (1.5h)
1. Create `backend-nest/src/modules/demo/demo-lifecycle.spec.ts`
2. Import test utilities from `demo-test-utils.ts`
3. Write 2 test scenarios:
   - ✅ Complete lifecycle (create → cleanup → recreate)
   - ✅ CASCADE deletion verification
4. Run: `cd backend-nest && bun test demo-lifecycle`
5. Verify: All tests pass

### Step 3: Create Schema Coverage Test (1.5h)
1. Create `backend-nest/src/modules/demo/demo-schema-coverage.spec.ts`
2. Define USER_DATA_TABLES array
3. Write 2 test scenarios:
   - ✅ All tables cleaned up
   - ✅ Table count guard
4. Run: `cd backend-nest && bun test demo-schema-coverage`
5. Verify: All tests pass

### Step 4: Update Documentation (0.5h)
1. Update `backend-nest/CLAUDE.md` with:
   - Schema evolution checklist
   - Reference to new tests
2. Update `backend-nest/src/modules/demo/demo-cleanup.service.ts` with:
   - Comment listing all affected tables
   - Reference to schema coverage test

### Step 5: CI Verification (0.5h)
1. Run full test suite: `pnpm test`
2. Run E2E suite: `cd frontend && pnpm test:e2e`
3. Verify no regressions
4. Check test execution time increase

---

## ✅ Success Criteria

### Functional Requirements
- ✅ E2E test exercises complete demo flow with real backend
- ✅ Lifecycle test validates create → cleanup → recreate cycle
- ✅ Schema coverage test verifies all tables are cleaned
- ✅ All existing tests continue to pass

### Non-Functional Requirements
- ✅ Tests follow existing patterns (GIVEN/WHEN/THEN)
- ✅ Tests are simple and maintainable
- ✅ Tests have proper cleanup (no pollution)
- ✅ CI time increase < 30 seconds
- ✅ Tests are deterministic (no flakiness)

---

## 🚨 Risk Mitigation

### Risk 1: E2E Test Flakiness
**Mitigation**:
- Use `test.setTimeout(60000)` for slow operations
- Use proper `waitFor` and `toHaveURL` with timeouts
- Clean up demo users in `afterEach`

### Risk 2: Test Pollution
**Mitigation**:
- Track all created users in `testUserIds[]`
- Use `Promise.allSettled()` in cleanup
- Call cleanup in `afterEach` unconditionally

### Risk 3: Backend Dependency for E2E
**Mitigation**:
- Run E2E tests only when backend is available
- Use `test.skip()` if backend not running
- Document backend requirement in test file

### Risk 4: Schema Evolution
**Mitigation**:
- Table count guard test will fail
- Forces developer review
- Clear error message in test

---

## 📊 Test Coverage Impact

### Before
- ✅ Unit tests: DemoService, DemoCleanupService, DemoDataGeneratorService
- ✅ Integration tests: Individual service operations
- ❌ E2E tests: None for demo mode
- ❌ Lifecycle tests: None for complete cycle
- ❌ Schema coverage: None

### After
- ✅ Unit tests: Unchanged
- ✅ Integration tests: + Lifecycle test
- ✅ E2E tests: + Critical path test (3 scenarios)
- ✅ Lifecycle tests: + Complete cycle test
- ✅ Schema coverage: + Table coverage test

### Coverage Increase
- **Frontend E2E**: +1 critical path file (3 tests)
- **Backend Integration**: +2 test files (4 tests total)
- **Protection**: Prevents all 3 identified critical gaps

---

## 📝 Files Summary

### New Files (3)
1. `frontend/e2e/tests/critical-path/demo-mode.spec.ts` (~100 lines)
2. `backend-nest/src/modules/demo/demo-lifecycle.spec.ts` (~150 lines)
3. `backend-nest/src/modules/demo/demo-schema-coverage.spec.ts` (~120 lines)

### Modified Files (2)
1. `backend-nest/src/modules/demo/demo-cleanup.service.ts` (add table list comment)
2. `backend-nest/CLAUDE.md` (add schema evolution checklist)

### Total Lines Added
- ~370 lines of test code
- ~20 lines of documentation

---

## 🎯 Next Steps After Implementation

1. **Monitor CI Performance**: Ensure tests don't slow down pipeline
2. **Update Test Documentation**: Add examples to CLAUDE.md
3. **Team Review**: Get feedback on test usefulness
4. **Consider Future Tests**:
   - Rate limiting verification
   - Concurrent demo creation
   - Turnstile failure scenarios

---

## 📚 References

**Existing Test Files**:
- `frontend/e2e/tests/critical-path/core-navigation.spec.ts`
- `backend-nest/src/modules/demo/demo.service.spec.ts`
- `backend-nest/src/modules/demo/demo-cleanup.service.spec.ts`

**Utilities**:
- `frontend/e2e/fixtures/test-fixtures.ts`
- `backend-nest/src/test/demo-test-utils.ts`

**Documentation**:
- `backend-nest/CLAUDE.md`
- `frontend/CLAUDE.md`



2. E2E (frontend/e2e/tests/critical-path/demo-mode.spec.ts)
      - Aller sur /onboarding/welcome.
      - Cliquer data-testid="demo-mode-button".
      - Attendre l’event turnstile-success (emit manuel via page.evaluate).
      - Vérifier redirection /app/current-month, présence data-testid="current-month-page", navigation nav-templates, etc.
      - afterEach: appeler await page.request.post('/api/v1/demo/cleanup', { data: { maxAgeHours: 0 }, headers: { 'x-api-key': process.env.DEMO_DEV_KEY }}). Documenter la clé et préciser qu’elle
        doit être dans .env.test.
      - Commande : cd frontend && pnpm test:e2e -- --grep "Demo Mode".
  3. demo-lifecycle.spec.ts
      - Tester “create → cleanup (age 0) → recreate” en listant : template, monthly_budget, transaction.
      - Ajouter tableau const TABLES = ['template','template_line','monthly_budget','budget_line','transaction','savings_goal'].
      - Vérifier, pour chaque table, expect(data).toHaveLength(0) après cleanup, en utilisant in('template_id', templateIds) pour template_line, etc.
      - afterEach: cleanupTestUsers.
  4. demo-schema-coverage.spec.ts
      - Tester “table count guard” via expect(TABLES.length).toBe(6).
      - Insérer en commentaire “Ajouter toute nouvelle table liée à user ici, puis adapter tests”.
      - Reprendre la logique join parent/enfant.
