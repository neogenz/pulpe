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

## Client availability: documented, not yet observed with Pulpe

| Client/surface            | Current documented path                                                                                                                                   | Pulpe acceptance |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| ChatGPT web               | Developer mode, subject to account/workspace policy; connect an MCP endpoint through Plugins.                                                             | Not run          |
| ChatGPT desktop/mobile    | Do not infer support from web developer mode or from publication alone; verify the actual account, app version and directory availability.                | Not run          |
| Claude web/desktop/mobile | Remote connectors are brokered through Anthropic's infrastructure; the server must be reachable there. Free accounts are limited to one custom connector. | Not run          |
| Claude Code               | Remote MCP plugin/connection; package installation alone does not test authorization.                                                                     | Not run          |

The current [OpenAI connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)
uses Settings → Security and login → Developer mode, then Plugins → +. It does
not establish universal mobile availability. The public guide follows this setup
without promising unsupported surfaces.

[Claude's remote connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
documents supported plans and cloud-origin connections across clients. It does
not require creating a paid Team organization to test an individual connector.

## Non-production acceptance fixture

Use an explicitly approved non-production Supabase target and synthetic,
non-sensitive financial data. The existing Railway `mcp-spike` service runs the
new code, but protected-resource discovery returned 404. Resolve its confidential
upstream configuration and database migration before client testing; never
silently reuse production or shared preview users.

Follow [cutover.md](../../2026_09/2026_09_05_mcp-credential-isolation/cutover.md)
for legacy retirement, exact issuer URLs, callback and variable names.
Generate durable secrets only once the target is selected. Store a local Dashlane
copy in an explicitly Git-ignored owner-only file, never this checklist.

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
