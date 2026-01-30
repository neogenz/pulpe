# Pulpe - Product Context

> Business rules, workflows, and domain glossary.

---

## Core Concepts

### Financial Flow Types

| Type | Description |
|------|-------------|
| **Income** | Money entering the budget |
| **Expense** | Money going out (living costs, purchases) |
| **Saving** | Planned savings treated as expenses to ensure realization |

### Domain Model

| Entity | Description |
|--------|-------------|
| **Template** | Reusable month structure (income, expenses, savings) |
| **Budget** | Monthly instance from template, modifiable independently |
| **Budget Line** | Planned item (income/expense/saving) |
| **Transaction** | Actual operation to adjust budget vs. reality |

### Relation Prévu / Réalisé

Le modèle repose sur un couple central :

| Concept | Terme technique | Terme UI (FR) | Rôle |
|---------|----------------|---------------|------|
| **Prévu** | `BudgetLine` | Prévision | Ce qu'on anticipe (revenu, dépense, épargne) |
| **Réalisé** | `Transaction` | Réel | Ce qui s'est passé concrètement |

Les Budget Lines établissent le plan du mois. Les Transactions enregistrent la réalité. L'écart entre les deux indique si on est sur les rails.

> **Note technique** : les termes `BudgetLine` et `Transaction` viennent de mondes sémantiques différents (comptabilité vs banque). Le couple Prévu/Réalisé est la clé de lecture pour naviguer le code.

---

## Calculation Model

### Key Formulas

```
Available = Income + Rollover (from previous month)
Remaining = Available - Expenses
Progress = (Expenses ÷ Available) × 100
Ending Balance = Remaining (stored, becomes next month's rollover)
```

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

---

## Business Rules

### RG-001: Template ↔ Budget Sync

- Template changes offer: "Don't propagate" or "Propagate to future months"
- Manually adjusted budget lines (`is_manually_adjusted = true`) never modified
- Never propagates to past months

### RG-002: Overspending Alerts

| Threshold | Alert Level |
|-----------|-------------|
| 80% | Warning (orange) |
| 90% | Strong alert (red) |
| 100%+ | Allowed, creates negative rollover |

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

---

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

### WF-004: Dashboard (planned — #271)

1. Open app → see hero number "Disponible à dépenser"
2. Temporal progress bar: % of month elapsed vs % budget consumed
3. See unchecked budget lines (quick-check from dashboard)
4. Bar chart: income vs expenses over last 6 months
5. FAB (+) for quick transaction entry

### WF-003: Demo Mode

1. Click "Try demo" (login or onboarding)
2. Cloudflare Turnstile validation
3. Create ephemeral user (backend)
4. Generate realistic data
5. 24h session with auto-cleanup

**Protection**: Rate limiting (10/hour/IP) + Turnstile + single-use tokens

---

## Glossary

### Technical → User Terms (FR)

| Technical | User-Facing |
|-----------|-------------|
| `budget_lines` | Prévisions |
| `fixed` | Récurrent |
| `one_off` | Prévu |
| `transaction` | Réel |
| `income` | Revenu |
| `expense` | Dépense |
| `saving` | Épargne |
| `available` | Disponible à dépenser |
| `remaining` | Reste |
| `rollover` | Report |

### Domain Terms

| Term | Definition | Relationship |
|------|-----------|--------------|
| Template | Reusable month structure | Generates → Budget |
| Budget | Monthly instance from template | Contains → Budget Lines + Transactions |
| Budget Line | Planned budget item | **Planned** — forms couple with Transaction |
| Transaction | Actual operation entry | **Actual** — forms couple with Budget Line |
| Available | Income + rollover | |
| Remaining | Available - expenses | Updated by transactions |
| Rollover | Surplus/deficit carried to next month | |
| Ending Balance | Month result (becomes next rollover) | |

---

*See `projectbrief.md` for project overview.*
*See `DA.md` for brand guidelines and UX writing.*
