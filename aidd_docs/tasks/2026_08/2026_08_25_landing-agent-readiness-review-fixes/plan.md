---
objective: "The landing agent-readiness change set satisfies every repository-controlled review criterion, records repeatable local and preview evidence, and leaves credential-gated production work explicit."
status: in-progress
---

# Plan: close the landing agent-readiness review

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Correct the factual and protocol mismatches, replace false build assurance with final-response evidence, restore repository conventions, and verify the promoted result. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/review.md` (`changes-requested`, 2026-08-25). |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Align public contracts and factual claims | [`phase-1.md`](./phase-1.md) |
| 2   | Replace the ineffective header patch with final-response verification | [`phase-2.md`](./phase-2.md) |
| 3   | Restore documentation and comment conformity | [`phase-3.md`](./phase-3.md) |
| 4   | Promote, verify, and rescan the public site | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://acceptmarkdown.com/guides/vary-accept | Every negotiated Markdown response must vary on `Accept`; compression may add `Accept-Encoding`. |
| https://nextjs.org/docs/app/api-reference/file-conventions/proxy | `proxy.ts` is the Next 16 convention, may be async, can return a response directly, and can exclude static files through its matcher. |
| https://github.com/vercel/next.js/issues/85999 | Next 16 currently overwrites custom `Vary` values on final App Router HTML responses. |
| https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation | Protected previews can be checked with `x-vercel-protection-bypass` supplied from a secret. |
| https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository | Without a tracked license, default copyright applies and reuse rights must not be advertised. |
| https://support.google.com/webmasters/answer/12482179?hl=en | URL Inspection and indexing requests require verified Search Console access. |

## Decisions

| Decision | Why |
| -------- | --- |
| Remove unsupported MIT and self-hosting claims instead of adding a license | Licensing is an owner/legal decision; correcting copy is safe and matches the repository today. |
| Delete the compiled Next runtime patch and restore the native build | The patch does not change Vercel's final HTML response, couples the build to private internals, and creates false confidence. |
| Return negotiated Markdown directly from Proxy after loading the existing static file | The final static rewrite discards `Accept` from `Vary`; a direct response preserves the cache key without duplicating the Markdown source or adding a conflicting route. |
| Treat exact `Vary` on negotiated Markdown/404/406 responses as the supported contract and record final HTML `Vary` as an upstream limitation | A custom HTML renderer or CDN response transform is disproportionate until Next resolves the defect or the owner chooses infrastructure work. |
| Use one dependency-free HTTP verifier for local, preview, and production | Node's built-in `fetch` covers the matrix and avoids another test service or package. |
| Promote only through `preview` and the human-approved release flow to `main` | This preserves the repository's existing deployment controls and exact-SHA evidence. |
