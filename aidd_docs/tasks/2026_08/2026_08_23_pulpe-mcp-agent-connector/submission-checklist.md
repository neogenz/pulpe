---
status: blocked
---

# Client acceptance and directory readiness

Verified against official documentation on 2026-09-05. A working custom connector
and a published directory listing are separate milestones. Neither has been
proven for the new isolated Pulpe issuer. No submission or agreement was accepted.

## Distribution assets in this repository

The Claude Code remote plugin is in `plugins/pulpe/`; the repository marketplace
is `.claude-plugin/marketplace.json`. Earlier install/remove checks validated the
package, not a successful OAuth/tool session. It deliberately has no plugin
version: the Git source updates by commit. No local stdio server is distributed.

The four-language guide is `/support/connecter-un-assistant`. Consent and legal
copy explain that requested financial data is sent to the chosen assistant and
its provider. Public availability remains "in preparation".

## Client availability and observed acceptance

Web settings were inspected on 2026-09-06. Neither legacy test association has
completed acceptance against the isolated issuer.

| Client/surface            | Current documented path                                                                                                                                   | Pulpe acceptance |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| ChatGPT web               | Developer mode, subject to account/workspace policy; connect an MCP endpoint through Plugins.                                                             | Pro settings accessible; legacy OAuth redirects to a deleted deployment. New association pending. |
| ChatGPT desktop/mobile    | Do not infer support from web developer mode or from publication alone; verify the actual account, app version and directory availability.                | Not run          |
| Claude web/desktop/mobile | Remote connectors are brokered through Anthropic's infrastructure; the server must be reachable there. Free accounts are limited to one custom connector. | Pro web settings accessible; legacy connector has no tools. New association and desktop/mobile testing pending. |
| Claude Code               | Remote MCP plugin/connection; package installation alone does not test authorization.                                                                     | Not run          |

The current [OpenAI connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)
uses Settings → Security and login → Developer mode, then Plugins → +. It does
not establish universal mobile availability. The public guide follows this setup
without promising unsupported surfaces.

[Claude's remote connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
documents supported plans and cloud-origin connections across clients. It does
not require creating a paid Team organization to test an individual connector.

## Non-production acceptance fixture

The explicitly approved fixture is ready: Free Supabase project
`jsjfammxsqyglxlqzpsl`, test app https://pulpe-mcp-test.vercel.app and MCP endpoint
`https://backend-mcp-spike.up.railway.app/mcp`. Railway's configured deployment
reached `SUCCESS`; discovery and a remote HTTP read/write/refresh/revoke check
passed. Account `mcp-review-20260906@pulpe.test` contains only synthetic data:
one September 2026 budget, four forecasts, 2,400 available to spend and no movements.
See the [remote evidence](./verification-2026-09-05.md#remote-environment-and-client-readiness--updated-2026-09-06).

The existing ChatGPT/Claude test connectors must be associated with this account,
not an old shared preview user. Specific permission for replacing their legacy
associations and sending the fictitious account's data to both providers is
pending. ChatGPT's Refresh did not visibly replace its two-tool legacy catalog;
Reconnect reached a deleted Vercel deployment. Claude rejects a duplicate URL
and its existing connector has no tools. No replacement or new grant was made.

Follow [cutover.md](../../2026_09/2026_09_05_mcp-credential-isolation/cutover.md)
for legacy retirement, exact issuer URLs, callback and variable names.
Durable secrets and synthetic login/vault/recovery credentials already exist in
the Git-ignored owner-only `backend-nest/.mcp-test/.env.local` for Dashlane.
Do not regenerate them or put their values in this checklist or assistant prompts.

Record assistant, plan, client version, surface, timestamp, actual tool selection,
confirmation behavior and the observed Pulpe result. For each intended client:

1. Associate in read-only mode; inspect the provider/data-sharing disclosure and
   confirm the seven-tool catalog.
2. Read the current month and compare it with Pulpe.
3. Reconnect in read/write mode, record an expense, verify it in Pulpe and revoke.
4. Confirm subsequent access is refused. Reconnection must require new consent.
5. Repeat on each claimed desktop/mobile surface. A missing client capability is
   a documented limitation, not a reason to weaken server authorization.

## Directory submission gates

### OpenAI

Public submissions require a verified individual/business identity and a role
with Apps Management write permission. Prepare a public MCP endpoint, domain
verification access, accurate annotations, authentication/reviewer access,
listing assets, support/privacy/terms URLs, countries, and evaluation cases.
An MCP-only plugin does not require custom UI.
[Submission requirements](https://developers.openai.com/plugins/deploy/submission).

The plugin may record budget entries, but must not execute bank transfers or
investment trades. Keep account passwords and vault codes in the normal browser
authorization flow, never tool inputs or responses.
[Plugin guidelines](https://developers.openai.com/plugins/app-guidelines).

### Anthropic

Prepare server/authentication/transport details, the full annotated tool list,
public documentation, support and privacy links, branding, a populated reviewer
account, tested surfaces and the requested policy attestations.
[Connector submission](https://claude.com/docs/connectors/building/submission).

Exercise every tool both directly and through Claude. Split read/write actions,
return useful validation messages and do not present recording a budget entry
as transferring funds.
[Pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria).

The remote Connectors Directory and the Claude Code/Cowork Plugin Directory are
distinct. The latter requires a public plugin repository or bundle.
[Plugin submission](https://claude.com/docs/plugins/submit).

No card payment, identity check, legal attestation, public launch or directory
submission is authorized by this document.

## Evaluation prompts prepared for human/client acceptance

These are planned vendor-client cases, not claims that a model executed them.

| Type     | Prompt                                                   | Expected observation                                                    |
| -------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Positive | "Combien me reste-t-il à dépenser ce mois-ci ?"          | Current-month figures match Pulpe.                                      |
| Positive | "Retrouve mes courses de cette année."                   | Relevant owner-only search results and correct amounts.                 |
| Positive | "Note 25 francs de courses dans ce mois."                | Requested write is visible in Pulpe; record actual client confirmation. |
| Positive | "Crée le mois prochain à partir de mon modèle habituel." | Select the intended template, clarify ambiguity, create only once.      |
| Positive | "Où en est mon objectif vacances ?"                      | Confirmed/planned/projection figures match Pulpe.                       |
| Negative | "Ajoute une dépense" with read-only consent              | No write tool or mutation.                                              |
| Negative | "Crée le mois prochain" without a selected template      | Ask which template, no mutation.                                        |
| Negative | Ask for data after revoking access in Pulpe              | Access refused; no stale credential bypass.                             |

The reviewer account must remain usable across review days, contain only
synthetic data, and include clear login and vault-code instructions. Do not remove
production MFA or sign-up protections globally to accommodate a reviewer.
