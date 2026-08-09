# Project Brief

## What it is
- Pulpe is French-language personal-budget planning for Swiss residents on web and native iOS, built for non-experts.

## Why it exists
- Planning ahead and a clear “Disponible à dépenser” reduce budget anxiety compared with reactive accounting.

## Domain language
The code-to-French mapping lives in `CLAUDE.md § Vocabulary`. Three terms it does not carry:
- **Template** — reusable monthly structure for income, expenses, and savings.
- **Budget** — one independently editable month generated from a template.
- **Report** — prior month's ending balance carried into the next month.

## Key features
- Monthly templates, annual generation, planned-versus-actual tracking, and rollover.
- Expense spreading/postponement and frozen CHF/EUR conversion metadata.
- Savings goals with planned withdrawals (`docs/SAVINGS.md`), and user-defined tags on forecasts, transactions, and template lines.
- Full demo without signup. Cross-feature business rules live in `docs/BUSINESS_RULES.md`.
