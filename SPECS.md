Absolument. Voici le cahier des charges reformaté dans le style `CLAUDE.md`, en se concentrant sur la clarté, la structure et l'information brute pour une compréhension technique directe.

---

# Product Specification: Pulpe

This document outlines the business logic, functional behaviors, and core rules for the Pulpe financial planning application.

## 1. Product Vision & Core Model

### Core Philosophy

- Planning > Tracking
- Anticipation > Reaction
- Serenity > Control
- Simplicity > Completeness

### Core Value Proposition

> In Pulpe, you create month templates that you reuse to plan your year. You always know how much you can spend and how much you will save.

### User Lifecycle

```
1. SETUP: Create profile + define income & fixed expenses.
2. TEMPLATES: Create models for different types of months.
3. PLANNING: Generate annual budgets from templates.
4. TRACKING: Input actual transactions + make adjustments.
5. SAVING: Track progress towards life goals.
6. OPTIMIZATION: Improve templates based on historical data.
```

## 2. Business Model

### Core Concept: Templates

A **Template** is a reusable "month model" containing planned income, expenses, and savings.

#### Template Structure Example

```
Template "Standard Month"
├── Income
│   ├── Salary: 6500 CHF
│   └── Freelance: 200 CHF (variable)
├── Expenses
│   ├── Rent: 1800 CHF
│   ├── Health Insurance: 320 CHF
│   ├── Subscriptions: 180 CHF
│   └── Transport: 150 CHF
└── Planned Savings
    ├── General Savings: 500 CHF
    ├── House Goal: 1200 CHF
    └── Emergency Fund: 200 CHF
```

### From Template to Monthly Budget

A **Monthly Budget** is an _instance_ of a Template for a specific month.

- The budget inherits all lines from the template.
- Template amounts become "budgeted amounts".
- Each line in the budget is independently editable.

### Core Calculation Logic: "Fixed Block" vs. "Available to Spend"

#### Key Concepts (Simplified Architecture)

1.  **The Fixed Block:** At the start of the month, the system calculates the **Fixed Block**.
    `Fixed Block = Sum(All Expenses) + Sum(All Planned Savings)`

2.  **The Ending Balance:** The month's pure balance (without any rollover).
    `Ending Balance = Income - (Expenses + Savings)` from ALL sources (budget_lines + transactions)
    - Stored in `monthly_budget.ending_balance`
    - Represents ONLY the current month's financial result
    - Does NOT include rollover from previous months

3.  **The Rollover:** The amount inherited from the previous month.
    `Rollover = Available to Spend of month n-1`
    - Calculated dynamically by recursively calling previous months
    - Formula: `rollover_N = ending_balance_(N-1) + rollover_(N-1)`

4.  **Available to Spend (User Display):** The final amount the user sees.
    `Available to Spend = Ending Balance (current month) + Rollover`
    - This is the primary value shown to users
    - Combines current month performance with cumulative historical accumulation
    - Calculated dynamically, not stored

#### Simplified Single-Value Approach

The new architecture uses only `ending_balance` with dynamic calculation:
- **ending_balance**: Local month result, independent calculation
- **rollover**: Calculated dynamically by recursively summing previous months
- **Result**: Simpler maintenance, auto-coherent data, KISS principle respected

#### Simple Example (Simplified Architecture)

```
January:
  Income: 5000 CHF, Expenses: 4500 CHF
  → ending_balance: 500 CHF (stored)
  → rollover: 0 CHF (first month)
  → Available to Spend: 500 CHF (calculated: 500 + 0)

February:
  Income: 5200 CHF, Expenses: 4800 CHF
  → ending_balance: 400 CHF (stored)
  → rollover: 500 CHF (calculated: available_to_spend of January)
  → Available to Spend: 900 CHF (calculated: 400 + 500)

March:
  Income: 5100 CHF, Expenses: 5200 CHF
  → ending_balance: -100 CHF (stored)
  → rollover: 900 CHF (calculated: available_to_spend of February)
  → Available to Spend: 800 CHF (calculated: -100 + 900)
```

### Savings Mechanism

Savings are treated as a **priority expense**, not a leftover amount.

- **Formula:** `Available to Spend = Income - Planned Savings - Expenses`
- **User Message:** The user is only shown the final `Available to Spend` amount.

## 3. Business Processes & Workflows

### PM-001: Template Creation Process

