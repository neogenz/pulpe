# MCP readiness verification — 2026-09-05

Status: **server verified locally; public activation and real assistant acceptance blocked**.
This supersedes earlier readiness claims, not the historical implementation record.

## Verified implementation

The branch was rebased onto `origin/main` at `bb7e0e767` and remains attached to
its named branch. `codex/mcp-before-rebase-20260905` preserves the previous tip.
Credential isolation is committed as `fd28879e3`; its normal pre-commit hook passed.

The external issuer now returns opaque MCP-only credentials. Confidential
Supabase sessions and encrypted vault keys remain backend-only. Ordinary user
sessions, owner RLS and the existing encrypted financial repositories are retained.
[Phase 1 evidence](../../2026_09/2026_09_05_mcp-credential-isolation/phase-1-verification.md)
records the real OAuth, SQL, generated-schema and legacy-retirement checks.

## Complete tool-to-database coverage

`mcp-oauth.integration.spec.ts` boots the real application, SDK OAuth middleware
and Supabase. Two disposable owners and native/external OAuth clients are removed
afterwards. All 15 tools execute through HTTP with encrypted financial data:

| Tools                                                | Observed contract                                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_current_month`, `get_month`, `list_months`      | Same income, expenses, savings, rollover and remaining amount as Pulpe's budget snapshot/calculators; no other owner's data.                                         |
| `list_templates`, `create_month_from_template`       | Owner template found; requested future month created; missing template asks instead of creating.                                                                     |
| `add_movement`, `update_movement`, `delete_movement` | Encrypted expense written, amount changed and read through ordinary REST, then actually removed. Missing savings allocation asks without mutation.                   |
| `add_forecast`, `update_forecast`                    | Forecast written and updated; missing recurrence asks without mutation.                                                                                              |
| `spread_expense`                                     | Two periods receive the original total; the source is removed.                                                                                                       |
| `toggle_check`                                       | Both forecast and movement paths exercised; two toggles restore the original state.                                                                                  |
| `list_savings_goals`, `get_savings_goal_outlook`     | Target, confirmed amount, planned contribution, projection and pace match ordinary Pulpe output.                                                                     |
| `search_movements`                                   | Real movements, forecasts and tag-name matches agree with ordinary REST; punctuation, quotes, backslashes, wildcard characters, case and year filtering are checked. |

The exact catalog contains seven read tools and eight write tools. All eight
write tools are refused in read-only mode. Destructive and idempotency annotations
are asserted for the complete catalog; annotations remain hints, not authorization
or a guarantee of the assistant's confirmation UI.

The expanded checks reproduced and corrected three discrepancies:

- Four non-additive tools incorrectly used `destructiveHint: false`: updates,
  spreading and toggling now advertise their effect accurately.
- An account-currency amount edit retained old EUR/CHF metadata. The existing
  target-currency-only clearing path now handles both movements and forecasts;
  name-only edits preserve the conversion.
- Search still wrapped patterns for an obsolete PostgREST `.or()` path, while
  the repository used standalone filters. This failed both REST and MCP.
  PostgreSQL's literal-pattern mode with PostgREST `imatch` now handles every
  existing name/tag path without interpreting user input as regex or wildcards.
  See [PostgreSQL literal mode](https://www.postgresql.org/docs/current/functions-matching.html#POSIX-METASYNTAX)
  and [PostgREST operators](https://docs.postgrest.org/en/stable/references/api/tables_views.html#operators).

## Checks and limits of evidence

- Dedicated backend integration/e2e: **121 passed, zero failed**, including
  **18 real MCP scenarios**. The standard CI integration command already selects
  this file; no additional workflow is needed.
- Full backend suite: **1,629 passed, zero failed**. Its 18 skipped dedicated MCP
  scenarios ran separately above. Four former pattern unit cases were consolidated
  into a table-driven literal-input check, explaining the lower unit count.
- `type-check:full` and `pnpm quality`: passed.
- Phase 1: all **20 SQL suites** passed, a fresh migration replay matched generated
  types exactly, and local advisors reported no findings.
- Web verification earlier on this branch: Angular production build passed;
  MCP/connections/legal/auth selection 35 passed, updated disclosure selection
  nine passed. After updating the ChatGPT instructions in all four languages,
  the landing again passed all 138 tests and its production build.
- Eight native connection-management tests passed earlier on the dedicated
  simulator. They cover Pulpe's service/store contracts, **not** Claude/ChatGPT
  mobile support. No financial formula or native source changed in this follow-on.
- There is no GitHub `CI Success` proof for the current work. The workflow is
  pull-request-only and no pull request has been created.
- No real ChatGPT/Claude association → read → write → revoke session has yet been
  verified against the isolated issuer. Local protocol success does not prove it.

Local logs for the latest backend runs:
`/tmp/pulpe-mcp-phase2-all-integration-20260905.log`,
`/tmp/pulpe-mcp-phase2-backend-20260905.log`,
`/tmp/pulpe-mcp-phase2-types-20260905.log`,
`/tmp/pulpe-mcp-phase2-quality-20260905.log`.

## Legacy credential retirement is still an activation gate

The original native OAuth bearer could mutate owner data and Auth metadata
directly, even without an MCP grant or after revocation. The historical
[HTTP probe](./oauth-isolation-probe.ts) records that reproduction.

The new opaque bearer fails direct Auth, tables, invoker/definer RPCs and GraphQL.
However, SQL migration alone cannot retire native JWTs already issued by an older
deployment. Follow the verified [cutover procedure](../../2026_09/2026_09_05_mcp-credential-isolation/cutover.md):
stop old issuance, retire exactly the legacy clients, verify both refresh routes
fail, wait out the previous access-token lifetime, then verify old bearers fail
while ordinary Pulpe sessions still work.

## Remote environment and client readiness

Railway automatically deployed `fd28879e3` to `pulpe-backend / mcp-spike / backend`
(deployment `4ddae5ed-92ff-4548-9401-eb4682219091`, observed `SUCCESS`).
The public protected-resource metadata returned **404** afterwards. The remote
environment is not a usable acceptance fixture yet. Variable-value reads were
unavailable through the connector, so missing values are not asserted as fact.

No production configuration, shared database migration or directory submission
was performed. Durable secrets have not been generated; disposable credentials
stayed in test-process memory. Selecting and authorizing the non-production
Supabase target, migrations and confidential upstream configuration is the next
human decision before real-client acceptance.

Current vendor requirements and an acceptance script are in
[submission-checklist.md](./submission-checklist.md). The landing retains its
"in preparation" status and the concise four-language data-sharing disclosure.
