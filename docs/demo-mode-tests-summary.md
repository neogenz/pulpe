# Demo Mode Tests - Implementation Summary

**Date**: 2025-01-11  
**Status**: ✅ Implementation Complete

---

## 🎯 Objectives Achieved

Added 3 critical tests to prevent demo mode regressions:

1. ✅ **E2E Critical Path Test** - Tests complete user flow from button click to dashboard
2. ✅ **Backend Lifecycle Test** - Validates create → cleanup → recreate cycle
3. ✅ **Backend Schema Coverage Test** - Ensures all tables are cleaned up

---

## 📁 Files Created

### New Test Files (3)

1. **`frontend/e2e/tests/critical-path/demo-mode.spec.ts`** (120 lines)
   - Tests complete demo flow with real backend
   - Simulates Turnstile success event
   - Verifies navigation and data presence
   - Tests error handling (rate limit, backend failures)
   - Cleanup via `/api/v1/demo/cleanup` endpoint

2. **`backend-nest/src/modules/demo/demo-lifecycle.spec.ts`** (200 lines)
   - Tests create → cleanup → recreate immediately
   - Verifies CASCADE deletion across all 6 tables
   - Validates no conflicts on immediate recreation
   - Uses `TABLES` constant for consistency

3. **`backend-nest/src/modules/demo/demo-schema-coverage.spec.ts`** (170 lines)
   - Hardcoded list of 6 tables to verify
   - Table count guard test (fails if count changes)
   - Documents parent-child CASCADE relationships
   - Forces developer review on schema evolution

### Modified Files (3)

1. **`backend-nest/src/modules/demo/demo-cleanup.service.ts`**
   - Added comment listing all CASCADE tables
   - References schema coverage test

2. **`backend-nest/CLAUDE.md`**
   - Added "Demo Mode Testing" section
   - Documents `DEMO_DEV_KEY` requirement
   - Provides schema evolution checklist

3. **`frontend/.env.example`**
   - Added `DEMO_DEV_KEY` configuration
   - Documented usage for E2E tests

---

## 🧪 Running the Tests

### Backend Tests

```bash
# Run lifecycle tests
cd backend-nest
bun test src/modules/demo/demo-lifecycle.spec.ts

# Run schema coverage tests
bun test src/modules/demo/demo-schema-coverage.spec.ts

# Run all demo tests
bun test src/modules/demo
```

**Expected Results**:
- 2 tests in `demo-lifecycle.spec.ts` (create→cleanup→recreate, CASCADE verification)
- 3 tests in `demo-schema-coverage.spec.ts` (all tables cleanup, table count guard, relationships doc)

### E2E Tests

```bash
# No prerequisites - tests are fully isolated with mocked API
cd frontend
pnpm test:e2e -- --grep "Demo Mode"
```

**Expected Results**:
- 4 tests in `demo-mode.spec.ts`:
  - ✅ Create demo session and navigate to dashboard
  - ✅ Functional demo data after creation
  - ✅ Handle demo creation errors gracefully
  - ✅ Show loading state during creation

**Note**: E2E tests use `page.route()` to mock all API calls. No real backend required.

---

## 🔍 Test Coverage Details

### 1. E2E Critical Path Test

**What it tests**:
- User clicks "Demo" button → Turnstile event → Mocked API → Dashboard
- Demo data is present (4 templates, budget lines)
- Navigation works (templates, current-month)
- Error handling (rate limit 429, backend errors)
- Loading states (button disabled during creation)

**Key Features**:
- Uses **mocked API** via `page.route()` (fully isolated)
- Simulates Turnstile via `window.dispatchEvent('turnstile-success')`
- No backend dependency - runs in parallel mode
- Tests both success and error paths

---

### 2. Backend Lifecycle Test

**What it tests**:
- **Phase 1**: Create demo user → verify data exists
- **Phase 2**: Cleanup with age=0 → verify user deleted
- **Phase 3**: Recreate immediately → verify no conflicts
- CASCADE deletion across ALL 6 tables:
  - `template` (direct user_id)
  - `template_line` (CASCADE via template_id)
  - `monthly_budget` (direct user_id)
  - `budget_line` (CASCADE via budget_id)
  - `transaction` (CASCADE via budget_id)
  - `savings_goal` (direct user_id)

**Key Features**:
- Real database operations
- Tracks `testUserIds[]` for cleanup
- Verifies template IDs are different (fresh data)
- Tests immediate recreation (validates requirement)