- **Trigger:** User clicks "New Template" or duplicates an existing one.
- **Business Rules:**
  - A template must have at least one income line.
  - Total Expenses + Savings cannot exceed Total Income.
  - A template can be marked as "default".
  - Modifying a template prompts the user to propagate changes to future associated budgets.
- **Steps:**
  ```
  1. DEFINE IDENTITY: Name (required), description, color/icon.
  2. CONFIGURE INCOME: Add recurring, variable, and exceptional income lines.
  3. ENTER EXPENSES: Import from another template or enter manually.
  4. PLAN SAVINGS: Allocate funds to existing savings goals or create new ones.
  5. VALIDATE & SAVE: System checks for `Income >= Expenses + Savings`.
  ```

### PM-002: Monthly Budget Generation Process

- **Trigger:** User manually creates a budget for a month, or automatic generation occurs.
- **Steps:**
  ```
  1. SELECT SOURCE TEMPLATE: User chooses from their list of templates.
  2. INSTANTIATE FOR TARGET MONTH: All template lines are copied to a new monthly budget, linking the `template_id`.
  3. CUSTOMIZE POST-CREATION: User can edit, add, or delete any line in the newly created budget.
  4. ACTIVATE & CALCULATE: The system computes the ending_balance and retrieves previous month's rollover to display "Available to Spend".
  ```

### PM-003: Monthly Budget Progress Tracking

- **Trigger:** User views their current month dashboard.
- **Purpose:** Provide real-time visibility of budget consumption.
- **Key Calculations:**
  
  #### Dépenses (Expenses)
  - **Definition:** Total amount spent in the current month, excluding rollover
  - **Formula:** `Dépenses = Σ(budget_lines where kind ∈ ['expense', 'saving'] AND isRollover = false) + Σ(transactions where kind ∈ ['expense', 'saving'])`
  - **Important:** The rollover line is EXCLUDED from expenses calculation
  
  #### Disponible (Available)
  - **Definition:** Total amount available to spend for the month
  - **Formula:** `Disponible = Revenus + Rollover`
    - `Revenus = Σ(budget_lines where kind = 'income') + Σ(transactions where kind = 'income')`
    - `Rollover = budget_line where isRollover = true`
  - **Rollover Sign Convention:**
    - If stored as `expense`: represents positive rollover (money left from previous month)
    - If stored as `income`: represents negative rollover (deficit from previous month)
  
  #### Restant (Remaining)
  - **Definition:** Amount left to spend after expenses
  - **Formula:** `Restant = Disponible - Dépenses`
  - **Interpretation:**
    - Positive: budget still available
    - Negative: over budget situation
  
  #### Progress Percentage
  - **Formula:** `Percentage = (Dépenses ÷ Disponible) × 100%`
  - **Visual Bar:** Capped at 100% for display
  - **Text Display:** Shows actual percentage even if > 100%

- **Alert Thresholds:**
  - **80%:** Warning - budget nearly consumed
  - **90%:** Alert - approaching limit
  - **100%:** Budget fully consumed
  - **>100%:** Over budget situation
- **Visual Feedback:**
  - Green (0-79%): Healthy spending
  - Orange (80-99%): Caution zone
  - Red (≥100%): Over budget

### WF-000: Onboarding & Initial Creation Workflow

- **Goal:** Instantly transform the user's initial setup data into a tangible, usable financial plan.
- **Trigger:** User completes the final step of the initial setup (income/expenses).
- **Workflow:**
  ```
  1. [USER] Completes setup form (personal info, income, expenses).
  2. [SYSTEM] On validation, automatically creates a user account.
  3. [SYSTEM] Creates the first template named "Mois Standard" populated with the provided data.
  4. [SYSTEM] Instantiates this new template to generate the budget for the current month.
  5. [USER] Is redirected directly to their first, fully populated budget screen.
  ```
- **User Outcome:** The user sees immediate value by having their data organized into an actionable plan without any intermediate steps.

### WF-001: Full Year Planning Workflow

- **Goal:** Allow the user to visualize and plan their entire year at a glance.
- **Trigger:** User navigates to the annual view and clicks "Plan Full Year".
- **Workflow:**
  ```
  1. [USER] Clicks "Plan Full Year".
  2. [SYSTEM] Prompts user to select a base template (e.g., "Mois Standard").
  3. [SYSTEM] Generates 12 monthly budgets based on the selected template.
     - (v2) Intelligently assigns specialized templates (e.g., "Tax Month", "Vacation Month") to relevant months.
  4. [USER] Reviews the 12-month calendar overview. Can click any month to edit it or change its assigned template.
  5. [SYSTEM] Displays annual projections: total savings, goal progress, and financially tight months.
  ```

