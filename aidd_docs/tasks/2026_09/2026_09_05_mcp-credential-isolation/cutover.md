# MCP credential-isolation cutover

Do not activate the connector until the applicable retirement gate below has passed. Applying the SQL migration alone does **not** invalidate a Supabase JWT previously delivered to an assistant. No production operation is authorized by this document.

## 0. Production handoff — prepared, not executed

Updated 2026-09-06 against the checked-in configuration and release workflows.
The owner requested a coordinated launch from one instruction. The
[production-readiness plan](../2026_09_06_mcp-production-readiness/plan.md)
orders the remaining evidence, exact release preparation and activation work.
It reuses this runbook; it does not replace protected approvals or claim that
production is ready while the candidate, backup, legacy-retirement or client
gates remain unresolved. No parallel deployment script is required.

The sequence is: **validate isolated tests → approve production setup → retire
legacy issuance → deploy disabled → approve activation → verify → approve public
distribution**. Test approval is not production approval; deployment is not
directory publication.

The owner subsequently authorized scoped test cleanup after validation, a PR to
`main`, monitoring/merge when safe, and production setup. This resolves the broad
production-setup permission, not the exact release/version, protected-environment,
activation or legal/publication gates below. No production change has occurred.
The isolated security candidate `158574cf3` passed deployed HTTP regression;
all dedicated test projects/stacks and both vendor test connectors were then
[retired](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/verification-2026-09-05.md#test-resource-retirement--2026-09-06).
Test names and IDs below are separation references, not live resources.

Use the existing production infrastructure, not a new project or a promotion of
the disposable test environment. Resolve the actual provider IDs read-only at
execution time and record them alongside the approved release plan; the domains
below are the repository's intended production targets, not a fresh live audit.

| Surface           | Production target                                     | Must not be reused from tests                        |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Backend           | Railway service serving `https://api.pulpe.app`       | `mcp-spike` or `backend-mcp-spike.up.railway.app`    |
| Web app / consent | Vercel `pulpe-frontend`, `https://app.pulpe.app`      | Vercel `pulpe-mcp-test`                              |
| Landing / support | Vercel `pulpe-landing`, `https://pulpe.app`           | Test availability copy or noindex configuration      |
| Auth / database   | Existing production Supabase project; resolve its ref | Test ref `jsjfammxsqyglxlqzpsl`, fixtures or secrets |

### Read-only production baseline — 2026-09-06

The live providers match published release `v0.48.0` and the `production` pointer
at `7a22f34c55d8dc9c217089670a4e093b8bde5bd7`:

- Railway project `33ba829c-d4d6-4096-b0dc-57c89c367063`, environment
  `a28b6826-ecbe-4c0f-9856-e0ba3ce14e93`, service
  `b1f9b1c0-7eca-4c58-b203-cdbbed8ae0a4`; deployment
  `4c1f5637-ab99-4d46-b3a4-8b1a200dac22` is `SUCCESS`, with `api.pulpe.app` active.
- Vercel team `team_EVRD8cwYKDSFKQOdOoXcGsBU`; frontend project
  `prj_CJuQUe0gr76Am8i57pnryCRXBRji`, production deployment
  `dpl_92JDB3kmNiDpBz5gf9GNFG8J8uJr`; landing project
  `prj_rXn9cDnVijGPrQdYItIi5o4subwX`, production deployment
  `dpl_C8WBrRDByJUCW1D6rAhTXcrVZZ6o`. Both public aliases resolve to these `READY`
  production deployments, not the projects' newer preview deployments.
- Supabase `pulpe`, ref `qhhlloqisgzwcsrbdppn`, is `ACTIVE_HEALTHY` in Zurich,
  PostgreSQL `17.6.1.063`. Its migration history has 98 versions, all present in
  the candidate's 102 files. The four pending files also match the Git delta
  from the published anchor: `20260823120000_create_mcp_connection.sql`,
  `20260823150000_mcp_activity_log.sql`,
  `20260901120000_generate_budgets_atomically.sql` and
  `20260905170811_isolate_mcp_oauth_credentials.sql`.
- The first three pending versions precede the remote tip `20260901130000`.
  Supabase CLI `2.113.0` rejects that ordering without `--include-all`, including
  during dry-run. The protected workflow now uses the same native selection for
  dry-run and apply; its contract and environment gates remain unchanged.
  [Official CLI behavior](https://supabase.com/docs/reference/cli/supabase-db-push).
- All three release workflows are active. The six required secret names are
  present across repository and production-environment scopes; values were not
  read. The environment requires owner approval and disallows administrator bypass.
- Public health, version, web app and landing return 200; web version is `0.48.0`.
  `/mcp` and both MCP discovery routes return 404. This does not prove absence
  of historical native OAuth credentials; section 1 remains an activation gate.

No production setting, secret, account or financial data was changed. This
baseline is not a release authorization or an authenticated first-party smoke
test; recheck targets, backups and the exact pending set when releasing.

The subsequent review adds `20260906201519_purge_orphan_mcp_clients.sql` to
that pending set. The existing daily cleanup now removes registrations older
than thirty days only when no authorization or connection references them.
Previously associated clients, including revoked connections, remain available
for reconnection. This backend-only cleanup does not delete financial data.

### Readiness evidence refresh — 2026-09-06

Read-only checks against candidate `7c99f2b0a7939261db4af6174e77f38508f17424`:

- Supabase still has 98 applied migrations against 103 candidate files: the
  four baseline files above plus `20260906201519_purge_orphan_mcp_clients.sql`
  are pending. Railway still serves deployment
  `4c1f5637-ab99-4d46-b3a4-8b1a200dac22`; public health is healthy and web version
  is `0.48.0`. Browser configuration targets production Supabase and API origins.
- Native backup listing reports eight completed physical backups. The latest,
  `1589227592`, completed at `2026-09-06T01:35:33.588Z`; WAL-G is enabled and
  point-in-time recovery is **disabled**. No backup was downloaded or restored.
  This establishes backup availability, not a rehearsed restore or zero data-loss
  window. Recheck freshness and agree recovery expectations before release.
- Read-only counts in `auth.oauth_clients` (including soft-deleted rows),
  `auth.oauth_authorizations`, `auth.oauth_consents` and OAuth-linked
  `auth.sessions` are all zero. `public.mcp_connection` does not exist yet.
  These counts cannot exclude hard-deleted clients or previously issued JWTs.
  Legacy issuance history remains unverified; the retirement gate is not signed
  off merely because today's tables are empty.
- The production dashboard shows **Enable the Supabase OAuth Server off**.
  Its Site URL is `https://app.pulpe.app`; the four existing redirect entries are
  `https://pulpe.app/**`, `https://www.pulpe.app/**`,
  `pulpe://reset-password` and `https://app.pulpe.app/**`. The app-origin entry
  covers the planned consent path without adding another origin. The disabled
  server does not expose its DCR/authorization-path controls in the dashboard;
  verify those explicitly during approved upstream configuration. No switch,
  allowlist or account was changed.
- Railway variable-name inspection finds all five `MCP_*` variables in section 2
  absent. Existing first-party encryption and Supabase credential names are
  present; their values are not included in this record. Install the production
  URLs and a fresh dedicated wrapping key **before** deploying the candidate:
  startup requires that key even with MCP disabled. Keep both upstream variables
  absent until the separate activation approval. No variable was changed.
- `pnpm audit --prod --json`: zero high/critical, four moderate and one low
  findings, exclusively on Android paths. The full audit **including development
  dependencies** reports 31 high, 37 moderate and five low, zero critical.
  These are different scopes; the runtime result is not a claim that the entire
  dependency graph is vulnerability-free. Recheck and assess the release scope
  before signing off the exact candidate.
- CI run `34059890579` completed successfully at 21:23 UTC, including E2E and
  iOS. Android run `34059890580` completed successfully at 21:28 UTC; both bind
  to the exact candidate above. Claude review `34059890601` failed with an API
  error whose detailed cause is not retained in the sanitized logs. This does
  not establish a code defect, expired credential or successful review. The ten
  previously investigated threads are resolved. Any later commit needs its own
  applicable checks before merge; these successes do not transfer to another SHA.

No production setting, key, identity or financial data was changed. Ordinary
authenticated login/refresh/encrypted access still needs an approved account
scope. The owner decision packet also still needs the exact release version and
four-language notes, cutover window, synthetic staging/production account scope,
public activation and recovery approval. Directory identity/legal approval is
separate. Continue the readiness plan; do not treat these observations as launch
authorization.

Before any production write, record and check:

- [ ] Maxime has accepted the [client evidence](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/submission-checklist.md) and the exact supported surfaces. Both vendors passed web read/write and revocation; all 15 tools have Claude success evidence across sessions. The deployed presentation regression passed in Claude web. The owner waived mobile testing; it remains unverified, alongside ChatGPT's seven-tool read-only grant, Claude Code and desktop writes. Retain limitations instead of marking them passed.
- [x] Resolve the production-dependency [backend/web audit](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/verification-2026-09-05.md#dependency-gate) with supported updates and regression/build checks. The `--prod` audit remains zero high/critical on `7c99f2b0a`, with four moderate and one low Android-only findings. Development dependencies have separate findings recorded above. Recheck the exact release candidate; the critical-only CI audit alone is insufficient.
- [ ] Production Supabase ref, Railway project/environment/service IDs and Vercel team/project IDs have been resolved and approved. Existing service health and ordinary login, refresh and encrypted budget access have a baseline.
- [ ] The candidate SHA/version, published rollback anchor, **all** pending migrations since that anchor, backup/restore availability, cutover window and owner are recorded. No migration reset, force-push or test seed against production.
- [ ] The applicable legacy retirement evidence in section 1 is complete before activation. If an old issuer is already live, agree how to stop it before the migration; do not assume this document proves production was never exposed.
- [ ] Maxime approves the exact infrastructure/secret changes and any synthetic production account, assistant grants, writes and revocations. Directory submission, identity/legal attestations and public launch require their own approval.

The credential-isolation and presentation corrections do not change native
code or require a simulator. The complete feature PR does include earlier
Pulpe iOS connection-management files; let the existing CI/release classifier
determine its native checks and distribution requirements. Those are distinct
from testing ChatGPT/Claude mobile applications, which the owner waived.

## 1. Retire the native public issuer

For a fresh installation, verify that no legacy MCP OAuth clients, grants or sessions have ever been issued. Record that evidence; absence of an active `mcp_connection` row alone is insufficient because previously revoked connections can still have native tokens.

If native MCP credentials have been issued:

1. Keep MCP unavailable during the cutover. Disable the old authorization/consent routes and Supabase dynamic client registration. Verify `/auth/v1/oauth/clients/register` rejects registration. Do not leave an old backend instance serving the native flow.
2. Inventory the exact legacy MCP client IDs, including previously revoked connections. Use the Supabase Auth administration API/dashboard to retire those clients. Do not delete unrelated OAuth clients or sign every Pulpe user out.
3. With a synthetic legacy account, verify both `/auth/v1/oauth/token` and `/auth/v1/token?grant_type=refresh_token` reject its old refresh credential. Retirement is incomplete if either endpoint can issue another bearer.
4. Wait out the **maximum access-token lifetime in effect before the last possible issuance**, plus verifier clock tolerance. Decreasing the lifetime now does not shorten existing JWTs. Verify old synthetic bearers can no longer modify `/auth/v1/user` or owner data through PostgREST. Do not infer this from the disappearance of the OAuth client, grant or connection row.
5. Verify a normal Pulpe session can still refresh, read its account and access its owner data. Never rotate the global JWT signing key or encryption master key as a shortcut.

Supabase explicitly documents that access tokens remain valid until expiry after sign-out: [session retirement semantics](https://supabase.com/docs/guides/auth/signout). OAuth scopes also do not limit database access: [OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security).

The executable `legacy-retirement-probe.ts` exercises this sequence only on a dedicated local stack at `127.0.0.1:56431`, with `jwt_expiry = 60` and disposable data. It asserts failure of both refresh routes, waits for real Auth/Data API rejection, and checks ordinary first-party refresh afterwards. The short lifetime is for the test stack, not a production setting.

## 2. Configure the isolated issuer

1. Apply `20260905170811_isolate_mcp_oauth_credentials.sql` through the protected release workflow in section 3, together with its required preceding migrations; never apply it manually to production. Existing connection keys are cleared and those connections are marked revoked: their owners must associate again. The migration preserves financial data and activity history. It does not alter Supabase Auth tables or first-party sessions.
2. Enable Supabase's OAuth server for the private upstream flow, with its authorization path `/mcp-consent` and production Auth Site URL `https://app.pulpe.app`. Register one **backend-only confidential** OAuth client using `client_secret_post`. Its only callback is `https://api.pulpe.app/mcp/oauth/upstream-callback`. Keep Supabase dynamic registration disabled. Verify the remote settings; the local `config.toml` does not prove they were applied. This client is not the client registered by ChatGPT or Claude; never enter its secret in a vendor connector form.
   Separately verify that the first-party Google/Apple sign-in redirect allowlist
   accepts `https://app.pulpe.app/mcp-consent?authorization_id=...`, so a signed-out
   owner returns to the pending consent. Preserve the existing app-origin scope;
   never add a cross-origin wildcard. [Supabase redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).
3. Configure these backend variables together:

   | Variable                     | Value                                                                            |
   | ---------------------------- | -------------------------------------------------------------------------------- |
   | `MCP_RESOURCE_URL`           | `https://api.pulpe.app/mcp`                                                      |
   | `MCP_CONSENT_URL`            | `https://app.pulpe.app/mcp-consent`                                              |
   | `MCP_UPSTREAM_CLIENT_ID`     | Confidential Supabase client UUID                                                |
   | `MCP_UPSTREAM_CLIENT_SECRET` | Its backend-only secret                                                          |
   | `MCP_WRAPPING_KEY`           | Existing stable 32-byte hex wrapping key; new installations generate it securely |

   Never put these secrets in frontend configuration, tool results, shell arguments or Git. Keep the upstream ID and secret both **absent**, not empty strings, until activation is allowed; a half-configured pair or empty value fails startup validation. `MCP_WRAPPING_KEY` is required even while MCP is disabled. Preserve its production value if one exists; otherwise generate a fresh cryptographically random 32-byte value encoded as 64 hex characters, distinct from the unchanged `ENCRYPTION_MASTER_KEY` and every test key.

   After authorization, a new secret's local Dashlane handoff may use `backend-nest/.mcp-production/.env.local`, separate from the test file. Verify `git check-ignore` before writing, use directory mode 700 and file mode 600, and store the value without displaying it in logs or chat. Record only secret names and target IDs in versioned evidence. Confirm Dashlane backup before removing the local copy; never regenerate a live key just to recover a missing local file.

4. Deploy the backend and existing consent page with the feature still unavailable publicly until the retirement gate is complete. Do not restore the former public native issuer as a rollback.
5. Verify discovery advertises the **Pulpe API origin**, not Supabase: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`. External registration is `/register`, authorization `/authorize`, token exchange `/token`, revocation `/revoke`.
6. Test association, a useful read, an encrypted write and revocation with a synthetic account in each intended assistant client. Only then update public availability copy. A protocol test does not prove ChatGPT/Claude plan or mobile availability.

## 3. Production execution order after approval

### Prepare configuration and release

1. Review the exact settings delta on the existing production targets. Preserve
   production `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ENCRYPTION_MASTER_KEY`, real Turnstile keys and existing analytics settings.
   Set/verify `NODE_ENV=production`, `CORS_ORIGIN=https://app.pulpe.app` and
   `DEBUG_HTTP_FULL=false`. Do not copy dummy Turnstile, test bypass variables,
   fixture credentials or disabled test analytics into production.
2. Prepare the MCP URLs and required wrapping key from section 2, with both
   upstream variables absent for the first isolated deployment. Coordinate any
   provider configuration-triggered restart with the approved cutover window;
   the release workflow does not configure OAuth clients or provider secrets.
3. Verify Vercel Production settings: `PUBLIC_ENVIRONMENT=production`,
   `PUBLIC_BACKEND_API_URL=https://api.pulpe.app/api/v1`, and
   `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` for the same production
   project as the backend. Never add service-role, wrapping or upstream secrets
   to `PUBLIC_*` or the generated browser `config.json`. Keep real signup/MFA,
   redirect allowlists and anti-bot protections; no global relaxation for reviewers.
4. Verify existing GitHub release credentials without printing their values:
   `SUPABASE_ACCESS_TOKEN`, `PRODUCTION_DB_PASSWORD`, `PRODUCTION_PROJECT_ID`,
   `PULPE_RELEASE_APP_ID`, `PULPE_RELEASE_APP_PRIVATE_KEY` and
   `RAILWAY_PRODUCTION_TOKEN`. Confirm the protected `production` environment
   approval is enabled. A missing credential is a stop, not permission to replace it.
5. Follow the existing [release process](../../../../docs/DEPLOYMENT.md#release-process):
   feature PR into `main`, then `/release` from clean synchronized `main` after
   the owner approves release preparation. Use its single `release/vX.Y.Z`
   preparation PR, owner merge commit and exact successful staging proof.
   Keep `main` fixed at that candidate until publish; do not choose a version or
   reuse an old test SHA from this document.
6. Resolve the existing release intention before dispatching
   `release-promotion.yml` in read-only `plan` mode. Review its manifest, provider
   IDs, rollback anchor and complete migration range. Then obtain approval for
   `publish` and the GitHub `production` environment. The workflow performs the
   migration dry-run/apply and advances `production`; provider Git integrations
   deploy the candidate. No manual production `supabase db push`, `railway up`,
   direct protected-branch push, tag creation or duplicate release dispatch.

### Verify disabled deployment, then activate

1. Wait for exact backend, frontend and landing deployment evidence and
   `Production Finalized`; inspect `/health`, `/api/v1/app/version`, the public
   consent page and ordinary encrypted account access. With upstream variables
   absent, discovery must not advertise an enabled issuer and MCP must reject
   access. A healthy backend alone is not proof of a working consent build.
2. Only after section 1 and the owner activation gate, install both confidential
   upstream variables together on the approved Railway production service and
   restart it with the same proven source SHA. Record the resulting deployment
   ID and check that no old instance remains. This enables public OAuth/MCP
   endpoints, **not a private tester allowlist**, even while listing copy remains
   unpublished; the owner must approve that exposure.
3. Check `https://api.pulpe.app/.well-known/oauth-authorization-server` and
   `https://api.pulpe.app/.well-known/oauth-protected-resource/mcp`: issuer and
   endpoints must use `api.pulpe.app`, resource must be
   `https://api.pulpe.app/mcp`, and scope must be `mcp`. External `/register`
   belongs to Pulpe; native Supabase DCR must still reject registration.
   Requests to `/mcp` without a bearer must return 401 with a metadata challenge.
4. Create/use only the explicitly approved synthetic production account and
   normal browser login/PIN flow. Verify seven read-only tools, then separately
   consented read/write access (15 tools), a useful read, one approved expense
   visible in ordinary Pulpe with matching amount/currency, and revocation.
   Confirm revoked access is refused and reconnection needs new consent.
   Compare encrypted storage and credential-boundary results without logging
   amounts, secrets or user data; retain only sanitized evidence.
5. Recheck ordinary Pulpe login, refresh, budget access and service health.
   Observe authorization/token failure rates, MCP errors/latency and activity
   for the agreed validation window. On a boundary violation, unexpected
   mutation or first-party regression, stop activation and use section 4.

### Branding and public distribution

- Use `Pulpe` for production; `Pulpe Tests` was the retired test target's name.
  Prepare the existing [brand icon](../../../../landing/public/icon.png)
  (519 × 519 PNG), not a new design. OpenAI's submission form has a **Logo** field
  under Info; upload the approved asset and verify its actual appearance in the
  listing and connection dialog. This is listing configuration, not a change to
  the Claude Code `plugin.json`. Recheck current upload constraints when entering
  the form. [Official OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission).
- Use the production MCP URL with OAuth discovery, not the private Supabase
  client secret. Prepare support at `https://pulpe.app/support`, the guide at
  `https://pulpe.app/support/connecter-un-assistant`, and the actual published
  privacy/terms URLs. Verify they match the provider/data-sharing disclosure.
- Complete the existing [directory gates](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/submission-checklist.md#directory-submission-gates),
  including publisher identity, domain challenge, reviewer access and evaluation
  cases. Resolve portal-generated values at execution; do not invent tokens or
  overwrite another listing's domain verification. Custom connector acceptance
  does not establish directory approval or universal mobile support.
- Only after owner approval and the applicable acceptance/publication gates,
  update four-language availability copy through the normal release process.
  Record live listing URLs, supported surfaces and production verification;
  never restore the retired test environment as a production target.

## 4. Stop and recover

For the **isolated** deployment, remove both upstream variables and restart all
instances while preserving `MCP_WRAPPING_KEY` and `ENCRYPTION_MASTER_KEY`.
Verify MCP bearer rejection and unavailable OAuth discovery, then ordinary Pulpe
access. `MAINTENANCE_MODE` is not an OAuth kill switch: the SDK routes are mounted
before Nest's maintenance middleware. Retire an old native issuer using section 1,
not this isolated-issuer switch.

Disabling is not revocation: existing grants remain stored and may work again
after re-enabling. For an incident requiring permanent retirement, revoke the
exact affected connections through Pulpe's owner flow or an approved scoped
administrative procedure, and verify rejection before reopening. Do not rotate
wrapping/master keys as a substitute for revocation.

Application rollback uses the published anchor in the release plan **only if**
compatible with the applied schema and unable to restore the old public native
issuer. Otherwise keep MCP disabled and release a forward fix. Database recovery
is forward-only; no reset, down-migration, financial-data overwrite or automated
backup restore. Obtain separate approval for any data restore or broader outage.

## Credential lifetime and recovery

Authorization requests expire after 10 minutes; approved codes expire after one minute and are single-use. External access tokens last at most one hour and expire before their private upstream token. Refresh rotates the external pair, with replay detection retained for the connection's absolute 30-day lifetime. Reconnection creates a new generation; old credentials cannot revive or revoke it.

An upstream failure before any external pair is issued releases the refresh claim for retry. If the private exchange succeeded but its response was lost, upstream recovery still depends on Supabase's refresh semantics; an unrecoverable private session requires association again. A failed or uncertain final token persistence is never blindly replayed into another external pair.

Revocation, vault-code change and recovery clear stored private credentials and the wrapped vault key. MCP subsequently refuses the external bearer even though the ordinary Pulpe session remains valid. The external bearer itself is never accepted by Supabase Auth, PostgREST, RPC or GraphQL.
