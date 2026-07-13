# Project Brief

## What it is
- Pulpe is French-language personal-budget planning for Swiss residents on web and native iOS, built for non-experts.

## Why it exists
- Planning ahead and a clear “Disponible à dépenser” reduce budget anxiety compared with reactive accounting.

## Domain language
| Term | Meaning |
| --- | --- |
| Template | Reusable monthly structure for income, expenses, and savings. |
| Budget | One independently editable month generated from a template. |
| Prévision | Planned `budget_line`; either Récurrent (`fixed`) or Prévu (`one_off`). |
| Réel | Actual `transaction`; Pointé means reconciled. |
| Report | Prior month’s ending balance carried into the next month. |

## Key features
- Monthly templates, annual generation, planned-versus-actual tracking, and rollover.
- Expense spreading/postponement and frozen CHF/EUR conversion metadata.
- Full demo without signup. Business rules live in `memory-bank/productContext.md`.