## 4. Business Rules (RG)

### RG-001: Template ↔︎ Budget Cohesion

- **Rule:** When a template is modified, the system MUST prompt the user to update all **future** budgets created from that template.
- **Constraints:**
  - Past budgets are immutable historical records and are never modified.
  - The current month's budget can be updated with user confirmation.

### RG-002: Available to Spend Calculation

- **Stored Values:** 
  - `ending_balance = Income - (Expenses + Savings)` from current month sources only
  - `rollover_balance = Previous Rollover Balance + Current Ending Balance` (cumulative total)
- **Display Formula:** `Available to Spend = Ending Balance + Rollover from Previous Month`
- **Update Strategy:** 
  - When month N is modified: recalculate both `ending_balance_N` and `rollover_balance_N`
  - Future months (N+1, N+2...) keep their stored values unchanged
  - No cascade effect: each month's rollover_balance remains valid until that specific month is modified

### RG-003: Overspending Management

- **Alert Thresholds:** System sends notifications at 80%, 90%, 100%, and 110% of the Available to Spend being spent.
- **Proposed Actions on Overdraft:**
  1.  **Compensate:** Reduce spending in other variable categories.
  2.  **Rollover (Default):** Carry the negative balance over to the next month.
  3.  **Exceptional:** Mark the transaction as "out-of-budget" (for truly exceptional cases).

### RG-006: Transactional Instantiation

- **Rule:** The creation of a monthly budget from a template MUST be an **atomic transaction**. It either succeeds completely or fails entirely, leaving no partial data.
- **Technical Process:**
  ```sql
  BEGIN TRANSACTION;
  -- Step 1: Create the parent budget record in `monthly_budget`.
  INSERT INTO monthly_budget (user_id, month, year, template_id) VALUES (...);
  -- Step 2: Read all lines from the source `template_line`.
  -- Step 3: For each source line, create a corresponding `budget_line`,
  -- linking it to the new `monthly_budget_id` and the original `template_line_id`.
  INSERT INTO budget_line (budget_id, template_line_id, ...) VALUES (...);
  -- ... repeat for all lines ...
  COMMIT; -- Only if all inserts succeed.
  -- On any error:
  ROLLBACK;
  ```

### RG-007: Plan vs. Event Distinction

- The data model maintains a strict separation between planning and reality.
- **`budget_lines` (The Plan):** Represent planned, recurring (`'fixed'`) or one-off (`'one_off'`) income/expenses. They constitute the **Fixed Block**.
  - **Special Case - Rollover Line:** A budget line with `isRollover = true` represents the carried-over balance from the previous month
    - Stored as `expense` with positive amount when previous month had surplus
    - Would be stored as `income` with positive amount when previous month had deficit
    - NOT included in expense calculations for budget progress display
- **`transactions` (The Events):** Represent actual, manually entered spending. They are linked to a `monthly_budget` but **never** to a specific `budget_line`. They affect the **Ending Balance**.
- **`ending_balance` (The Pure Result):** The month's standalone balance including all budget_lines and transactions, excluding any rollover. This represents the month's financial performance in isolation.
- **`rollover_balance` (The Cumulative Result):** The total accumulated balance from the beginning of history up to this month. This value becomes the rollover for the next month.

### RG-008: Transaction Type Classification (Technical)

- **Unified Enum System:** The application uses a simplified, unified enum system for transaction types:
  - **`'income'`:** All sources of revenue (salary, freelance, bonuses, etc.)
  - **`'expense'`:** All types of expenses (rent, food, subscriptions, etc.)
  - **`'saving'`:** All savings contributions (emergency fund, goals, investments)
- **Database Implementation:** All tables (`budget_line`, `template_line`, `transaction`) use the same enum values for consistency.
- **API Consistency:** All endpoints return and accept the same unified enum values without conversion.
- **User Interface Mapping:**
  - `'income'` → "Revenu" (user-facing label)
  - `'expense'` → "Dépense" (user-facing label) 
  - `'saving'` → "Épargne" (user-facing label)

### RG-009: Simplified Rollover Calculation Strategy

- **Rule:** The system calculates rollover dynamically using only `ending_balance` values.
- **Architecture Benefits:**
  - **KISS Principle**: Only one field to maintain (`ending_balance`)
  - **Auto-Coherent**: No risk of data inconsistency between stored values
  - **Self-Healing**: Modifying old months automatically impacts future calculations
  - **Maintenance Simplicity**: No manual propagation or synchronization needed

