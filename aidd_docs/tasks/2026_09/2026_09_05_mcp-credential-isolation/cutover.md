# MCP credential-isolation cutover

Do not activate the connector until the applicable retirement gate below has passed. Applying the SQL migration alone does **not** invalidate a Supabase JWT previously delivered to an assistant. No production operation is authorized by this document.

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

1. Apply `20260905170811_isolate_mcp_oauth_credentials.sql`. Existing connection keys are cleared and those connections are marked revoked: their owners must associate again. The migration preserves financial data and activity history. It does not alter Supabase Auth tables or first-party sessions.
2. Register one **backend-only confidential** Supabase OAuth client using `client_secret_post`. Its only callback is `<API origin>/mcp/oauth/upstream-callback`. Keep Supabase dynamic registration disabled. This client is not the client registered by ChatGPT or Claude.
3. Configure these backend variables together:

   | Variable                     | Value                                                                            |
   | ---------------------------- | -------------------------------------------------------------------------------- |
   | `MCP_RESOURCE_URL`           | Public HTTPS URL `<API origin>/mcp`                                              |
   | `MCP_CONSENT_URL`            | Public HTTPS URL of the existing Pulpe `/mcp-consent` page                       |
   | `MCP_UPSTREAM_CLIENT_ID`     | Confidential Supabase client UUID                                                |
   | `MCP_UPSTREAM_CLIENT_SECRET` | Its backend-only secret                                                          |
   | `MCP_WRAPPING_KEY`           | Existing stable 32-byte hex wrapping key; new installations generate it securely |

   Never put these secrets in frontend configuration, tool results, shell arguments or Git. A local copy for Dashlane must be explicitly Git-ignored and readable only by its owner. Keep the upstream ID and secret both unset until activation is allowed.

4. Deploy the backend and existing consent page with the feature still unavailable publicly until the retirement gate is complete. Do not restore the former public native issuer as a rollback.
5. Verify discovery advertises the **Pulpe API origin**, not Supabase: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`. External registration is `/register`, authorization `/authorize`, token exchange `/token`, revocation `/revoke`.
6. Test association, a useful read, an encrypted write and revocation with a synthetic account in each intended assistant client. Only then update public availability copy. A protocol test does not prove ChatGPT/Claude plan or mobile availability.

## Credential lifetime and recovery

Authorization requests expire after 10 minutes; approved codes expire after one minute and are single-use. External access tokens last at most one hour and expire before their private upstream token. Refresh rotates the external pair, with replay detection retained for the connection's absolute 30-day lifetime. Reconnection creates a new generation; old credentials cannot revive or revoke it.

An upstream failure before any external pair is issued releases the refresh claim for retry. If the private exchange succeeded but its response was lost, upstream recovery still depends on Supabase's refresh semantics; an unrecoverable private session requires association again. A failed or uncertain final token persistence is never blindly replayed into another external pair.

Revocation, vault-code change and recovery clear stored private credentials and the wrapped vault key. MCP subsequently refuses the external bearer even though the ordinary Pulpe session remains valid. The external bearer itself is never accepted by Supabase Auth, PostgREST, RPC or GraphQL.
