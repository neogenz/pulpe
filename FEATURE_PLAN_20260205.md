# FEATURE_PLAN_20260205.md

> **Pulpe Feature Intelligence Plan**
> Generated: February 5, 2026

---

## 1. Executive Summary

**The iOS app is ahead of the web app.** The iOS dashboard already has the hero balance card, insights, trends, and year overview that web is missing. The biggest opportunity right now is to **fix the bugs blocking iOS App Store submission** while bringing web up to parity with iOS. The encryption system is complete but needs migration cleanup for the 3 existing production users.

**Strategic priority order:**
1. Fix blocking bugs (payday calculation, double counting)
2. Ship iOS to App Store with current feature set
3. Bring web dashboard to iOS parity
4. Add savings goals as the next value pillar

---

## 2. Current State

### What's Working

| Area | Status | Notes |
|------|--------|-------|
| Authentication | Complete | Google OAuth, email/password, demo mode |
| Encryption | Complete | AES-256-GCM split-key architecture |
| Budget Management | Complete | Create, view, edit budgets |
| Template System | Complete | Up to 5 templates, propagation to budgets |
| Transaction Tracking | Complete | Add, edit, delete, checkboxes |
| iOS Core Features | Complete | Full feature parity with web basics |
| iOS Dashboard | Advanced | Hero card, insights, trends, widgets |
| Payday Support | Web only | iOS missing (#267) |

### What's Almost There

| Area | Gap | Issue |
|------|-----|-------|
| iOS Dashboard | Minor polish | Loading skeletons missing (#242) |
| Web Dashboard | Major | Missing hero card, insights, trends (#271) |
| Onboarding | Bug | First budget ignores payday (#270, #302) |
| Expense Calculation | Bug | Double counting in envelopes (#291) |
| Allocated Transactions | Bug | Not counted from current-month (#269) |

### What's Missing

| Feature | Impact | Roadmap |
|---------|--------|---------|
| Savings Goals | High | R2 - Key value pillar (#85) |
| Annual View | Medium | R2 - Plan the year (#29) |
| Dashboard Web | High | R2 - iOS has it, web doesn't (#271) |
| Drag-and-drop Reorder | Low | R2 - Nice to have (#118) |

### What's at Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Payday bugs | Blocker | Users' first budget is wrong - fix before any marketing |
| Double counting | Confusion | Users see incorrect totals - fix before App Store |
| Encryption backfill code | Tech debt | Remove after 3 users migrated (#293) |

---

## 3. Phase 1: Ship This Week

> **Goal:** Fix App Store blockers and critical bugs. No new features.

### P1-1: Fix Payday Budget Period Calculation (CRITICAL)

**What:** When payday is in the near future (e.g., today is the 3rd, payday is the 5th), the onboarding creates a budget for the wrong period. The first budget should cover from last payday to next payday, not calendar month.

**Why now:** This is the first thing every new user experiences. A broken first impression kills retention before it starts. Blocks App Store launch because new iOS users will immediately hit this.

**Builds on:** Existing `BudgetFormulas.calculatePeriodForDate()` logic

**Doesn't touch:** Template system, transaction tracking, existing budgets

**Implementation context:**
- Related issues: #302, #270
- Files involved: `backend-nest/src/modules/budget/budget.calculator.ts`, onboarding stores
- Test with payday = 5, current date = 3 → should create budget for previous period
- Test with payday = 5, current date = 6 → should create budget for current period

---

### P1-2: Fix Double Counting of Allocated Expenses (#291)

**What:** When transactions are allocated to envelope budget lines, they're being counted twice in the total expenses calculation - once in the envelope and once in the overall total.

**Why now:** Users see incorrect "Disponible" numbers. This destroys trust in the app's core value proposition ("see what you can spend").

**Builds on:** `BudgetFormulas.calculateMetrics()`

**Doesn't touch:** Transaction creation, budget lines

**Implementation context:**
- Issue: #291
- The envelope consumption should be deducted from the budget line, not added to total expenses
- Verify iOS and web calculations match

---

### P1-3: Fix Allocated Transactions from Current-Month (#269)

**What:** When adding allocated transactions from the current-month view, they're not being counted correctly in the budget line consumption.

**Why now:** Related to P1-2 - same root cause. Users who allocate expenses see incorrect remaining amounts.

**Builds on:** P1-2 fix

**Doesn't touch:** Unallocated transactions

**Implementation context:**
- Issue: #269
- Test scenario: Add transaction from current-month, allocate to budget line, verify budget line shows correct consumption

---

### P1-4: iOS PayDay Support (#267)

**What:** The iOS app doesn't respect the user's payday setting when calculating the current budget period. A user with payday on the 25th sees the wrong month on iOS.

**Why now:** iOS users who set up via web and switch to iOS see the wrong data. App Store reviewers might catch this.

**Builds on:** Web implementation in `CurrentMonthStore`

**Doesn't touch:** iOS UI, only the period calculation logic

**Implementation context:**
- Issue: #267
- Port the `currentBudgetPeriod` logic from web `CurrentMonthStore` to iOS `CurrentMonthStore`
- User settings (payday) must be fetched from backend

---

### P1-5: Network Timeout Error Message (#251)

**What:** Slow network shows "Maintenance" page instead of a proper error message with retry option.

**Why now:** Creates false impression the app is down. App Store reviewers on slow networks will think the app is broken.

**Builds on:** Existing error handling

**Doesn't touch:** Actual maintenance mode logic

**Implementation context:**
- Issue: #251
- Differentiate between network timeout and actual maintenance response
- Show "Connexion lente - Réessayer?" instead of maintenance page

---

## 4. Phase 2: Ship This Sprint

> **Goal:** iOS App Store submission and web dashboard parity.

### P2-1: iOS Loading Skeletons (#242)

**What:** Replace spinner loading states with skeleton placeholders that match the final content shape. Users perceive skeleton loading as faster than spinners.

**Why now:** App Store polish. First impression during loading matters for reviews.

**Builds on:** Existing loading states in iOS views

**Doesn't touch:** Business logic, data loading

**Implementation context:**
- Issue: #242
- Add skeleton views for: HeroBalanceCard, InsightsCard, TransactionRow
- Use `redacted(reason: .placeholder)` modifier where appropriate

---

### P2-2: iOS Network Call Optimization (#244)

**What:** Reduce redundant API calls on iOS. The app currently makes multiple calls for the same data when navigating between tabs.

**Why now:** App Store reviewers notice sluggish apps. Battery drain from network calls affects reviews.

**Builds on:** Store caching pattern (30s TTL)

**Doesn't touch:** Backend endpoints

**Implementation context:**
- Issue: #244
- Audit `loadIfNeeded()` calls across stores
- Ensure `lastLoadDate` TTL is respected
- Consider prefetching data for adjacent tabs

---

### P2-3: iOS Biometric Re-Authentication (#290)

**What:** When the app is backgrounded for more than 5 minutes, require Face ID/Touch ID to resume. Currently, the app stays unlocked indefinitely.

**Why now:** Financial app security expectation. App Store reviewers check for this.

**Builds on:** Existing `BiometricService`

**Doesn't touch:** Vault code entry, encryption

**Implementation context:**
- Issue: #290
- Track time of last authentication in `AppState`
- Check on `scenePhase` change from `.inactive`/`.background` to `.active`
- Show biometric prompt if threshold exceeded (configurable: 5 min default)

---

### P2-4: Web Dashboard Hero Section (#271 - Part 1)

**What:** Add the "Disponible à dépenser" hero number prominently at the top of the web dashboard, matching iOS's `HeroBalanceCard`. Include circular progress indicator, days remaining, and daily budget.

**Why now:** The core value proposition of Pulpe is "know what you can spend." This number should be unmissable. iOS has it, web doesn't.

**Builds on:** iOS `HeroBalanceCard` design, existing `BudgetFormulas`

**Doesn't touch:** Transaction lists below

**Implementation context:**
- Issue: #271
- Port design from iOS `HeroBalanceCard.swift`
- Use existing `store.totalAvailable()` and `store.totalExpenses()`
- Calculate days remaining from budget period end date
- Calculate daily budget: remaining / days remaining

---

### P2-5: Web Dashboard Insights Card (#271 - Part 2)

**What:** Show top spending category and budget alerts (lines at 80%+) below the hero card.

**Why now:** Gives users immediate actionable insight. iOS has this, web doesn't.

**Builds on:** P2-4, iOS `InsightsCard`

**Doesn't touch:** Detailed transaction lists

**Implementation context:**
- Issue: #271
- Calculate top spending from budget lines with transactions
- Filter budget lines where consumption >= 80%
- Display as compact card with "See details" action

---

### P2-6: Web Dashboard Recent Transactions Card (#271 - Part 3)

**What:** Show 5 most recent transactions in a compact card, with "View all" action.

**Why now:** Users want to quickly verify their recent activity. Reduces need to scroll to find recent entries.

**Builds on:** P2-4, P2-5, existing transaction data

**Doesn't touch:** Full transaction list (kept for "View all")

**Implementation context:**
- Issue: #271
- Take last 5 transactions sorted by `transactionDate`
- Compact row: name, amount, date
- "View all" scrolls to or navigates to full transaction list

---

### P2-7: PostHog iOS Analytics (#289)

**What:** Add PostHog tracking to iOS for key events: app install (first launch), signup completion, first budget creation, D7 retention check.

**Why now:** Can't improve what you can't measure. Need data before App Store launch to understand funnel.

**Builds on:** Existing PostHog web integration

**Doesn't touch:** Core functionality

**Implementation context:**
- Issue: #289
- Events to track: `app_opened`, `signup_completed`, `first_budget_created`, `transaction_added`
- Use PostHog Swift SDK
- Respect user privacy preferences

---

### P2-8: App Store Submission Checklist (#277)

**What:** Complete all App Store Connect requirements: screenshots, descriptions, privacy policy, app preview video (optional).

**Why now:** Gate for App Store submission. Can't ship without it.

**Builds on:** Existing app, iOS features

**Doesn't touch:** Code (marketing/metadata only)

**Implementation context:**
- Issue: #277
- Screenshots: 6.9" and 6.7" sizes minimum
- French description, keywords
- Privacy nutrition labels (data collected, data linked to user)
- Age rating questionnaire
- Test flight internal testing before submission

---

## 5. Phase 3: Ship This Quarter

> **Goal:** Features that make Pulpe worth sharing.

### P3-1: Savings Goals (#85)

**What:** Let users define savings goals (e.g., "Vacances 2026: 3000 CHF") and track progress. Savings budget lines contribute to goal progress.

**Why now:** Savings is already a pillar in the vocabulary but has no dedicated feature. Users who save want to see progress toward something tangible, not just a number.

**Builds on:** Existing savings type in budget lines

**Doesn't touch:** Transaction flow (savings are still budget lines)

**Implementation context:**
- Issues: #85, #28, #34
- New table: `savings_goal` (name, target_amount, target_date, user_id)
- Backend: CRUD endpoints for savings goals
- Frontend: Goals list in new tab or section
- Link savings budget lines to goals
- Show progress: current saved / target

---

### P3-2: Web Dashboard Trends Card (#271 - Part 4)

**What:** Show expense trend over last 3-6 months as a simple bar chart. Include month-over-month variation percentage.

**Why now:** After iOS launch, web users will expect feature parity. Trends give users insight into spending patterns.

**Builds on:** P2-4 through P2-6, iOS `TrendsCard`

**Doesn't touch:** Individual transactions

**Implementation context:**
- Issue: #271
- Requires `DashboardStore` equivalent for web with historical data
- Backend endpoint: `/budgets/summary?months=6` returning monthly totals
- Use simple bar chart (CSS or lightweight library)

---

### P3-3: Annual Budget View (#29)

**What:** Show 12 months on one page in a calendar-like grid. Each month shows: total income, total expenses, ending balance. Color-coded by status.

**Why now:** The app promises "plan your year" but only shows one month at a time. Users who plan ahead want the big picture.

**Builds on:** Existing budget list (already groups by year)

**Doesn't touch:** Monthly budget editing

**Implementation context:**
- Issue: #29
- New route: `/budgets/year/:year`
- Grid layout: 3x4 months
- Click month → navigate to budget details
- Summary row: total income, expenses, savings for year

---

### P3-4: Custom Onboarding Expense Categories (#309)

**What:** Let users add custom expense categories during onboarding beyond the defaults (housing, insurance, phone, transport).

**Why now:** Every user has different fixed expenses. The current onboarding forces users to lump custom expenses into "Autres" or skip them entirely.

**Builds on:** Existing onboarding flow

**Doesn't touch:** Post-onboarding budget line creation

**Implementation context:**
- Issue: #309
- Add "+" button after existing categories
- Custom category: name + amount
- Creates additional template lines

---

### P3-5: Hide Amounts for Screen Sharing (#288)

**What:** Toggle to hide all amounts (show "•••••" or blur) for sharing screen in meetings or recording demos.

**Why now:** Power users want to show Pulpe without revealing finances. Also useful for demo videos and marketing.

**Builds on:** Existing amount display components

**Doesn't touch:** Stored data

**Implementation context:**
- Issue: #288
- Global toggle in settings or quick action
- CSS filter or mask on amount elements
- Persisted preference in user settings
- Keyboard shortcut on web (Cmd+H?)

---

## 6. Parking Lot

> Ideas to revisit after R2 ships.

| Idea | Why Later | Effort |
|------|-----------|--------|
| Bank synchronization | Massive complexity, regulatory | XL |
| Multi-currency | CHF-only is fine for Swiss market | L |
| Shared budgets (couples) | Need significant architecture changes | XL |
| Offline mode (#36) | Need local DB, sync logic | XL |
| JSON import (#247) | No user demand | S |
| Currency converter (#248) | Nice-to-have, not core | M |
| Video generation with Remotion (#284) | Marketing, not product | M |

---

## 7. Rejected Ideas

### Rejected: Transaction Chip Filter (Enable the commented-out code)

**Why rejected:** The current transaction lists are small enough that filtering adds cognitive load without value. Users don't have 100s of transactions per month. If this changes, reconsider.

---

### Rejected: Merge Transactions Feature

**Why rejected:** The button exists in UI but no clear use case. When would users want to merge transactions? If they paid for something in 2 parts, they'd add 2 transactions - that's accurate. Merging hides information.

---

### Rejected: Bulk Delete Transactions

**Why rejected:** Dangerous action with low utility. Users rarely need to delete many transactions at once. If they do, they probably added test data during exploration - that's what demo mode is for.

---

### Rejected: Server-Side Only Encryption (#299)

**Why rejected:** The split-key architecture is already implemented and provides stronger privacy guarantees. Changing to server-side only would regress the privacy story and require re-migrating all users.

---

### Rejected: Rename BudgetLine/Transaction to Prévu/Réalisé (#283)

**Why rejected:** Domain model names should be stable. The UI already uses the French terms. Renaming backend entities creates migration complexity with no user-facing benefit.

---

## 8. Dependency Map

```
Phase 1 (All Independent - Can Parallelize):
├── P1-1: Payday Bug Fix
├── P1-2: Double Counting Fix
├── P1-3: Allocated Transactions Fix (depends on P1-2)
├── P1-4: iOS PayDay Support (depends on P1-1)
└── P1-5: Network Timeout Error

Phase 2 (Some Dependencies):
├── P2-1: iOS Skeletons (independent)
├── P2-2: iOS Network Optimization (independent)
├── P2-3: iOS Biometric (independent)
├── P2-4: Web Hero Section (independent)
├── P2-5: Web Insights (depends on P2-4)
├── P2-6: Web Recent Transactions (depends on P2-4)
├── P2-7: PostHog iOS (independent)
└── P2-8: App Store Checklist (depends on P2-1 through P2-7)

Phase 3 (Sequential Preference):
├── P3-1: Savings Goals (independent, can start early)
├── P3-2: Web Trends (depends on P2-4 through P2-6)
├── P3-3: Annual View (independent)
├── P3-4: Custom Onboarding Categories (independent)
└── P3-5: Hide Amounts (independent)
```

---

## Approval Checklist

- [ ] Phase 1 scope approved
- [ ] Phase 2 scope approved
- [ ] Phase 3 scope approved
- [ ] Rejected ideas acknowledged
- [ ] Ready for implementation

---

*This plan focuses on compounding value rather than isolated additions. Each feature builds on what exists and makes the whole app more valuable.*
