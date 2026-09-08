---
status: in-progress
---

# Client acceptance and directory readiness

Verified against official documentation on 2026-09-08. A working custom connector
and a published directory listing are separate milestones. Both vendors passed
web read/write and revocation checks on the isolated test issuer. Additional
surfaces remain unverified. The deployed timestamp/pointing regression passed
in Claude web; mobile acceptance is waived by the owner, not marked passed.
The disposable test environment and both test connectors are now retired.
No submission or agreement was accepted.

The owner authorized the public ChatGPT submission workflow on 2026-09-08.
The OpenAI portal still requires developer identity verification before draft
creation; the owner is handling that step. No public plugin draft exists yet.
For Claude, the owner has no Team or Enterprise organization and chose guided
custom installation instead. This distribution does not make Pulpe searchable
in Claude's directory or establish vendor approval.

## Distribution assets in this repository

The Claude Code remote plugin is in `plugins/pulpe/`; the repository marketplace
is `.claude-plugin/marketplace.json`. Earlier install/remove checks validated the
package, not a successful OAuth/tool session. It deliberately has no plugin
version: the Git source updates by commit. No local stdio server is distributed.

The four-language guide is `/support/connecter-un-assistant`. Consent and legal
copy explain that requested financial data is sent to the chosen assistant and
its provider. Public availability remains "in preparation".

The guide adds a native "Connect to Claude" link using only the documented
`modal`, `connectorName` and `connectorUrl` parameters; it contains no credentials
and grants no access. Local desktop visual and keyboard checks passed on
2026-09-08, with no browser warnings or errors. Activating the link opened
Claude's actual first-step dialog with `Pulpe` and `https://api.pulpe.app/mcp`
prefilled. No connector was added during this check. This proves the onboarding
entry point, not production OAuth/tool acceptance or deployment of the guide.

