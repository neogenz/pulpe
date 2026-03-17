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

---

## Calculation Model

### Key Formulas

```
Available = Income + Rollover (from previous month)
Remaining = Available - Expenses
Progress = (Expenses ÷ Available) × 100
Ending Balance = Remaining (stored, becomes next month's rollover)
```

### Envelope Logic (SSOT: `shared/BudgetFormulas`)

All calculations use a single set of formulas with envelope logic and kind filtering. There is only one version of each formula — no "with/without envelope" variants.

- **Allocated transactions** (`budget_line_id` set) are covered by their envelope (budget line). Effective amount = `max(line.amount, consumed)`. This prevents double-counting when transactions are allocated to a line.
- **Kind filter**: When computing `consumed` for a line, only transactions matching the line's kind category count (income transactions for income lines, expense/saving transactions for expense/saving lines). This prevents a misallocated transaction from inflating the wrong total.
- **Free transactions** (`budget_line_id` null) impact the budget directly, added on top of envelope totals.
- **totalSavings**: Uses envelope logic (`max(line.amount, consumed)`) for saving lines, plus free saving transactions. This provides a complete savings picture including ad-hoc savings.

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

### RG-002: Budget Line Consumption States

Applies to **expense lines only**. Income and saving lines always display as `healthy` regardless of consumption (saving is an objective to reach, not a limit to respect).

| Threshold | State | Color |
|-----------|-------|-------|
| 0–79% | `healthy` | Secondary (gray) |
| 80–100% | `near-limit` | Warning amber |
| >100% | `over-budget` | Deep amber |
| 100%+ overall budget | Allowed, creates negative rollover |

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
- Modification allowed for allocated transactions (name, amount)
- Reallocation to another envelope is not allowed
- Free transaction editing follows the same pattern
- Impact remaining immediately

### RG-006: App Lock & Biometric Unlock (iOS)

| Rule | Value |
|------|-------|
| PIN length | Exactly 4 digits (enforced client-side before PBKDF2 derivation) |
| Grace period | 30 seconds in background |
| Cold start | Always requires Face ID/PIN (no grace period) |
| Lock behavior | In-memory client key cleared, biometric keychain preserved |
| Biometric auto-trigger | Face ID/Touch ID prompts automatically on PIN screen |
| Fallback | PIN entry via numpad (Face ID button visible while < 4 digits entered) |

**Flow:** Background >= 30s OR app killed → `needsPinEntry` → PinEntryView auto-triggers Face ID → if success, instant unlock; if fail/cancel, user types PIN.

**Design decision:** `clearCache()` (in-memory only) is used, not `clearAll()` (which would wipe biometric keychain). This preserves the biometric key across grace period locks, enabling Face ID as a fast re-entry path.

### RG-007: Recovery Key

- Recovery key shown **once** after PIN setup, PIN recovery, or manual regeneration from settings
- Format: 32 bytes, base32 grouped (`XXXX-XXXX-...`)
- **Never stored server-side** (only `wrappedDEK` is stored)
- Clipboard copy available; no email/cloud backup
- Can be regenerated anytime from Account settings (requires password verification)
- If both PIN and recovery key are lost: encrypted financial data is **permanently inaccessible** (zero-knowledge model)
- Account itself can be recovered via email password reset, but encrypted amounts become undecipherable
- iOS: "J'ai noté ma clé" button dismisses without paste-back confirmation (spec says `Confirmation obligatoire` but iOS does not enforce it — known deviation)

### RG-008: Widget Data Privacy

- Widget caches `available` (remaining budget) as plaintext `Decimal` in App Group UserDefaults
- **Not encrypted at rest** — WidgetKit runs in a separate process without access to keychain/Face ID
- App lock (30s grace period) does **not** extend to widget preview
- Widget data is cleared on logout and password reset
- **Accepted risk:** widget shows financial amounts even when app is locked

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
| `transaction` | Transaction / Réel |
| `income` | Revenu |
| `expense` | Dépense |
| `saving` | Épargne |
| `available` | Disponible à dépenser |
| `remaining` | Reste |
| `rollover` | Report |
| `checked` | Pointé |
| `unchecked` | À pointer |

### Domain Terms

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

---

*See `projectbrief.md` for project overview.*
*See `DA.md` for brand guidelines and UX writing.*
