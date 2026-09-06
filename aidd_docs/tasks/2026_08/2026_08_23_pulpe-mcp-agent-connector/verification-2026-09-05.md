# MCP readiness verification — 2026-09-05

Status, updated 2026-09-06: **server verified locally and on isolated remote infrastructure; real assistant acceptance and public activation pending**.
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

## Remote environment and client readiness — updated 2026-09-06

The earlier discovery 404 is resolved. The explicitly approved Railway test
configuration was applied and all 16 intended variables matched readback.
Deployment `a891edbf-e357-4f6d-bad5-e2cd1239f28a` of `191f35a05` reached `SUCCESS`.
The public issuer is `https://backend-mcp-spike.up.railway.app/`, with resource
`https://backend-mcp-spike.up.railway.app/mcp`; both discovery documents return 200.

The dedicated Free Supabase project `jsjfammxsqyglxlqzpsl` has all 102 migrations,
closed signup and a confidential upstream client with native dynamic registration
disabled. The separate test app is https://pulpe-mcp-test.vercel.app. One synthetic
account owns one September budget and four encrypted forecasts. The local backup
of durable server secrets and synthetic login/recovery credentials is stored in
the ignored owner-only `backend-nest/.mcp-test/.env.local`, for Dashlane.

The remote HTTP probe passed actual authorization/code exchange, a 15-tool
catalog, `get_month`, `add_movement`, ordinary REST amount concordance (4.50),
refresh and revocation. Supabase Auth refused the opaque bearer with 403; the
Data API refused it with 401. Revocation cleared private grant material and
subsequent MCP/refresh requests failed with 401/400. The probe expense was removed;
one user, one budget, four forecasts and zero movements remain for client testing.
All 15 tools were executed in the existing local integration suite, not in this
smaller remote probe or a vendor client. Temporary runner: `/tmp/pulpe-mcp-remote-proof.ts`.

The browser check exposed one missing fixture-preparation step: the UI-routing
metadata `vaultCodeConfigured` had not been set after API vault initialization.
The runner's `finish-fixture` mode first verified server vault status, the existing
PIN and recovery key, then completed the ordinary owner metadata update. No key
was regenerated. A fresh browser login now asks for the existing PIN and opens
the dashboard, which shows 2,400 CHF available, 5,000 CHF income, all four expected
forecasts and no movements, matching the HTTP results.

A consent request for the existing local verification client rendered the actual
deployed page: client identity, read/read-write choices, transmitted data fields,
provider processing, protected-key persistence and revocation limits were visible.
Read-only selection worked. Cancel returned `error=access_denied` with the original
state, and Settings → Connections showed no assistant connected. No provider
grant was created. Railway also confirmed the documentation-only `8f9d4686c`
deployment `0da76834-148b-4595-a06c-6a4c974b0950` reached `SUCCESS`.

### Actual vendor session — 2026-09-06

The user approved replacing the legacy associations and testing access to only
the synthetic account. `Pulpe spike` in ChatGPT and `Pulpe (spike)` in Claude
were removed and replaced by `Pulpe Tests`; previous Claude chats remain available.
Railway deployment `7d5748d5-32ec-4e24-ad50-9c063209b4e6` of documentation commit
`825cf9f29` was observed at `SUCCESS` before these sessions.

Claude Pro web (Opus 5 High), through the Codex in-app browser, completed DCR
and the actual Pulpe consent headed `Connect Pulpe to Claude`. Read-only was
selected and the existing PIN entered only on Pulpe. The catalog contained
seven read tools, each retaining the default `Needs approval` setting. In chat
`aa240d32-b044-4af6-996b-bcfad86a707a`, the first call expired with
`No approval received`; retrying and selecting `Allow once` succeeded.
`get_current_month` returned September 2026, income 5,000, the four expected
forecasts and 2,400 available. No expected figures had been supplied in the prompt.

A request to add `Test lecture seule MCP` for 4.50 found no write tool and was
not executed. A freshly reloaded Pulpe dashboard still showed 2,400 CHF and
no movements. The model mentioned an unrelated Supabase connector; it did not
call it, and that speculation is not evidence of shared data or permissions.
Only Pulpe Tests was requested and exercised.

The response identified two unresolved usability issues: the read report omits
the explicit account currency, and its `Dépenses 2600` label includes the 500
planned savings although expense lines total 2,100. The model hedged the currency
and questioned the aggregate. The figures match the shared calculator, but this
does not establish that their wording is sufficiently clear for ordinary users.

