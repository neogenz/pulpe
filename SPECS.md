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

### Core Calculation Logic: "Fixed Block" vs. "Living Allowance"

1.  **The Plan (Fixed Block):** At the start of the month, the system calculates the **Fixed Block**.
    `Fixed Block = Sum(All Expenses) + Sum(All Planned Savings)`
2.  **The Living Allowance:** The system then calculates the **Living Allowance**.
    `Living Allowance = Planned Income - Fixed Block`
3.  **Tracking (Transactions):** All manually entered transactions throughout the month decrease _only_ the Living Allowance.
4.  **Rollover:** Any remaining positive or negative Living Allowance is rolled over to the next month.

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
  4. ACTIVATE & CALCULATE: The system computes the initial "Living Allowance" and sets alert thresholds.
  ```

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

### RG-002: Living Allowance Calculation

- **Formula:** `Displayed Balance = (Initial Living Allowance) - (Sum of all transactions for the month)`

### RG-003: Overspending Management

- **Alert Thresholds:** System sends notifications at 80%, 90%, 100%, and 110% of the Living Allowance being spent.
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
- **`transactions` (The Events):** Represent actual, manually entered spending. They are linked to a `monthly_budget` but **never** to a specific `budget_line`. They decrease the **Living Allowance**.

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