- **Calculation Flow:**
  ```
  1. Store: ending_balance_N = Σ(income) - Σ(expenses + savings) [month N only]
  2. Calculate dynamically: rollover_N = available_to_spend_(N-1)
  3. Display: available_to_spend_N = ending_balance_N + rollover_N
  ```

- **Update Strategy:** 
  - When month N is modified:
    1. Recalculate and store `ending_balance_N` from all budget_lines + transactions of month N
    2. **No propagation needed**: Future months will automatically get updated values when accessed
  - When displaying month N+1:
    - The system recursively calculates rollover from previous months' ending_balance
    - Always up-to-date, no cache invalidation needed

## 5. Functional Behaviors (CF)

### CF-001: Suggestion Intelligence (v2)

- **Goal:** Reduce manual data entry and provide proactive advice.
- **Transaction Categorization:** The system suggests categories based on a combination of:
  - **Amount:** `3.80 CHF` -> "Public Transport".
  - **Geolocation:** At a Migros -> "Groceries".
  - **Time of Day:** `12:30 PM` -> "Lunch".
  - **User History:** Learns personal habits over time.
- **Proactive Budget Suggestions:**
  - **Pattern Detection:** "You consistently overspend on 'Groceries' by ~100 CHF. Adjust your template?"
  - **Seasonality:** "Last winter, your heating bill increased by 80 CHF/month. Plan for it this year?"

### CF-004: Continuous Learning & Evolution

- **Goal:** The application adapts to the user's life and financial maturity.
- **Periodic Template Review:** Every 3 months, the system analyzes discrepancies between planned vs. actual spending and suggests permanent template adjustments.
- **User Maturity Adaptation (v2):**
  - **Beginner (0-3 months):** Simple templates, heavy guidance, focus on core concepts.
  - **Intermediate (3-12 months):** More granular categories, longer-term projections, optimization suggestions.
  - **Expert (12+ months):** Complex seasonal templates, advanced trend analysis, hypothetical simulations.

### RG-010: Handling Missing or NULL Values

- **First Month**: When no previous month exists, `rollover_balance_(N-1) = 0`
- **Missing Month**: If month N-1 doesn't exist, treat its rollover_balance as 0
- **NULL ending_balance**: If a month's ending_balance is NULL, calculate it on-demand and persist it
- **Data Recovery**: If rollover_balance is corrupted/missing, it can be reconstructed by:
  - Finding the last valid rollover_balance
  - Adding subsequent ending_balances sequentially

## 6. Specific Use Cases (CU)

### CU-001: Handling a "Festivities" Month (e.g., December)

- **Behavior:** A specialized template is used that includes additional expense lines (gifts, parties) and suggests corresponding reductions in other categories (daily food, regular hobbies). It can also accommodate extra income (13th salary, bonus).

### CU-003: Handling a "Vacation" Month

- **Behavior:** A specialized template includes high, one-off expenses (flights, hotels) while simultaneously reducing recurring local expenses (groceries, daily transport).
- **Multi-Month Planning:** The system can help provision for the vacation cost by suggesting small, temporary increases in savings or decreases in spending in the months leading up to the vacation.

### CU-004: Simulating a Major Life Change (e.g., Home Purchase)

- **Behavior:** An integrated simulator allows the user to see the long-term impact of a major purchase.
- **Process:**
  1.  User inputs project details (e.g., property price).
  2.  System calculates time required to save for a down payment at the current savings rate.
  3.  System generates a "Post-Purchase" template, replacing "Rent" with "Mortgage + Fees" and shows the impact on monthly cash flow.
  4.  The user can interactively adjust variables (price, savings rate) to see the effect in real-time.

### CU-005: Monthly Budget Dashboard Consultation

- **Actor:** User
- **Trigger:** User opens the application or navigates to current month view.
- **Context:** User wants to check their financial situation for the current month.
- **Information Displayed:**
  - **Primary Value:** "Disponible à dépenser" (Available to Spend)
    - Shows what remains available after all planned and actual transactions
    - Can be negative if overspending occurred
  - **Progress Indicator:** Budget consumption percentage
    - Visual bar showing percentage of income consumed
    - Color coding: Green (healthy), Orange (caution), Red (over budget)
  - **Quick Actions:**
    - Add new transaction
    - View transaction history
    - Adjust current month budget
- **Business Value:** Provides immediate, actionable financial awareness to guide spending decisions.
