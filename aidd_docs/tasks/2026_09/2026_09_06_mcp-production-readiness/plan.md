---
objective: "One owner request can start an evidence-bound MCP production rollout through the existing protected release process, with explicit approvals, useful client checks and safe recovery."
status: in-progress
---

# Plan: MCP production readiness and launch

## Overview

| Field      | Value                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Prepare one launch dossier, then deploy, activate and verify the existing MCP without rebuilding the release system.                    |
| **Source** | Maxime's 2026-09-06 request: make everything ready for production to be carried through from one request, using AIDD Plan if necessary. |

The [cutover runbook](../2026_09_05_mcp-credential-isolation/cutover.md) remains the source of operational commands, target IDs, secret names and recovery. The [client matrix](../../2026_08/2026_08_23_pulpe-mcp-agent-connector/submission-checklist.md) remains the source of supported surfaces. This plan orders their remaining work; it does not supersede their safety gates.

Current checkpoint (2026-09-08): `v0.49.0` is published and MCP is activated on the same proven source after explicit owner approval. Phase 2 is complete; phase 3 remains in progress for owner-led ChatGPT/Claude acceptance, separately approved synthetic security checks and distribution. Exact deployment, approval and protected-secret backup state is recorded in the [current production evidence](../2026_09_05_mcp-credential-isolation/cutover.md#current-production-state--2026-09-08).

Historical pre-release checkpoint (2026-09-08): PR #725 is merged as `16facba9da1c80478d861b25e9cf481fb1576b63`. Its final feature SHA `352978f9b6930d01adf7b45aa6fcbd909773b808` has successful mandatory CI `34061854976` and Android `34061854974`; all 23 review threads are resolved. Claude review `34061854969` failed during execution and is not approval. At that point production was still published `v0.48.0`, SHA `7a22f34c55d8dc9c217089670a4e093b8bde5bd7`; no production write had occurred.

On 2026-09-08, Maxime approved adjusting this plan so that he performs normal production-account and assistant functional checks himself, and approved transmitting dependency metadata to npm for the production audit. The agent must provide the checklist and wait for actual results, not access his account or substitute historical test evidence. Credential-boundary probes remain synthetic-only and separately scoped. The requested official Pulpe logo in both vendors and four-language landing presentation remain launch deliverables; unsupported custom-connector branding and untested clients must be explicit.

After preparation PR #727 exposed mixed iOS/Android notes and Android E2E failed, Maxime approved correcting both points and replacing that preparation. Keep product `0.49.0`, iOS `1.6.0 (3)` and the approved four-language copy. Preserve the old release commit, close the unmerged preparation and recreate its branch without a force push only after the corrective PR reaches `main`. This approval does not authorize production publication or MCP activation.

One request means **one coordinated operation**, not bypassing GitHub approval or obtaining vendor acceptance automatically. Suggested future instruction: “Lance la mise en production MCP selon le dossier validé ; arrête-toi si le candidat, les cibles ou les contrôles diffèrent.” This starts the sequence; it does not pre-approve an unknown version, manifest, account, public exposure or legal attestation. Complete phases 1 and 2 before describing the system as ready to launch.

## Phases

| #   | Phase                                                              | File                         |
| --- | ------------------------------------------------------------------ | ---------------------------- |
| 1   | Close readiness gaps and collect the owner decision packet         | [phase-1.md](./phase-1.md)   |
| 1b  | Repair mobile release contracts and diagnose Android verification  | [phase-1b.md](./phase-1b.md) |
| 2   | Prepare the exact release and its read-only promotion manifest     | [phase-2.md](./phase-2.md)   |
| 3   | Publish disabled, activate, verify and prepare public distribution | [phase-3.md](./phase-3.md)   |

## Resources

| Source                                                                                                | Verified                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments | Protected jobs wait for reviewer approval; retain the repository's no-bypass setting.                  |
| https://supabase.com/docs/guides/auth/signout                                                         | Sign-out does not immediately invalidate already issued access JWTs.                                   |
| https://developers.openai.com/plugins/deploy/submission                                               | Production logo, identity, test cases and review precede directory publication.                        |
| https://claude.com/docs/connectors/building/submission                                                | Remote connector submission needs listing, authentication, reviewer access and policy acknowledgments. |

## Decisions

| Decision                                                                                                  | Why                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Reuse `release-promotion.yml`, its state resolver, exact-SHA proofs and the existing cutover runbook.     | A second deploy script would create another authority and recovery path.                          |
| Keep deployment, MCP activation and directory publication distinct.                                       | Enabling the issuer exposes public endpoints immediately; vendor review is externally controlled. |
| Preserve isolated MCP credentials, first-party encryption keys and forward-only migrations.               | Rollback must not restore the legacy credential bypass or destroy financial data.                 |
| Owner performs production functional acceptance; security probes use only approved synthetic credentials. | Personal-account checks do not authorize agent access, fixture seeding or credential export.      |
