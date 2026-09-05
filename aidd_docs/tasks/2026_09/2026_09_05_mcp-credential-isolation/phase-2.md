---
status: blocked
---

# Instruction: Verify useful client flows and prepare activation

## Execution checkpoint — 2026-09-05

Server verification passed: all 15 tools execute through real HTTP and encrypted owner data, within 18 MCP scenarios and 121 passing backend integration/e2e tests. Account-currency edits, destructive annotations and literal search were corrected. Existing CI already runs this test file. Client requirements, evaluation prompts and current evidence are recorded in the linked readiness documents.

The dedicated `pulpe-mcp-test` Supabase project in `Pulpe Tests` is healthy on Free with 102 migrations, closed public signup and a configured confidential OAuth upstream. The separate Vercel test site is READY and publicly accessible with verified test-only configuration, disabled analytics and a no-index header. The [plan checkpoint](./plan.md#execution-checkpoint--2026-09-05) records exact resources and local secret storage.

Blocked: automatic security review requires explicit approval to send the newly generated service-role, encryption, wrapping and OAuth secrets to the existing Railway `mcp-spike` backend. That mutation was rejected, so Railway configuration is unchanged. No synthetic account or real ChatGPT/Claude association has been created. No claim of real-client or universal mobile support is made.

## Architecture projection

```txt
backend-nest/src/modules/mcp/                              ✏️ focused HTTP integration checks using existing test conventions
.github/workflows/ci.yml                                 ✏️ run the isolated credential boundary check
aidd_docs/tasks/2026_08/2026_08_23_pulpe-mcp-agent-connector/
  verification-2026-09-05.md                             ✏️ replace unresolved claims with current evidence
  submission-checklist.md                               ✏️ current directory requirements and activation prerequisites
landing/content/dictionaries/                           ✏️ only claims proven by actual client support
```

## Test Scope

```mermaid
journey
  section Setup
    Configure isolated non-production deployment and synthetic account => review fixture ready: 5: system
  section Happy path
    Connect ChatGPT and Claude => consent identifies the provider and data sharing: 5: browser
    Ask a budget question and record an expense => figures match Pulpe and write is visible: 5: browser
    Revoke in Pulpe => subsequent assistant request fails: 5: browser
  section Edge case - Unsupported client surface
    Client plan or mobile app lacks custom MCP => guide states the limitation without claiming support: 1: browser
  section Teardown
    Revoke review grants and remove synthetic data => fixture cleaned up: 5: system
```

## Tasks to do

### `1)` Verify the complete connector

1. Run all 15 tools against synthetic encrypted data and compare budgets, movements and savings metrics with Pulpe, including missing-input behavior and destructive-action annotations.
2. Verify consent, login return, refresh, reconnection, wrong PIN, read-only mode, revocation and key rotation over HTTP. Exercise direct Auth, tables, invoker/definer RPCs and GraphQL with the external bearer.
3. Run backend checks, SQL contracts, generated-type comparison, Angular production build, targeted web tests and native connection-management tests. Preserve frontend/landing disclosure and four-language rendering checks.

### `2)` Validate clients and prepare the release handoff

1. Use non-production credentials and synthetic data for real ChatGPT and Claude OAuth/tool round trips. Record client, account plan, surface and observable result, not just discovery responses.
2. Verify each requested web/desktop/mobile surface against actual availability. Prepare directory submission requirements where custom connectors cannot satisfy that surface; never promise a vendor capability not available.
3. Prepare exact issuer URLs, secrets names, migrations and activation order. Production changes, directory agreements and account-sensitive submissions require explicit human authorization; keep the public landing in preparation until readiness is proven.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Financial outputs match Pulpe, authorized writes persist encrypted, and every forbidden direct or MCP access leaves data unchanged.                     |
| 1    | Existing web/native users keep their connection-management and ordinary authentication behavior.                                                        |
| 2    | Each supported client completes association, useful read/write and revocation; unsupported surfaces and submission prerequisites are stated accurately. |
| 2    | Activation can follow verified configuration and migration evidence without exposing unrestricted Supabase credentials.                                 |
