# Pulpe - Project Brief

> Foundation document providing high-level overview and strategic direction.

---

## Project Overview

**Pulpe** is a personal budget management application for the Swiss market. Users plan their financial year with reusable monthly templates, always knowing how much they can spend and save.

**Target Users**: Swiss residents with regular monthly income who prefer planning over reactive tracking.

**Currency**: CHF only (V1)

**Project Context**: Single developer, YAGNI/KISS principles throughout.

---

## Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Planning > Tracking** | Anticipate rather than react |
| **Simplicity > Completeness** | KISS & YAGNI |
| **Serenity > Control** | Peace of mind over obsessive tracking |
| **Isolation > DRY** | Clear boundaries between features |

---

## V1 Scope

### Included

- Annual planning with reusable templates
- Monthly budget tracking vs. actual spending
- Automatic rollover between months
- Overspending alerts (80%, 90%, 100%)
- Plan (budget lines) vs. reality (transactions) distinction
- Demo mode for product exploration

### Not Included (Future)

- Multi-currency
- Bank synchronization
- Shared budgets
- Advanced categorization
- Automatic recurring transactions
- Long-term projections
- Retroactive modifications

---

## Success Metrics

- Users can set up their first budget in < 5 minutes (onboarding)
- Clear visibility of "what's left to spend" at any moment
- Rollover calculations propagate correctly across months
- Demo mode provides identical experience to production

---

## Key Constraints

- Single currency (CHF) - no multi-currency complexity
- Manual transaction entry only - no bank sync
- One budget per month per user
- One default template per user

---

*See `productContext.md` for business rules and workflows.*
*See `techContext.md` for technical decisions.*
