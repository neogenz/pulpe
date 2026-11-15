# Review: Dependabot merge triage

- Rounds: 10
- Started: 2026-10-27

## Round 1 · r-0319

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/793
- Diff: `910dc2d72059cb4258e088ef9ed58eadd69d7f18...c648a0be81cc764881f7f489e73f0dc6f8a37b54`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Merged as a13b8998244078b139f1c5596da7889dc595d6ff. Required CI succeeded on the reviewed head. Upstream runtime changes only bump the installed Claude version; action inputs remain compatible.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 2 · r-031a

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/794
- Diff: `c4c3d042186f72559939444a721d9564784bba14...c3996b7652384af08ae6d697738e3ee0395d3747`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Merged as 7f77587a769c5ca82b57593145d28dc10757096f. Required CI succeeded. Existing app-id, private-key, owner and repositories inputs remain supported; token scope is unchanged.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 3 · r-031b

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/795
- Diff: `ccba3cf291588f09c116360f046088621bdf249c...29c77e733eaa086346b3ea3c92350e9c785ec62e`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Merged as 310a77b8bdcf0b2b35a79c645a611afb8882fb42. Required CI succeeded. Ruby remains pinned to 3.4.8; upstream changes cover platform releases and version diagnostics.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 4 · r-0318

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/792
- Diff: `c4c3d042186f72559939444a721d9564784bba14...a2ae21cc906ec8fdfb876d8158b76df0a0a55d92`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Merged as ed838c9a3cce5228090798a0a6a0fd6866afa202. Required CI, builds and web E2E succeeded. Optional Maestro failed before testing because MAESTRO_EMAIL is unavailable to Dependabot; no credentials were changed.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 5 · r-0317

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/791
- Diff: `910dc2d72059cb4258e088ef9ed58eadd69d7f18...4abca07b0cb1d92f592a411af5f8bb2380227ff8`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Static review passed. Old required CI failed at Expo version alignment, unrelated to artifact upload. Updated from main to 2554bd058fa90895f04bae5f5477507f047e015b; fresh CI pending. Do not merge before fresh checks pass.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 6 · r-02f9

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/761
- Diff: `15d2d1d5c304ac223028739b7273ecd8e4654376...cdb150b1914becad35f05582fc5196b0876576dd`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Static review passed. Compression patch includes upstream security fixes and stream cleanup. Reviewed all lockfile changes, including Android tooling patch resolutions. Old required CI passed; optional Maestro lacked MAESTRO_EMAIL. Updated from main to 8d3558dea7c94d0209c74653b13f40a05df9e719; fresh CI pending.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 7 · r-032f

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/815
- Diff: `0e1b64afa587cd7794403883c01ac0458e0e545c...ebdf8036de838f42289199de99248bf3c3dec1ac`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored (no implementation plan)
- Evidence: Static review passed. Pulpe uses the SDK server and a custom OAuth provider, not the affected HTTP client redirect flow or SDK client token store. Reviewed transitive Express, Hono, jose and parser updates. Old required CI and web E2E passed; optional Maestro lacked MAESTRO_EMAIL. Updated from main to ea65fdbdc36d45c9d2222e09d1e8be6962537e4a; fresh CI pending.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

None.

## Round 8 · r-0328

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/808
- Diff: `2277594db3a08f4125b10db144245c39d8ada1a7...c77f6a9e6b92d3de3b454011215f706ddad63f33`
- Axes: code, relevancy
- Verdict: changes-requested
- Score: not scored (no implementation plan)
- Evidence: Left open. Manifest-only update also fails frozen-lockfile installation.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

- `frontend/package.json:55` : router 22.2.1 requires Angular common/core/platform-browser 22.2.1, while the workspace pins them to 22.2.0; the lockfile is also unchanged → update the Angular set together with its lockfile — 🟡 major, conform

## Round 9 · r-0329

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/809
- Diff: `0e1b64afa587cd7794403883c01ac0458e0e545c...9367a9c6263107756fd7277ff33eac1df63ad0a1`
- Axes: code, relevancy
- Verdict: changes-requested
- Score: not scored (no implementation plan)
- Evidence: Left open despite green CI: it duplicates #808 and preserves incompatible peer versions.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

- `pnpm-lock.yaml` : router 22.2.1 declares exact 22.2.1 peers, but its snapshot resolves common/core/platform-browser 22.2.0 → align the Angular set before merging — 🟡 major, conform

## Round 10 · r-0340

- Date: 2026-10-27
- By: Codex
- PR: https://github.com/neogenz/pulpe/pull/832
- Diff: `ddea3964c3dcf30e7bdeaf269fc761efcd57b6ff...8a48c2e6abaa2693cb4fcf692330c3fd1df141a3`
- Axes: code, relevancy
- Verdict: changes-requested
- Score: not scored (no implementation plan)
- Evidence: Left open. Classify Changes fails with ERR_PNPM_OUTDATED_LOCKFILE; previews also fail. Shared remains on Zod 4.1.13.
- Review state: no unresolved review threads at inspection; no requested changes on merged candidates.

### Findings

- `android/package.json:69` : Zod changes to 4.6.6 without updating the workspace lockfile → produce a consistent lockfile and validate the Android/shared schema boundary — 🟡 major, conform

Static approval does not authorize merging a candidate whose fresh mandatory checks are pending or failing. No production release, App Store submission, secret change or runtime browser/device test was performed.