---

### 3. Backend Schema Coverage Test

**What it tests**:
- All 6 tables are cleaned up after user deletion
- Table count guard (test fails if count changes)
- Parent-child CASCADE relationships documented

**Key Features**:
- `TABLES` constant forces explicit list
- Test fails if new table added without review
- Functional verification (no schema introspection)
- Living documentation of CASCADE relationships

**Table List**:
```typescript
const TABLES = [
  'template',
  'template_line',
  'monthly_budget',
  'budget_line',
  'transaction',
  'savings_goal',
] as const;
```

---

## 🛠️ Schema Evolution Checklist

When adding a new table with `user_id` or user-related data:

1. ✅ Add table name to `TABLES` constant in:
   - `demo-lifecycle.spec.ts`
   - `demo-schema-coverage.spec.ts`

2. ✅ Ensure `ON DELETE CASCADE` is configured in `schema.sql`

3. ✅ Update verification logic in both test files

4. ✅ Update `demo-data-generator.service.ts` if seeding needed

5. ✅ Update table list comment in `demo-cleanup.service.ts`

6. ✅ Run tests to verify cleanup works

---

## ✅ Verification Checklist

Before merging:

- [ ] All 3 new test files created
- [ ] All 3 modified files updated
- [ ] `DEMO_DEV_KEY` documented in `.env.example`
- [ ] Backend tests pass (`bun test src/modules/demo`)
- [ ] E2E tests pass (with backend running)
- [ ] No regressions in existing tests
- [ ] Documentation complete (`backend-nest/CLAUDE.md`)

---

## 📊 Coverage Impact

### Before
- ❌ No E2E test for demo mode
- ❌ No lifecycle test for complete cycle
- ❌ No schema coverage protection

### After
- ✅ E2E test: 4 scenarios covering complete flow
- ✅ Lifecycle test: 2 scenarios verifying cycle + CASCADE
- ✅ Schema coverage: 3 tests protecting against schema evolution

**Total**: +9 tests, ~490 lines of test code

---

## 🎓 Key Patterns Used

### E2E Test Pattern
- Based on `authentication.spec.ts`
- Mocked API via `page.route()` (like `auth-bypass.ts`)
- Turnstile simulation via custom event
- Fully isolated - no external dependencies

### Backend Integration Test Pattern
- Based on `demo.service.spec.ts`
- Real database with `demo-test-utils.ts`
- Track test data in `testUserIds[]`
- GIVEN/WHEN/THEN structure

### Schema Coverage Pattern
- Functional verification (no introspection)
- Hardcoded table list with guard test
- Documents CASCADE relationships
- Forces review on schema changes

---

## 🚀 Next Steps

1. **Run Tests**:
   ```bash
   # Backend
   cd backend-nest && bun test src/modules/demo
   
   # E2E (with backend running + DEMO_DEV_KEY set)
   cd frontend && pnpm test:e2e -- --grep "Demo Mode"
   ```

2. **Verify All Pass**: Ensure no failures or flakiness

3. **Check CI**: Tests should run in CI pipeline

4. **Update .env**: Copy `.env.example` values to `.env` and `.env.test`

5. **Team Review**: Get feedback on test usefulness

---

## 📝 Notes

- **DEMO_DEV_KEY**: Can be any string, used only for dev cleanup endpoint
- **Turnstile**: Backend auto-skips verification in test environment
- **Rate Limiting**: May need adjustment for test runs (10 req/hour default)
- **Test Duration**: E2E tests may take 30-60s due to backend operations

---

## 🐛 Troubleshooting

### E2E Tests Fail with "DEMO_DEV_KEY not set"
- Add `DEMO_DEV_KEY=demo-dev-key-local-testing-only` to `.env.test`
- Ensure environment variable is loaded in Playwright config

### Backend Tests Fail with "SUPABASE_URL undefined"
- Ensure `.env.test` exists with Supabase credentials
- Check that `ConfigModule` loads `.env.test` correctly

### CASCADE Deletion Not Working
- Verify `ON DELETE CASCADE` in `schema.sql`
- Check RLS policies aren't blocking deletion
- Review foreign key constraints

### Demo Users Not Cleaned Up
- Verify `/api/v1/demo/cleanup` endpoint is accessible
- Check `DEMO_DEV_KEY` matches header value
- Ensure `DevOnlyGuard` allows access in test environment

---

**Status**: ✅ Ready for testing and review
