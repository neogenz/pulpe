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

Blocked at the Railway handoff: automatic security review rejected sending the new Supabase service-role key, encryption master key, MCP wrapping key and confidential OAuth secret to service `backend` (`b1f9b1c0-7eca-4c58-b203-cdbbed8ae0a4`) in environment `mcp-spike` (`37cb5d64-9aab-446a-9b43-82da1b40352b`), project `33ba829c-d4d6-4096-b0dc-57c89c367063`. It requires explicit approval naming these secrets and this destination. No retry through another channel was attempted. Railway still points to shared preview; its latest successful deployment remains `eb218ea9-a4e1-4f4f-9713-c233aa9176d0`. The new test website is therefore not yet a usable end-to-end fixture. Production, shared preview and directory submissions remain untouched; no paid option was selected.
