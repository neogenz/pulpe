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

Only disposable test credentials were generated in memory and removed with their fixtures; there is no durable secret to save in Dashlane yet. Phase 2 has not been completed, and public availability remains unproven.

Phase 2's server checks now pass: 121 integration/e2e cases include 18 MCP scenarios exercising all 15 tools, complete mode/annotation checks and encrypted amount concordance. They exposed and corrected stale conversion metadata, inaccurate destructive annotations and the shared literal-search filter. The standard CI integration command already discovers these cases; no parallel workflow was added.

Real-client acceptance needs a human decision on the non-production Supabase target and authorization to migrate/configure its confidential upstream with the existing Railway `mcp-spike` service. Railway automatically deployed the first commit successfully, but public discovery returns 404; the environment is not yet a verified client fixture. Production and directory submissions remain untouched. This is an activation blocker, not a failed local server test.
