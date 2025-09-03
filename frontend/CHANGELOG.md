# pulpe-frontend

## 2025.9.0

### Minor Changes

- # Automatic Living Allowance Rollover System

  Introduces automatic rollover of unused budget between months, enabling users to carry forward their "Available to Spend" balance instead of losing it at month-end.

  **New Features:**
  - **Automatic Rollover**: Unused Living Allowance automatically carries over to the next month
  - **Cumulative Balance View**: See total accumulated balance across months in budget tables
  - **Month Navigation**: Navigate between months to track rollover flow with dedicated navigation buttons
  - **Visual Distinction**: Rollover amounts are clearly highlighted in the budget interface

  **User Benefits:**
  - No more lost unused budget at month transitions
  - Better long-term financial planning with accumulated savings
  - Clear visibility into budget carryover between periods
  - Improved budget management workflow

  **Technical Improvements:**
  - Persistent cumulative rollover balance for O(1) performance
  - Enhanced error handling and data consistency
  - Robust database migrations for existing budgets
  - Comprehensive test coverage for edge cases

  This feature fundamentally improves how users manage their monthly budgets by preserving unused funds across time periods.

### Patch Changes

- Updated dependencies
  - @pulpe/shared@0.2.0
