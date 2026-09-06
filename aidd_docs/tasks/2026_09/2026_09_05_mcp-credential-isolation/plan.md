---
objective: "Assistants can use Pulpe through consented MCP tools without receiving any credential usable against Supabase Auth or the Data API."
status: blocked
---

# Plan: Isolate MCP credentials before public activation

## Overview

| Field      | Value                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Close the confirmed Auth and database bypass while retaining ordinary Pulpe sessions, tenant isolation and useful MCP tools.                                                                      |
| **Source** | User request to verify and prepare a functional ChatGPT/Claude connector; `../../2026_08/2026_08_23_pulpe-mcp-agent-connector/verification-2026-09-05.md` records the isolated HTTP reproduction. |

## Phases

| #   | Phase                                                             | File                       |
| --- | ----------------------------------------------------------------- | -------------------------- |
| 1   | Separate external MCP credentials from internal Supabase sessions | [phase-1.md](./phase-1.md) |
| 2   | Verify real flows and prepare activation                          | [phase-2.md](./phase-2.md) |

## Resources

| Source                                                                        | Verified                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| https://supabase.com/docs/guides/auth/oauth-server/token-security             | OAuth scopes do not restrict database access.                                                     |
| https://supabase.com/docs/guides/api/securing-your-api                        | PostgREST pre-request checks do not cover other products, including Auth.                         |
| https://raw.githubusercontent.com/supabase/auth/v2.195.0/internal/api/user.go | Account metadata mutation does not reject OAuth-origin sessions; confirmed by isolated HTTP test. |
| https://supabase.com/docs/guides/auth/oauth-server/oauth-flows                | Native confidential-client code exchange can remain an internal upstream flow.                    |

## Decisions

| Decision                                                                                                                             | Why                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved by the user: issue opaque MCP-only credentials in the existing backend using the installed MCP SDK's OAuth provider/router. | Keeps the current product and user-owned RLS, without giving assistants a Supabase credential. The SDK proxy provider alone passes upstream tokens through and is insufficient. |
| Supabase OAuth, if retained upstream, is confidential and backend-only; disable its public dynamic registration.                     | A second public issuance route must not bypass the isolated MCP issuer. Never store or reuse the user's ordinary frontend refresh token.                                        |
| No SQL-only fix and no service-role replacement for user-data access.                                                                | SQL cannot guard Auth, and privileged user-data access would discard existing tenant isolation.                                                                                 |

## Execution checkpoint — 2026-09-05

The user approved the architecture change, local secret storage and restarting Docker. Docker was recovered without deleting containers or volumes. Two dedicated local stacks were used; no shared Supabase project or production setting was modified.

Phase 1 passed: the public MCP issuer now returns opaque credentials, and only its backend exchanges confidential Supabase sessions. Verification includes 14 real HTTP lifecycle/boundary scenarios, 117 backend integration tests, the backend suite, 20 SQL suites, generated-type comparison and security advisors. Details are in [phase-1-verification.md](./phase-1-verification.md).

The independent candidate review identified a transient-refresh retry regression, the single-redirect client's optional parameter and legacy-token retirement. The first two are corrected with real HTTP checks. The retirement probe proves the necessary staged cutover: disable native issuance, retire the exact legacy clients, verify both refresh routes fail, then wait for access-token expiry. The SQL migration alone is not sufficient. [cutover.md](./cutover.md) makes this an activation gate.

Local integration credentials were disposable and removed with their fixtures. The dedicated remote test setup now has fresh persistent secrets in the ignored `backend-nest/.mcp-test/.env.local` file (directory mode 700, file mode 600), ready for the user's Dashlane backup. Phase 2 has not been completed, and public availability remains unproven.

Phase 2's server checks now pass: 121 integration/e2e cases include 18 MCP scenarios exercising all 15 tools, complete mode/annotation checks and encrypted amount concordance. They exposed and corrected stale conversion metadata, inaccurate destructive annotations and the shared literal-search filter. The standard CI integration command already discovers these cases; no parallel workflow was added.

The user approved a dedicated free test environment. The `Pulpe Tests` organization (`xffiyhaypapyfjmwjysd`) is on Free, with zero monthly Supabase project cost verified. Its `pulpe-mcp-test` project (`jsjfammxsqyglxlqzpsl`, Zurich) is healthy and has all 102 repository migrations. It started with zero users, sessions, OAuth clients and public tables; no legacy credential retirement is necessary for this fresh target. No production data was copied.

The separate Vercel project `pulpe-mcp-test` serves https://pulpe-mcp-test.vercel.app. Deployment `dpl_DN4BuH7vWg19wGbM6ggtoZq8njSy` is READY; its public consent route returns HTTP 200 without Vercel login. Its configuration targets only the dedicated Supabase project and existing Railway `mcp-spike` API, analytics are disabled, and its CSP and `noindex, nofollow` header were checked over HTTP. No server key was found in the public build. This is a static test deployment of commit `93e34d3fc2fe983fb1e0c9a775191c190ecc1a56`, not an automatically updated production app.

The new Supabase project has email login enabled, public and anonymous signup disabled, OAuth enabled with native dynamic registration disabled (HTTP 403 verified), and one confidential upstream client restricted to the `mcp-spike` callback. The CLI did not propagate OAuth settings; they were applied through the official Management API and checked remotely. The public discovery endpoint now responds, but no synthetic user or real assistant grant has been created.

