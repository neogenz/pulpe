---
name: swiftlint-file-length-thresholds
description: iOS SwiftLint file_length is 500 warn / 800 error globally; the 350-LOC cap is a custom rule scoped ONLY to BudgetDetails feature files
metadata:
  type: reference
---

Two different limits, don't conflate them:

- **Global `file_length`** (`ios/.swiftlint.yml`): `warning: 500`, `error: 800`. Many existing files are 450-720 LOC and pass. `type_body_length`: warn 300 / error 500. `function_body_length`: warn 50 / error 100. `function_parameter_count`: 5 (warning).
- **BudgetDetails-only 350-LOC cap**: enforced by the feature architecture rule [[budget-details-feature-architecture]] (rule #8 "every file ≤ 350 LOC") and a custom regex rule (`.swiftlint.yml` ~line 184) that ERRORS if you `swiftlint:disable file_length`/`type_body_length` inside `.../Pulpe/Features/Budgets/BudgetDetails/.*`. Scope is that folder only.

**Why this matters:** don't assume a global 350 ceiling and over-refactor to shrink files that are fine. A file at 365 LOC outside BudgetDetails is well under the 500 warning. Inside BudgetDetails, prefer splitting (new extension/component file) over disabling — disabling is a hard CI error there.

**function_parameter_count=5 bites** when threading extra context through projector helpers (`makeSections` etc.). Fix by computing the value inside the function from an arg it already has (e.g. derive `allocatedLineIds` from `dataStore.transactions.compactMap(\.budgetLineId)`) rather than adding a 6th parameter.

Verify limits with `grep -n -A3 "file_length\|function_parameter_count" ios/.swiftlint.yml` — don't trust memory of the numbers.
