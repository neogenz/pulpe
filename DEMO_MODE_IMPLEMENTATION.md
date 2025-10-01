# Demo Mode Implementation - Backend-First Approach

## ✅ Phase 1: Backend Implementation (COMPLETED)

### Architecture Overview

The new demo mode creates **real ephemeral users** via Supabase Admin API instead of simulating requests in the frontend. This eliminates:
- ~1500 lines of duplicated business logic
- Manual route simulation
- localStorage persistence complexities
- Maintenance drift between demo and production

### Backend Components Created

#### 1. Demo Module (`backend-nest/src/modules/demo/`)

**Files:**
- `demo.module.ts` - NestJS module with ScheduleModule & ThrottlerModule
- `demo.controller.ts` - Public endpoint `POST /api/v1/demo/session`
- `demo.service.ts` - Core service for creating demo users
- `demo-data-generator.service.ts` - Realistic Swiss financial data generator
- `demo-cleanup.service.ts` - Cron job for automatic cleanup
- `dto/demo-session-response.dto.ts` - Response schema

#### 2. Demo User Creation Flow

```typescript
POST /api/v1/demo/session
→ Creates user with Supabase Admin API
→ Sets metadata: { is_demo: true, created_at: timestamp }
→ Seeds demo data (4 templates, 12 budgets, transactions)
→ Returns real JWT session
→ Frontend uses JWT like normal authentication
```

#### 3. Data Seeding

**Templates Created:**
1. 💰 Mois Standard (default) - Typical monthly budget
2. ✈️ Mois Vacances - Vacation month with travel expenses
3. 🎯 Mois Économies Renforcées - Savings-focused month
4. 🎄 Mois de Fêtes - Holiday month with gifts

**Budget Generation:**
- 6 past months + 6 future months (12 total)
- Smart template selection based on month
- Realistic Swiss financial amounts (CHF)
- Sample transactions for demonstration

#### 4. Automatic Cleanup

**Cron Job:** Runs every 6 hours
**Logic:** Deletes demo users created > 24 hours ago
**Cascade:** RLS policies ensure all user data is deleted

#### 5. Security Features

✅ Rate limiting: 10 requests/hour per IP
✅ Service role key stays server-side only
✅ Demo users get same RLS as regular users
✅ Automatic expiration prevents data accumulation
✅ Public endpoint (no auth required for creation)

#### 6. Database Migration

**File:** `20251001073203_add_demo_user_helpers.sql`

**Functions Added:**
- `get_demo_users_to_cleanup(max_age_hours)` - Identifies demo users to delete
- `count_demo_users()` - Returns active demo user count
- `get_demo_user_stats()` - Statistics about demo users

### Build Status

✅ **TypeScript compilation: PASSED**
✅ **Module registration: COMPLETE**
✅ **No compilation errors**

---

## 🔄 Phase 2: Frontend Changes (TODO)

### Files to DELETE (~1500 lines)

```
frontend/projects/webapp/src/app/core/demo/
├── demo-storage-adapter.ts (~850 lines) ❌
├── demo-request-router.ts (~600 lines) ❌
├── demo-http.interceptor.ts ❌
└── demo-storage-adapter.types.ts ❌
```

### Files to SIMPLIFY

**demo-mode.service.ts:**
- Remove all localStorage data management
- Keep only UI state (isDemoMode signal for banner)

### Files to CREATE

**demo-initializer.service.ts** (~50 lines):
```typescript
async startDemoSession(): Promise<void> {
  const response = await http.post<DemoSessionResponse>('/api/v1/demo/session');
  await supabase.auth.setSession(response.data.session);
  this.demoMode.enableDemoMode();
}
```

### Key Insight

After calling `/api/v1/demo/session`, the frontend **doesn't know it's a demo user**. It just has a valid JWT and uses existing services (BudgetApiService, TemplateApiService, etc.) **without any changes**.

---

## 📊 Code Reduction

- **Before:** ~1500 lines (duplicated business logic + routing)
- **After:** ~200 lines (simple initialization)
- **Reduction:** ~85%

---

## 🧪 Phase 3: Testing (TODO)

### Backend Tests
- [ ] Unit tests for DemoService
- [ ] Unit tests for DemoDataGeneratorService
- [ ] Unit tests for DemoCleanupService
- [ ] Integration test for full demo session creation

### Frontend Tests
- [ ] E2E test: Create demo session
- [ ] E2E test: Use demo session like normal user
- [ ] E2E test: Demo banner displays correctly

### Performance Tests
- [ ] Demo user creation < 500ms
- [ ] Cleanup job execution monitoring

---

## 🚀 Next Steps

1. **Frontend Implementation:**
   - Delete old demo simulation code
   - Create simple demo-initializer service
   - Update UI to call new endpoint

2. **Testing:**
   - Write backend unit tests
   - E2E tests for complete flow
   - Performance validation

3. **Deployment:**
   - Deploy backend first (new endpoint)
   - Deploy frontend second (use new endpoint)
   - Monitor demo user creation and cleanup

---

## 📝 Benefits of This Approach

✅ **Single Source of Truth:** Backend has all business logic
✅ **No Duplication:** DRY principle respected
✅ **Production-Identical:** Demo uses real auth flow
✅ **Auto-Cleanup:** Follows SaaS best practices
✅ **RLS Enforced:** Security by default
✅ **Easy Maintenance:** Only ~200 lines vs ~1500
✅ **Testable:** Can write integration tests with real backend
✅ **Scalable:** Works with any backend changes automatically

---

**Status:** Backend implementation complete ✅
**Next:** Frontend implementation 🔄
**Branch:** `backend-demo-ephemeral-users`