ChatGPT Pro web created app `asdk_app_6a9d07d361c881919fc2050407c38043` with DCR,
scope `mcp` and the correct isolated authorization/token/registration/resource
URLs. Two `Sign in with Pulpe Tests` attempts stalled before Pulpe consent.
Bounded browser network observation recorded HTTP 200 for its sign-in and OAuth
link requests and a `Page.windowOpen` event for `about:blank`; no new accessible
tab appeared. Console warnings/errors were empty. This narrows the observed
failure to the browser/vendor handoff but does not establish its root cause.
The stalled dialog was closed; the new app remains unconnected with no actions.
No ChatGPT grant, read or write is claimed.

Before Claude read/write testing, automatic security review rejected confirming
`Disconnect Pulpe Tests?`, citing missing explicit authority for that exact
persistent access change despite the earlier general confirmation. The dialog
was cancelled and no alternate revocation path was attempted. Its synthetic
read-only grant remains active. Vendor write/revocation and desktop/mobile
acceptance remain incomplete; this is a new blocker, not pending permission
to perform replacements that have already happened.

No production configuration, shared preview database migration, paid upgrade or
directory submission was performed. Exact resource and fixture evidence is in
the [plan checkpoint](../../2026_09/2026_09_05_mcp-credential-isolation/plan.md#execution-checkpoint--2026-09-06).

### Response clarity correction — 2026-09-06

The two presentation findings above are now corrected in source. The existing
MCP response boundary reads the current authenticated owner's currency through
`USER_REPOSITORY` and prefixes every successful tool result with it. Settings
are resolved before execution so their failure cannot mask a completed write.
This covers all 15 tools without changing their authorization or adding a new
service. Monthly and multi-month totals now use `Dépenses et épargne` and
`Dont épargne prévue`; formulas, amounts and native clients are unchanged.

The updated unit check failed on the old aggregate label, and the HTTP suite
failed on missing currency before the correction. Afterwards, all 19 isolated
MCP HTTP scenarios passed (451 assertions), including all 15 tool responses,
concurrent CHF/EUR owners and a name-only edit refused before mutation when
settings fail. Focused MCP units: 20 passed; TypeScript and targeted ESLint passed.
The full backend suite passed 1,629 tests with zero failures; its 19 skipped
dedicated MCP cases ran separately above. The first sandboxed full run could
not open Supertest sockets; the verified run used the same isolated local target
with network permissions. Log: `/tmp/pulpe-mcp-currency-backend-verified-20260906.log`.
Logs: `/tmp/pulpe-mcp-currency-red-20260906.log` and
`/tmp/pulpe-mcp-currency-green-verified-20260906.log`.
An intermediate test-double failure was fixed by creating the rejected promise
only when called, avoiding Bun's eager unhandled rejection; this was not a
production error. The normal pre-commit quality gate passed in 93.05 seconds.

Source commit `f778a6a9438c3ed97e9951ad8fb3b6fdd6696c66` was pushed and Railway
deployment `8a470275-fb0a-4d9d-a619-c73a4cbe697b` reached `SUCCESS`. A fresh Claude
Pro web chat, `74295730-53f8-460c-bc91-d9952008b555`, used the existing read-only
grant and `Allow once`; its prompt supplied no expected amounts or currency.
The expanded `get_current_month` result explicitly contained `Devise des montants : CHF.`,
`Dépenses et épargne 2600` and `Dont épargne prévue 500`. Claude summarized
September 2026 in CHF, income 5,000, outflow 2,600 including planned savings 500,
and 2,400 available, without the earlier currency or aggregate uncertainty.
The response still showed the four forecasts and zero movements. This verifies
the corrected wording through the deployed client; it does not complete vendor
write/revocation or desktop/mobile acceptance. No access rights were changed.

An additional native-app read passed in Claude Desktop `1.40609.1` on macOS
`26.5.1`, Pro / Opus 5 High, in its default Cowork mode. Session
`cse_01Q4KmXaUXfNdmkEmWKqCfWg` received the same read-only prompt without expected
figures. The expanded tool result visibly contained the CHF header, September
budget ID and corrected totals; the model returned 2,400 CHF available with the
expected breakdown. Cowork's existing `Automatically approve` setting ran this
read without a new approval dialog; no setting, grant or data was changed.
This is evidence for a macOS Cowork read, not for desktop Chat mode, writes,
revocation, other operating systems or mobile.

Current vendor requirements and an acceptance script are in
[submission-checklist.md](./submission-checklist.md). The landing retains its
"in preparation" status and the concise four-language data-sharing disclosure.
