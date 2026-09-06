# MCP readiness verification — 2026-09-05

Status, updated 2026-09-06: **isolated server and vendor web read/write/revocation verified; deployed presentation regression passed; dependency remediation validated locally, not yet pushed or deployed; protected production release pending**.
This supersedes earlier readiness claims, not the historical implementation record.

## Verified implementation

Latest rebase (2026-09-06): `origin/main` is `d134937e4`, including 17 new commits
since the previous base. All 45 feature commits replayed without conflicts;
`git range-diff` reports every patch unchanged. The backend, shared package and
CI files are byte-identical to the pre-rebase candidate, so the recorded server
proofs retain that scope. `codex/mcp-before-rebase-20260906` preserves the old tip.
The presentation commit is now `93f385521` and its evidence commit `b3127f5b0`;
the original SHAs below identify what actually ran on the test deployment.

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
- The original server-only checkpoint is superseded by the vendor and deployed
  regression evidence below; both vendors passed association → read → write → revoke.

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

### ChatGPT consent handoff in Arc — 2026-09-06

The existing ChatGPT app was opened in a new Arc `1.162.0` tab through native UI,
after the browser-extension tab inventory timed out. It was not recreated.
The ordinary `Connection Connect` → `Sign in with Pulpe Tests` flow opened an
`about:blank` page that subsequently reached the dedicated Pulpe login, unlike
the inaccessible in-app-browser popup observed earlier. This identifies a usable
alternative browser path, not the root cause of the earlier handoff failure.

Login used only the existing synthetic account. The actual consent page was
headed `Connect Pulpe to ChatGPT` and described the shared budget fields, provider
processing, persistent protected key and revocation limits. Read-only was selected
and visually verified. The PIN field remained empty and `Authorise` was not
clicked: no ChatGPT grant or tool result is claimed. Completing this persistent
access grant awaits confirmation at the action; the separate Claude disconnect/
read-write/revocation authorization also remains outstanding. No browser approval
policy or backend configuration was changed.

