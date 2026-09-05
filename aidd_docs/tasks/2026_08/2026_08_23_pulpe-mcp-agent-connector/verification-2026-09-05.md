# MCP readiness verification — 2026-09-05

Status: **not ready for public activation**. This supersedes earlier readiness
claims, not the historical implementation record.

## Integration and checks

- Rebased the 22 feature commits onto `origin/main` at `bb7e0e767`.
  Recovery branch: `codex/mcp-before-rebase-20260905` at `60d566f26`.
- Preserved main's feedback, budget generation, legal wording and CI redesign.
  Fixed the environment fixture and localized legal test argument order.
- `pnpm quality`: passed, including public surface, security and lexicon checks.
- Backend suite: 1,624 passed; the one failing environment fixture was corrected
  and its full test file then passed (31 tests). No backend runtime code changed.
- Frontend MCP, connections, legal and auth regression selection: 35 passed.
  Updated consent/legal selection: 9 passed, including the new disclosure check.
- Production Angular build: passed outside the sandbox after esbuild aborted
  inside it. Landing: 138 tests passed and production build passed.
- Browser: new home section renders; its CTA opens the assistant guide with
  the expected disclosure and client-specific instructions.
- Native iOS tests and real-client OAuth/tool round trips are not verified by
  these checks. iOS changes concern connection management, not the MCP transport.
- All 19 existing SQL suites passed against the isolated replayed schema.
  Generated types were compared byte-for-byte; MCP formatting drift was corrected.
  The two feature migrations now carry the required contract metadata, safe after
  the verified integrated `v0.47.1` release. Their SQL behavior is unchanged.

## Confirmed release blocker: direct database authorization

The MCP guard enforces an active connection and filters read/write tools. The
ordinary NestJS API rejects agent tokens. However, the authenticated Supabase
client forwards the agent's original JWT to PostgREST.

Existing budget RLS policies check only the owning user. They do not inspect
`client_id`, connection mode or revocation. A local transaction with fictitious
user/template/budget records, `SET LOCAL ROLE authenticated`, and JWT claims
containing `client_id: unapproved-mcp-audit-client` successfully updated that
user's budget description without any MCP grant (`UPDATE 1`). It was rolled back;
no real data or persistent schema changes were made. Preview policies were
inspected read-only and have the same owner-only checks.

An isolated Supabase stack subsequently replayed every branch migration and
confirmed the problem over HTTP with a real authorization-code/PKCE exchange.
The tested Auth image was `public.ecr.aws/supabase/gotrue:v2.195.0`.

| Probe                                            | Result                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| First-party profile metadata update              | HTTP 200, legitimate control                                    |
| OAuth bearer profile metadata update             | HTTP 200, persisted and read back using the first-party session |
| OAuth bearer budget update without any MCP grant | HTTP 200, one row updated                                       |
| Same budget update after OAuth grant revocation  | HTTP 200, one row updated                                       |

The disposable user, OAuth client and linked test data were removed afterwards.
[oauth-isolation-probe.ts](./oauth-isolation-probe.ts) reproduces the observations
against a disposable local stack on port 56421; it never prints tokens. It is a
diagnostic, not a passing release gate. Run it with Bun and the isolated Supabase
project directory as its sole argument.

This also crosses the Auth boundary: a PostgREST pre-request function cannot
protect GoTrue's account endpoints. The assistant must never receive a credential
that authenticates as the real Supabase user. Before release, complete credential
isolation must preserve ordinary user access, owner RLS, encryption, read-only
mode and revocation. A UI-only, guard-only or table-policy-only fix is insufficient.

Supabase documents that OAuth scopes do not restrict database access:
[OAuth token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).

## Deployment and client evidence

- Production `/.well-known/oauth-protected-resource/mcp`: HTTP 404.
- Railway production: `MCP_RESOURCE_URL` and `MCP_WRAPPING_KEY` absent.
- Production Supabase: `mcp_connection` and `mcp_activity` absent.
- Railway `mcp-spike`: protected-resource metadata responds HTTP 200 and points
  to preview Supabase. Discovery alone does not prove consent or tools work.
- Claude's remote connectors are documented for web, desktop and mobile:
  [custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- ChatGPT's custom MCP developer-mode route is currently documented as web-only,
  with capabilities depending on plan; directory publication is a separate path:
  [developer mode and MCP](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta).
- Landing and consent now explain data transmission to the chosen provider in
  four languages. Landing labels the public connection as being prepared and
  does not promise universal client support or guaranteed action confirmation.
