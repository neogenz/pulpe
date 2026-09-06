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

Both ChatGPT Pro and Claude Pro web sessions are accessible. Their existing test connectors retain legacy configuration: ChatGPT exposes two old tools and its Reconnect action redirects to a deleted Vercel deployment; Refresh did not visibly update its catalog. Claude reports no tools and rejects a duplicate connector with the same URL. Neither connector was deleted or granted access to the new fixture. Replacing these associations and granting the two providers access to the synthetic account requires the requested specific confirmation. [Client readiness](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/submission-checklist.md) remains unaccepted; public activation and desktop/mobile support are not claimed.

No production configuration, shared preview database or directory submission was changed, and no paid upgrade was selected.