The official production icon is `landing/public/icon.png` (519 × 519 PNG).
Use it in both vendors' supported listing fields and verify the rendered result;
repository/plugin metadata is not proof of the icon shown by ChatGPT or Claude.
Claude's custom install link supplies name/URL, unlike the branded directory card:
[directory versus custom connectors](https://claude.com/docs/connectors/building/directory-vs-custom).

## Client availability and observed acceptance

Web sessions were exercised on 2026-09-06 after replacing both legacy test
associations. Explicit access-change authorization resolved the earlier blocker;
both test grants are now revoked.

| Client/surface         | Current documented path                                                                                                                                   | Pulpe acceptance                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatGPT web            | Developer mode, subject to account/workspace policy; connect an MCP endpoint through Plugins.                                                             | Pro: read/write consent, useful reads, a 25 CHF movement, deletion and revocation passed. A subsequent request required reconnection. Seven-tool read-only grant not exercised.                                                          |
| ChatGPT desktop/mobile | Do not infer support from web developer mode or from publication alone; verify the actual account, app version and directory availability.                | Not run; owner waived mobile acceptance on 2026-09-06.                                                                                                                                                                                   |
| Claude web             | Remote connectors are brokered through Anthropic's infrastructure; the server must be reachable there. Free accounts are limited to one custom connector. | Pro / Opus 5 High: read-only checks and read/write reconnection passed. All eight write tools succeeded; a fresh call after revocation required authentication. Together with earlier reads, all 15 tools have vendor success evidence.  |
| Claude macOS           | The installed application exposes separate Chat and Cowork modes.                                                                                         | Cowork current-month read passed (1.40609.1); Chat additional reads, three negative calls and a populated goal outlook passed (1.46388.4), on macOS 26.5.1. Every Chat call used one-time approval. Writes/revocation remain unverified. |
| Claude mobile          | Verify the actual mobile application/account; web and macOS evidence is insufficient.                                                                     | Not run; owner waived mobile acceptance on 2026-09-06.                                                                                                                                                                                   |
| Claude Code            | Remote MCP plugin/connection; package installation alone does not test authorization.                                                                     | Installed CLI 2.1.261 reports no authenticated account; OAuth/tool acceptance not run.                                                                                                                                                   |

The current [OpenAI connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)
uses Settings → Security and login → Developer mode, then Plugins → +. It does
not establish universal mobile availability. The public guide follows this setup
without promising unsupported surfaces.

[Claude's remote connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
documents supported plans and cloud-origin connections across clients. It does
not require creating a paid Team organization to test an individual connector.

## Non-production acceptance fixture

The explicitly approved fixture is now retired: Free Supabase project
`jsjfammxsqyglxlqzpsl`, test app https://pulpe-mcp-test.vercel.app and MCP endpoint
`https://backend-mcp-spike.up.railway.app/mcp`. Before deletion, Railway's final
security candidate `158574cf3` reached `SUCCESS`; a fresh remote HTTP
read/write/refresh/revoke and credential-boundary check passed.
Account `mcp-review-20260906@pulpe.test` contained only synthetic data:
one September 2026 budget, four forecasts, 2,400 available to spend and no movements.
Read acceptance also used one synthetic savings goal, target 1,000 CHF
and starting amount 200 CHF. All were removed with the dedicated test project.
See the [remote evidence](./verification-2026-09-05.md#remote-environment-and-client-readiness--updated-2026-09-06).

The user explicitly authorized browser association, synthetic writes and
revocation for this account only. ChatGPT used a read/write grant: initially
asking for no writes is not evidence of read-only authorization. Its successful
reads included the populated goal; its 25 CHF movement reduced available funds
to 2,375 CHF, then deletion restored 2,400 CHF.

Claude's former read-only grant was revoked before new read/write consent.
Creation, modification, checking and deletion of one movement passed, as did
month creation, forecast creation/update and spreading 100 CHF across October
and November. Expanded requests/results and independently reloaded Pulpe pages
were checked. One-time approvals were used; no approval policy was relaxed.
The movement and both newly created months were removed after the checks. The
remaining base fixture was subsequently deleted with the test environment.

Both grants were revoked in Pulpe. Fresh vendor calls then required reconnection
(ChatGPT) or authentication (Claude), with no new financial result. Pulpe showed
`No assistant connected`. See [the final vendor evidence](./verification-2026-09-05.md#vendor-readwrite-and-revocation-acceptance--2026-09-06).

These runs exposed two report-presentation defects: truncating a UTC timestamp
could label the previous calendar day, and unchecked items had no explicit
status. Source `6a4768443` fixes both and reached Railway `SUCCESS`. A fresh
Claude web read/add/read/delete/read/revoke sequence passed with the minuit
fixture, expanded tool results and independent Pulpe comparison. The fixture
movement was removed and the new grant revoked; no assistant remains connected.
See [the final regression evidence](./verification-2026-09-05.md#deployed-regression-and-release-checkpoint--2026-09-06).

Mobile, Claude Code and ChatGPT's seven-tool read-only grant remain unverified.
The owner explicitly waived mobile testing as a release gate; this is not a
claim of mobile availability. Earlier desktop reads do not prove desktop writes
or revocation behavior. Dependency remediation has passed local and deployed
checks: zero high/critical findings and no backend/web dependency paths remain;
four moderate and one low Android-only findings are explicitly recorded.

Follow [cutover.md](../../2026_09/2026_09_05_mcp-credential-isolation/cutover.md)
for the production handoff: target separation, approval gates, secrets/Dashlane,
legacy retirement, protected release order, branding and rollback. The approved
`v0.49.0` source is now deployed and MCP is enabled; the runbook records exact
deployment evidence. Owner-led production acceptance and the remaining
distribution gates are not yet complete. The owner authorized scoped test
cleanup after validation, a PR to `main`, monitoring/merge when safe, and
production setup through the protected release process.
The former ignored `.mcp-test` secrets and local test directories are archived in
the owner's private Trash, not active configuration. See the
[retirement evidence](./verification-2026-09-05.md#test-resource-retirement--2026-09-06).
Do not reuse those keys in production or put values in documentation or prompts.

On 2026-09-08, Maxime elected to perform production functional checks from his
own account. Use the [owner checklist and decision packet](../../2026_09/2026_09_05_mcp-credential-isolation/cutover.md#production-checks-for-maxime--pending).
No production client result or live branded listing is established yet. The
agent must not access that personal account or export its credentials; synthetic
security probes remain separately approved and do not replace owner acceptance.

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

Remote directory submissions require a Team or Enterprise organization and
directory-management access. This is a publisher requirement, not a requirement
for individual users to connect through the custom-install link. The owner
chose custom distribution on 2026-09-08; no organization purchase or remote
directory submission is planned under the current scope.
[Current submission access](https://claude.com/docs/connectors/building/submission).

The following directory requirements apply only if that distribution choice
changes with the owner's approval.

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

These are acceptance cases, not a claim that every prompt variant ran. The
client matrix and linked evidence identify the actual calls, approvals and
remaining limitations.

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