The public OAuth and protected-resource documents were rechecked and returned
the isolated issuer/resource, DCR endpoint, `S256`, `mcp` scope and supported token
authentication methods. The [OpenAI troubleshooting guide](https://developers.openai.com/plugins/deploy/troubleshooting)
and [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)
were consulted to keep client handoff evidence separate from server verification.

### Claude macOS Chat read coverage — 2026-09-06

The native application's Chat mode was explicitly selected and verified before
starting chat `b6d757f6-ca5a-480b-b506-55ad60d66602`. The installed app reported
`1.46388.4` for this run, on macOS `26.5.1`, Pro / Opus 5 High. This is separate
from the earlier Cowork run and its recorded app version. The existing synthetic
read-only grant was reused; every call received `Allow once`, never `Always allow`.

Five additional successful tool results were expanded and inspected:
`list_months` returned only September 2026 and the expected totals; `get_month`
received `{month: 9, year: 2026}` and returned the matching budget and forecasts;
`list_templates` returned the default `Budget fictif MCP`; `search_movements`
received `courses` / `[2026]` and returned the single 600 CHF forecast; and
`list_savings_goals` returned an empty list. Each result carried the CHF header.
The model's summary matched these responses. Pulpe's ordinary UI independently
showed one September budget, the same template and no savings goals.

Three negative calls also received individual one-time approvals. `get_month`
for October 2026 returned `Aucun budget pour 10/2026`. `search_movements` received
the exact `%_,` query / `[2026]` and returned no result; this client check alone
does not prove general SQL wildcard escaping. `get_savings_goal_outlook` received
the synthetic absent UUID `00000000-0000-4000-8000-000000000001` and returned a
specific not-found error. Claude reported the empty results and error rather
than inventing data; no fallback connector or write was used.

Across the Claude sessions, all seven read tools have now been invoked: six
returned successful data/empty responses, while goal outlook was exercised only
on a missing goal. Its existing-goal success remains covered by the isolated
HTTP suite, not yet a vendor session. The final refreshed Pulpe dashboard still
showed 2,400 CHF, the four forecasts and no movements. No data, grant or approval
policy was changed. Vendor writes/revocation, ChatGPT authorization and mobile
acceptance remain incomplete and are not established by these additional reads.

Current vendor requirements and an acceptance script are in
[submission-checklist.md](./submission-checklist.md). The landing retains its
"in preparation" status and the concise four-language data-sharing disclosure.

### Existing-goal client acceptance — 2026-09-06

The remaining positive read case passed in the same native Claude Chat session
`b6d757f6-ca5a-480b-b506-55ad60d66602`, using the unchanged read-only grant.
Through the ordinary Pulpe test UI, the synthetic fixture was extended with
`Objectif fictif validation MCP` (`29e1943c-9488-493d-b13a-4b3de8ca1550`): target
1,000 CHF, starting amount 200 CHF, no deadline or attached planned item.
This is test data, not a transfer or a production write.

The prompt supplied only the goal name, not its ID or expected figures.
`list_savings_goals` and `get_savings_goal_outlook` each received `Allow once`.
Their expanded responses showed the correct ID and CHF currency, target 1,000,
confirmed 200, planned cumulative 0, projection 200 and progress 20%. Both paces
were zero and remaining months were not projectable. The model reported those
values and explicitly identified requested fields absent from the tool response.
No other connector or write tool was used. Reloading the ordinary goal page
confirmed the same saved/target/planned totals and 20% progress.
The refreshed dashboard still showed 2,400 CHF available, four forecasts and
no movements; adding the standalone goal did not change that budget.

All seven read tools now have a successful vendor result across the Claude
sessions, including a populated goal outlook. The synthetic goal is retained
for the remaining client acceptance; no assistant permissions were changed.
ChatGPT final consent and vendor write/revocation tests still await the exact
access-change confirmation. The local Claude Code CLI reports version `2.1.261`
and `loggedIn: false` / `authMethod: none`; its OAuth/tool acceptance has not run.
Actual mobile acceptance remains unverified. No production action was taken.

### Vendor read/write and revocation acceptance — 2026-09-06

The user explicitly authorized browser association, synthetic writes and
revocation on the test origins for `mcp-review-20260906@pulpe.test` only.
This supersedes the earlier access-change blocker. No production operation,
paid upgrade, public submission or provider approval-policy change occurred.

ChatGPT Pro web used the existing `Pulpe Tests` app and completed read/write
consent through Arc. In [the validation conversation](https://chatgpt.com/c/6a9d84c6-8608-83eb-a7bd-3b534d0c0ff1)
(`Validation lecture seule`, reasoning UI `Extra High`; exact model unverified),
`get_month`, `list_templates`, `list_savings_goals` and populated
`get_savings_goal_outlook` returned the expected CHF figures. The chat title and
initial no-write prompt do not establish a read-only grant or seven-tool catalog.
Settings briefly showed no actions even after refresh; actual chat calls worked.

After one-time approval, `add_movement` created only
`c839d5cd-cc33-40e5-995c-ff2b6d25b5bf`, `Courses fictives ChatGPT QA 20260906`,
25 CHF, unchecked, with `2026-09-06T00:00:00+02:00`. Re-reading and exact-name
search found one result; reloaded Pulpe showed 2,375 CHF and 6 September.
The expanded MCP month report instead displayed 5 September, exposing the
timestamp truncation defect below. One-time approved `delete_movement` removed
that exact ID and a fresh read restored 2,400 CHF, four forecasts and no movements.
Revoking ChatGPT in Pulpe removed its card. A subsequent fresh
`get_current_month` request displayed `Reconnect Pulpe Tests` and said the
connection had expired. `Not now` was selected; no grant was recreated.

Claude's previous read-only association was disconnected in Claude and explicitly
revoked in Pulpe; vendor disconnect alone had left its Pulpe card active.
New read/write consent exposed seven read tools and eight writes, each configured
as `Needs approval`. [The web validation conversation](https://claude.ai/chat/f1d9b6ea-6867-4187-8fbd-079a901551b8)
(`Validation du compte fictif Pulpe Tests`, Pro / Opus 5 High) exercised all eight
writes. Every executed call used one-time approval, not `Always allow`.

| Tool                         | Observed result                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_movement`               | Created `c3d8c3ff-c88f-43c1-83fa-9b2e3c188df5`, `Courses fictives Claude QA 20260906`, 25 CHF, 6 September at noon +02:00; Pulpe showed 2,375 CHF and one unchecked movement.                                                                                                                                                 |
| `update_movement`            | Renamed that ID to `Courses fictives Claude QA modifiées 20260906`, changed amount to 30 CHF.                                                                                                                                                                                                                                 |
| `toggle_check`               | Pointed that same movement; fresh MCP/Pulpe showed 2,370 CHF available and 30 CHF checked.                                                                                                                                                                                                                                    |
| `create_month_from_template` | Created October `33590318-1488-496c-a5e3-c51fb1990778` from the verified default synthetic template after October/November absence checks.                                                                                                                                                                                    |
| `add_forecast`               | Created October one-off expense `a4d51734-1416-49e4-a465-ba7c33d4634a`, `Assurance fictive Claude QA 20260906`, 120 CHF.                                                                                                                                                                                                      |
| `update_forecast`            | Changed that exact forecast to 100 CHF; independently reloaded Pulpe showed it.                                                                                                                                                                                                                                               |
| `spread_expense`             | Replaced it with October `8345bd8e-40c7-48e0-a786-48b5c683ca5e` and November `52afbe8f-ee59-4930-af86-0e125868ac2b`, 50 CHF each; authorized November budget creation produced `5ee28dbb-8632-494d-8b64-82bce99356e4`. Fresh MCP and Pulpe showed both tranches and 4,720/7,070 CHF available, including sequential rollover. |
| `delete_movement`            | Deleted only the 30 CHF movement; re-reading September restored 2,400 CHF, four forecasts and no movements. The first approval expired (`No approval received`, no deletion); an explicitly requested new attempt succeeded after approval.                                                                                   |

The two new months were then permanently removed through the ordinary encrypted
test API with the synthetic user's session, not service-role database access.
Before deletion, both exact IDs, owner, year/month, template, zero movements,
five forecasts and named 50 CHF tranche were checked. Readback found only the
original September budget with zero movements and four forecasts. The template
and standalone savings goal were not modified or removed.

Claude was revoked in Pulpe before a fresh one-time approved `get_current_month`
call. The actual client tool panel showed request `{}` and
`Authentication required to use this tool`, with `Connect`; no reconnect was
performed. Pulpe showed `No assistant connected`. Neither vendor returned fresh
financial data after revocation. Earlier conversation data remains with vendors;
revocation does not erase it.

Two minimal presentation fixes now live in `month-report.ts`, shared by both
month read tools: retain the complete movement timestamp, and explicitly label
unchecked forecasts/movements `À pointer`. No amount formula, schema or grant
logic changed. Regression checks failed before their fixes, then passed. The
complete backend run passed **1,630 tests, 19 gated skips, zero failures**
(4,152 assertions). The normal suite skips the separate isolated MCP HTTP file;
its prior 19-scenario result is not a new run. Sandboxed full runs failed when
Supertest could not obtain a listening port; the full port-authorized run passed.
`pnpm quality` then passed sequentially, including zero backend lint errors.

A first normal commit attempt stopped at its quality hook: a concurrently
running architecture test removed its temporary source fixture while Prettier
read it. No hook bypass was used. The sequential quality run and subsequent
normal commit hook passed; the checkpoint below records the deployed result.

### Deployed regression and release checkpoint — 2026-09-06

Source `6a476844302a1eeecbc5dc73e61891c600d85ac3` was committed and pushed with
normal hooks (`fix(mcp): clarify movement dates and unchecked state`). Railway
deployment `8215bf82-0162-4ffa-9bfa-b5a996c3fc53`, created at 16:09:07 UTC,
reached `SUCCESS` in the isolated `mcp-spike` environment. Focused regression
checks passed **3 tests / 11 assertions**. A fresh isolated HTTP run on this
source passed **19 scenarios / 451 assertions, zero failures** in 46.43 seconds;
its disposable account/client fixtures were removed. This is new evidence,
not the earlier skipped-file result.

Claude Pro web / Opus 5 High completed a fresh read/write association after the
synthetic account was verified in Pulpe's user menu. In [the regression chat](https://claude.ai/chat/28336f36-c886-4d41-9d86-629cb648a796),
each tool call received one-time approval; the first read approval expired
without executing, then an explicitly requested retry succeeded. No approval
policy was relaxed. The add request named the existing September budget, 1 CHF
expense `Minuit QA 20260906`, `2026-09-06T00:00:00+02:00`, no forecast ID.

- Created movement: `53f786d7-c058-44d1-b0ab-527802e6b654`.
- Expanded MCP re-read: full `2026-09-05T22:00:00+00:00`, `À pointer` for the
  movement and all four forecasts, available 2,399 CHF.
- Claude correctly converted that instant to 6 September, 00:00 Europe/Zurich.
  Independent Pulpe UI showed `06.09.2026`, 1 CHF outside planned items,
  unchecked, with the same 2,399 CHF available.
- One-time approved deletion targeted only the created ID. Fresh expanded MCP
  read and reloaded Pulpe restored 2,400 CHF, four unchanged forecasts and zero
  movements. This deletion is permanent; the remaining base fixture is intact.
- Pulpe revoked the new grant. A fresh approved `get_current_month` request `{}`
  displayed `Authentication required to use this tool` and `Connect`, with no
  financial result. No reconnection was performed. Pulpe showed
  `No assistant connected`; ChatGPT's earlier revocation remained unchanged.

The model also suggested returning the user's timezone instead of UTC. That is
not a reproduced defect: the complete offset-bearing timestamp preserves the
instant and both observed consumers rendered the expected local day. No extra
timezone setting or reporting abstraction was added.

The owner waived mobile acceptance on 2026-09-06. Mobile remains **not tested**,
not universally supported by inference. Claude Code, ChatGPT's read-only grant
and desktop writes remain unverified. Existing native Pulpe connection tests
are distinct from provider mobile acceptance.

The owner authorizes test-resource retirement after validation, a PR to `main`,
monitoring/merge when safe, and production setup through the existing protected
release flow. No PR or production change has been made at this checkpoint.
Test infrastructure is retained until the remaining security gate is resolved.

#### Dependency gate

Baseline `fe15796a7fdb75c8f4cdb638af193665cb8aabfb` had **45 advisory entries:
19 high, 23 moderate, 3 low, zero critical** in `pnpm audit --prod --json`.
These are dependency findings, not proof of 45 exploitable production paths.

The local remediation updates Nest within version 11 (`11.2.3`), Config within
version 4 (`4.0.4`), Swagger within version 11 (`11.4.7`), `class-validator`
within `0.14` (`0.14.4`) and `express-rate-limit` within version 8 (`8.7.0`).
The MCP SDK stays pinned to `1.30.0`; Supabase and Android manifests are unchanged.
Nine version-scoped [native pnpm overrides](https://pnpm.io/10.x/settings#overrides)
set patched floors for remaining vulnerable transitive ranges: Hono's Node
adapter, `body-parser`, `fast-uri`, both used `fflate` branches, `ip-address`,
`lodash-es`, `qs` and `ws`. There is no custom resolver or application workaround.
Unrelated Metro/Terser resolution changes were removed before the frozen install.

The fresh audit reports **zero high/critical findings and no backend/web paths**.
Its remaining **4 moderate and 1 low** entries are exclusively Android paths:
`uuid@7.0.3`, `decode-uri-component@0.2.2`, `@xmldom/xmldom@0.9.11` and `0.8.14`,
and `diff@4.0.2`. No advisory is ignored or suppressed. The monorepo audit still
exits 1 at its default threshold; it is not globally vulnerability-free.

Checks on the installed local dependency candidate, 2026-09-06:

- `CI=true pnpm install --frozen-lockfile`: passed with pnpm `10.12.1`;
  normal lifecycle scripts and hooks remained enabled.
- Backend `bun test`: **1,630 passed, 19 gated skips, zero failures**;
  4,152 assertions, 86.69 seconds.
- Dedicated `.integration.spec` / `.e2e.spec` run with
  `RUN_INTEGRATION_TESTS=true`, explicitly pinned to the disposable local
  Supabase at `127.0.0.1:56421`: **122 passed, zero failures**, 1,055 assertions,
  94.07 seconds. This includes the 19 real MCP HTTP scenarios, not their skips.
  Disposable account/client cleanup assertions passed.
- Frontend `pnpm test`: **3,086 passed across 225 files**, zero failures.
- Backend build, optimized Angular build and inline-script CSP check passed;
  Angular initial output was **1.15 MB raw / 252.69 kB estimated transfer**.
- Root `pnpm quality`: passed, including architecture, types, lint, formatting
  and automation/security/public-surface/lexicon contracts.

Existing JSDOM navigation and Node deprecation warnings remain. The build's
`eval` warning corresponds to the unchanged Lottie player; neither production
CSP policy permits `unsafe-eval`, and no policy was relaxed for this patch.
This dependency candidate is local only. The vendor sessions above tested the
previous deployed dependency graph; they are not evidence of a remote deployment
of this remediation. Test-resource retirement, PR submission and the protected
production release have not occurred at this checkpoint.
