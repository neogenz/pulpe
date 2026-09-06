# Credential isolation — phase 1 verification

Date: 2026-09-05. Scope: the backend credential boundary, not production activation or vendor-client availability.

## Result

The assistant receives only a random opaque Pulpe credential. The same credential is rejected by Supabase Auth, PostgREST, an invoker RPC, a definer RPC and GraphQL. An allowed MCP write uses the owner's private session and existing encrypted repository; ordinary Pulpe requests read the original amount back. Cross-owner writes and read-only mutations leave data unchanged.

The existing production/public-client deployment has **not** been changed or certified. Legacy native credentials need the [cutover retirement gate](./cutover.md), independently of the new issuer. Actual ChatGPT/Claude round trips remain phase 2 work.

## Checks

| Check                             | Command / executable                                                                                                                                | Observed result                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confidential upstream session     | `pnpm exec bun ../aidd_docs/tasks/2026_09/2026_09_05_mcp-credential-isolation/upstream-session-probe.ts <audit-workdir>` from backend               | Passed: native public registration HTTP 403; confidential secret required; first and cached consent, owner RLS, private refresh, ordinary login                       |
| HTTP boundary and lifecycle       | `RUN_INTEGRATION_TESTS=true bun test src/modules/mcp/infrastructure/oauth/mcp-oauth.integration.spec.ts` with the isolated local configuration      | 14 passed, 0 failed                                                                                                                                                   |
| Backend integration/e2e           | `RUN_INTEGRATION_TESTS=true bun test .integration.spec .e2e.spec` with the isolated local configuration                                             | 117 passed, 0 failed                                                                                                                                                  |
| Backend suite                     | `bun test`                                                                                                                                          | 1,633 passed, 0 failed; dedicated HTTP tests executed separately above                                                                                                |
| Focused unit checks               | `bun test src/modules/mcp src/config/environment.spec.ts src/common/guards/user-throttler.guard.spec.ts src/common/utils/log-anonymization.spec.ts` | 100 passed, 0 failed; dedicated integration cases skipped in this command only                                                                                        |
| Types                             | `pnpm run type-check:full`                                                                                                                          | Passed                                                                                                                                                                |
| Quality                           | `pnpm quality` from workspace root                                                                                                                  | Passed, including architecture, package lint/format and automation gates                                                                                              |
| SQL                               | Every `supabase/tests/*.sql`, via `psql -v ON_ERROR_STOP=1`                                                                                         | 20 suites passed; network connection used for the existing two-session concurrency test                                                                               |
| Schema replay and generated types | New disposable Supabase stack; `supabase gen types typescript --local --workdir <cutover-workdir>` compared with `src/types/database.types.ts`      | Schema replay passed; exact type match                                                                                                                                |
| Supabase security                 | `supabase db advisors --local --workdir <cutover-workdir> --type security --level warn --fail-on error`                                             | No issues                                                                                                                                                             |
| Legacy retirement                 | `pnpm exec bun ../aidd_docs/tasks/2026_09/2026_09_05_mcp-credential-isolation/legacy-retirement-probe.ts <cutover-workdir>`                         | Both refresh routes rejected the retired native client; Auth/Data API writes rejected after actual JWT expiry; ordinary first-party refresh and data access preserved |

The main audit stack used `127.0.0.1:56421`, with a one-hour native JWT lifetime. The independent cutover/schema stack used `127.0.0.1:56431` and 60-second JWTs solely to observe real expiry. The helper refuses unexpected local targets. CLI credentials stayed in child-process environment/memory, never command arguments or versioned files.

The initial full SQL invocation used a Unix socket, which cannot supply the network address needed by the existing `dblink` concurrency suite. Re-running every suite over the isolated container's bridge address passed. The first HTTP run needed explicit closure of the test server's keep-alive connections; its exact disposable fixtures were cleaned up after interruption.

## Boundary coverage

- SDK discovery, public/confidential client registration, PKCE and single-redirect defaults; unsafe redirects and native public registration rejected.
- First-party authenticated consent plus vault-key validation; expired, denied and unknown/native authorization IDs rejected without an external code.
- Codes bound to client, redirect and resource; concurrent exchange succeeds once only.
- Private sessions encrypted with an HKDF-separated wrapping purpose and owner/client/generation AAD; altered context, key or ciphertext fails authentication. External credentials are stored only as hashes.
- External bearer cannot call Supabase directly; ordinary first-party and private Supabase bearers cannot call MCP.
- Restart persistence, refresh rotation, completed-token replay revocation, retry after an upstream 503, and concurrent refresh/revocation.
- Read-only catalog and direct-write refusal; encrypted owner write/read, cross-owner rejection and argument-free activity records.
- Reconnection replaces the generation. Old credentials cannot revive or revoke the new connection.
- Expiry, feature-disabled refusal, owner-only revocation, vault-code change and recovery; private credentials and wrapped vault keys destroyed while ordinary data stays readable.
- OAuth credentials and code-bearing redirects are redacted in nested log structures.

## Independent review disposition

One read-only candidate review was performed. Its two compatibility findings were reproduced and corrected: an upstream failure before external issuance now releases the claim for retry, and a single registered redirect supplies the SDK's optional default. Real HTTP regression checks cover both, alongside completed-token replay rejection.

Its legacy-token finding was confirmed separately: deleting a native OAuth client immediately blocks refresh but does not immediately invalidate its signed access JWT. The migration revokes legacy Pulpe connection rows and clears their wrapped keys; native issuer retirement and expiry remain mandatory operational prerequisites. The retirement probe proves that sequence without touching ordinary sessions or changing global signing keys. No claim of instantaneous native-token revocation is made.
