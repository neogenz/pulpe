---
status: pending
---

# Instruction: Safety net on the real database

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── backend-nest/
    └── src/
        ├── test/
        │   └── label-journey.ts ✅
        └── modules/
            └── encryption/
                └── label-parity.integration.spec.ts ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Local Supabase up; the journey boots `AppModule` and creates a fresh user with a vault through the API | A user with no data and a valid key | api |
| Happy path | Run the journey: every label write entry point once, each with a unique name | Each of the 13 label columns holds at least one written value, and every value reads back identical through the API | api |
| Happy path | Golden searches: case, accents, literal punctuation, tag-name match, more than 25 hits | Result ids and their order, snapshotted from today's Postgres search | api |
| Happy path | List tags, asset categories, template lines and a goal deletion impact on a golden set (accents, case, digits, emoji) | Orders snapshotted from today's `ORDER BY name` | api |
| Edge case  | Create a tag, then an asset category, whose name differs only by case or Unicode form | `TAG_ALREADY_EXISTS`, `ASSET_CATEGORY_DUPLICATE` | api |
| Edge case  | 31-character tag or category name, 101-character asset name | 400 from the request schema, before the database | api |
| Edge case  | Apply a goal plan with a withdrawal; generate budgets from a template | A line named `Retrait — <goal name>`; a description `Budget <month>/<year>` | api |
| Edge case  | Rename a goal that has linked lines and movements, then delete a goal | The linked `source_savings_goal_name` follow the rename; the orphan keeps its last value | api |
| Edge case  | Break one behaviour on purpose: search match, order, duplicate mapping | The matching case goes red | system |
| Teardown   | The spec deletes its users | No row left for the test users | system |

## Tasks to do

### `1)` Record the production facts the later phases rely on

> Read-only figures, no content, pasted in the pull request.

1. Collation of the production database: `datcollate`, `datlocprovider`, `datlocale` from `pg_database`. Locally it is ICU `en-US`.
2. Row counts of the nine label tables for the largest account: they size the in-memory search, the rekey payload and the conversion.

### `2)` Write the label journey

> One helper that drives every way a label gets written.

1. `label-journey.ts` boots `AppModule` with supertest on the local database, as `encryption.e2e.spec.ts` does, and creates a user with a vault.
2. It calls each write entry point with a unique name: movements (create, update, goal withdrawal, import, spread), budget lines (create, update, reset from template, both spread routes, savings withdrawal), budgets (create, generate, update), templates (create, from onboarding, update, line create and update, bulk operations with propagation), goals (create, update, plan), tags, asset categories and assets (create, update), the demo session, and the assistant write tools including `duplicate_template`.
3. It returns every written value as table, column, row id and expected text, and fails if one of the 13 columns was not reached.

### `3)` Pin today's behaviour

> `label-parity.integration.spec.ts` is green on the untouched code and stays green through phase 6.

1. Read-back: every journey value comes back identical through the read endpoints and `GET /budgets/export`.
2. Search, orders, duplicates and lengths as listed in the Test Scope.
3. Texts built in SQL: the withdrawal line name and the generated budget description.
4. Goal-name copies: rename and deletion.

### `4)` Prove the net bites

> A net that cannot go red proves nothing.

1. Break each pinned behaviour once locally, watch the matching case fail, restore.
2. Paste the red outputs in the pull request.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The pull request holds the production collation and the row counts of the largest account |
| 2    | The journey fails when one of its entry points is removed and one of the 13 columns is no longer written |
| 3    | The spec passes in CI with `RUN_INTEGRATION_TESTS=true` on a code base where nothing else changed |
| 4    | One recorded red run per pinned behaviour |
