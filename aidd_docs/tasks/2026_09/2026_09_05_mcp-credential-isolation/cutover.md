# MCP credential-isolation cutover

Do not activate the connector until the applicable retirement gate below has passed. Applying the SQL migration alone does **not** invalidate a Supabase JWT previously delivered to an assistant. No production operation is authorized by this document.

## 0. Production handoff — prepared, not executed

Updated 2026-09-06 against the checked-in configuration and release workflows.
The sequence is: **validate isolated tests → approve production setup → retire
legacy issuance → deploy disabled → approve activation → verify → approve public
distribution**. Test approval is not production approval; deployment is not
directory publication.

The owner subsequently authorized scoped test cleanup after validation, a PR to
`main`, monitoring/merge when safe, and production setup. This resolves the broad
production-setup permission, not the exact release/version, protected-environment,
activation or legal/publication gates below. No production change has occurred.

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

Before any production write, record and check:

- [ ] Maxime has accepted the [client evidence](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/submission-checklist.md) and the exact supported surfaces. Both vendors passed web read/write and revocation; all 15 tools have Claude success evidence across sessions. The deployed presentation regression passed in Claude web. The owner waived mobile testing; it remains unverified, alongside ChatGPT's seven-tool read-only grant, Claude Code and desktop writes. Retain limitations instead of marking them passed.
- [ ] Resolve the [production dependency audit](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/verification-2026-09-05.md#dependency-gate), with supported updates and relevant regression/build checks. The critical-only CI audit is insufficient evidence for the remaining high/moderate advisories.
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

- Use `Pulpe` for production and keep `Pulpe Tests` on the separate test target.
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
  keep the test environment separate unless its retirement is also approved.

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
