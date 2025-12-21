# Pulpe - Product Specification (V1)

## Project Brief

Pulpe is a personal budget management application for the Swiss market. Users plan their financial year with reusable monthly templates, always knowing how much they can spend and save.

**Target Users**: Swiss residents with regular monthly income who prefer planning over reactive tracking.

**Project Context**: Single developer, CHF only, YAGNI/KISS principles.

## Philosophy

- **Planning > Tracking** (anticipate rather than react)
- **Simplicity > Completeness** (KISS & YAGNI)
- **Serenity > Control** (peace of mind over obsessive tracking)

## Core Concepts

### Financial Flow Types
- **Income**: Money entering the budget
- **Expense**: Money going out (living costs, purchases)
- **Saving**: Planned savings treated as expenses to ensure realization

### Key Calculations
- **Available** = Income + Rollover (from previous month)
- **Remaining** = Available - Expenses
- **Progress** = (Expenses ÷ Available) × 100
- **Ending Balance** = Remaining (stored, becomes next month's rollover)

### Domain Model
- **Template**: Reusable month structure (income, expenses, savings)
- **Budget**: Monthly instance from template, modifiable independently
- **Budget Line**: Planned item (income/expense/saving)
- **Transaction**: Actual operation to adjust budget vs. reality

## Calculation Model

### Rollover Chain
```
Month M   : ending_balance = (income + rollover_from_M-1) - expenses
Month M+1 : rollover = ending_balance_from_M
First month: rollover = 0
```

### Example
```
Jan: income=5000, expenses=4500, rollover=0    → ending=500
Feb: income=5200, expenses=4800, rollover=500  → ending=900
Mar: income=5100, expenses=5200, rollover=900  → ending=800
```

> Negative ending_balance propagates as negative rollover (debt).

## V1 Scope

### Included
- Annual planning with reusable templates
- Monthly budget tracking vs. actual spending
- Automatic rollover between months
- Overspending alerts (80%, 90%, 100%)
- Plan (budget lines) vs. reality (transactions) distinction

### Not Included
- Multi-currency (CHF only)
- Bank synchronization
- Shared budgets
- Advanced categorization
- Automatic recurring transactions
- Long-term projections
- Retroactive modifications

## Business Rules

### RG-001: Template ↔ Budget Sync
- Template changes offer: "Don't propagate" or "Propagate to future months"
- Manually adjusted budget lines (`is_manually_adjusted = true`) never modified
- Never propagates to past months

### RG-002: Overspending
- 80%: Warning notification (orange)
- 90%: Strong alert (red)
- 100%+: Allowed, creates negative rollover to next month

### RG-003: Atomicity
- Budget creation from template: complete or rollback
- Transaction import: all or nothing with error report

### RG-004: Constraints
- One default template per user
- One budget per month per user
- At least one income line required in template
- Warning if expenses + savings > income in template

### RG-005: Transactions
- Manual entry only
- Added to budget lines (don't replace them)
- No modification after entry (V1)
- Impact remaining immediately

## Workflows

### WF-000: Onboarding
1. Enter basic info (income + fixed expenses)
2. Auto-create "Standard Month" template
3. Generate current month budget
4. Redirect to dashboard

### WF-001: Annual Planning
1. Select reference template
2. Choose period (default: calendar year)
3. Generate 12 identical budgets
4. Adjust individual months as needed

### WF-002: Monthly Tracking
1. View dashboard (available, remaining, progress)
2. Add transactions as they occur
3. Receive alerts at thresholds
4. Auto-close at month end with rollover calculation

### WF-003: Demo Mode
1. Click "Try demo" (login or onboarding)
2. Cloudflare Turnstile validation
3. Create ephemeral user (backend)
4. Generate realistic data
5. 24h session with auto-cleanup

**Protection**: Rate limiting (10/hour/IP) + Turnstile + single-use tokens

## Glossary

| Term | Definition |
|------|------------|
| Template | Reusable month structure |
| Budget | Monthly instance from template |
| Budget Line | Planned budget item |
| Transaction | Actual operation entry |
| Available | Income + rollover |
| Remaining | Available - expenses |
| Rollover | Surplus/deficit carried to next month |
| Ending Balance | Month result (becomes next rollover) |

## Future (Post-V1)

- Multi-currency
- Shared budgets
- Advanced categorization
- Recurring transactions
- Bank sync (PSD2)
- PDF/Excel export