The Railway handoff was blocked at this checkpoint because automatic security review required explicit approval for the four new server secrets. The user supplied that approval on 2026-09-06; the checkpoint below supersedes this blocker.

## Execution checkpoint — 2026-09-06

The approved secrets and test configuration were applied to service `backend` (`b1f9b1c0-7eca-4c58-b203-cdbbed8ae0a4`), environment `mcp-spike` (`37cb5d64-9aab-446a-9b43-82da1b40352b`), project `33ba829c-d4d6-4096-b0dc-57c89c367063`. Readback matched all 16 intended variables without printing secret values. Deployment `a891edbf-e357-4f6d-bad5-e2cd1239f28a` of `191f35a0559f90002a81c1c2f1a66a575d0ea6e6` reached `SUCCESS`. The service now targets the dedicated test Supabase project; public discovery returns HTTP 200 and advertises the isolated backend issuer. Analytics and full HTTP debugging are disabled, and only official dummy Turnstile keys are used in this test fixture.

One confirmed synthetic account, `mcp-review-20260906@pulpe.test`, was created without sending email. Its password, vault code and recovery key were added to the same ignored owner-only local file for Dashlane. The ordinary encrypted API created one September 2026 budget and four forecasts: income 5,000, rent 1,500, groceries 600 and planned savings 500, leaving 2,400 available to spend. Public signup remains closed.

A real remote HTTP check completed confidential upstream authorization, opaque code/token exchange, discovery of all 15 tools, a budget read, a 4.50 expense verified through ordinary REST, refresh and revocation. The external bearer was refused by Supabase Auth (403) and the Data API (401). After revocation, MCP returned 401 and refresh returned 400; private grant material was cleared. The probe expense was removed, leaving zero movements. This extends the existing complete local tool suite; it does not claim every tool ran through a vendor client.

The user approved replacing the legacy associations and testing both providers against only the synthetic account. Both legacy test connectors were removed and replaced by `Pulpe Tests`; previous Claude chats remain available. Claude completed DCR and the real Pulpe read-only consent, exposed seven read tools and returned the expected September figures after a one-time tool approval. A requested write was unavailable, and a fresh Pulpe dashboard still showed 2,400 CHF and no movements. Its response also exposed two presentation gaps: no explicit currency and a `Dépenses` aggregate that includes planned savings.

Those presentation gaps are corrected without changing formulas: every successful MCP tool response names the current owner's currency through the existing settings port, resolved before tool execution; month summaries now say `Dépenses et épargne` and `Dont épargne prévue`. The regression checks first failed on the old responses, then all 19 isolated HTTP scenarios passed, including all 15 tools, concurrent CHF/EUR owners and no write after settings failure. The focused 20 unit checks, full backend suite (1,629 passing tests), full TypeScript check, targeted lint and normal commit quality gate also passed. Source commit `f778a6a9438c3ed97e9951ad8fb3b6fdd6696c66` reached Railway `SUCCESS` in deployment `8a470275-fb0a-4d9d-a619-c73a4cbe697b`. Fresh Claude web chat `74295730-53f8-460c-bc91-d9952008b555` verified the corrected CHF and savings wording in the actual tool result and model summary, with the existing read-only grant and no data or permission changes.

ChatGPT created app `asdk_app_6a9d07d361c881919fc2050407c38043` with correct DCR/scope/endpoints, but two sign-in attempts stalled before showing Pulpe consent. Read-only browser network observation showed successful link requests and an `about:blank` popup event, without an accessible popup tab. No ChatGPT grant or tool result was observed. Claude's disconnection before read/write testing was rejected by automatic security review for lacking explicit permission for that exact persistent access change. The dialog was cancelled, leaving only its read-only grant active; no workaround was attempted. This new authorization blocker, not the superseded replacement request, pauses phase 2. [Client readiness](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/submission-checklist.md) remains partial; actual vendor write/revocation, public activation and desktop/mobile support are not claimed.

A separate read passed in native Claude Desktop `1.40609.1` on macOS `26.5.1`, in Cowork mode, with the same synthetic account and unchanged read-only grant. The expanded tool result and model summary both showed CHF and the corrected totals. This establishes that macOS Cowork read path only, not desktop Chat, other operating systems or mobile.

The existing ChatGPT app subsequently reached the actual `Connect Pulpe to ChatGPT` consent in Arc `1.162.0`, using the synthetic account. Its temporary blank page resolved normally, unlike the earlier inaccessible in-app-browser popup; this does not establish that failure's root cause. Read-only and the data-sharing disclosure were verified visually. The PIN remains empty and final authorization was not submitted, pending confirmation for the persistent grant. No ChatGPT tool call or completed association is claimed. The earlier Claude access-change blocker remains unchanged.

Native Claude Chat was then verified separately (`1.46388.4`, macOS `26.5.1`, Pro / Opus 5 High), in chat `b6d757f6-ca5a-480b-b506-55ad60d66602`. Five additional read tools and three negative calls received one-time approvals; their expanded responses matched the ordinary Pulpe UI. Across Claude sessions all seven read tools have been invoked, with goal outlook covered only by its missing-ID error rather than a successful existing-goal result. The final refreshed dashboard remained at 2,400 CHF, four forecasts and no movements. No data or permission change was made; the persistent-access confirmations still block the remaining vendor acceptance.

No production configuration, shared preview database or directory submission was changed, and no paid upgrade was selected.
