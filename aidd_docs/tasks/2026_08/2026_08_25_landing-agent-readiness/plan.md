---
objective: "pulpe.app exposes accurate, cache-safe agent entry points, recoverable 404s, verifiable trust information, and a prerendered homepage while preserving the current human experience."
status: blocked
---

# Plan: improve landing readability for agents

## Overview

| Field      | Value                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Correct the site-controlled Is Agentic findings, prove the public responses, then reuse the existing SEO work for the brand finding. |
| **Source** | Is Agentic text report provided by Maxime on August 25, 2026 for `https://pulpe.app` (reported score: 73/100, seven findings).       |

## Phases

| #   | Phase                                        | File                         |
| --- | -------------------------------------------- | ---------------------------- |
| 1   | Markdown negotiation and agent instructions  | [`phase-1.md`](./phase-1.md) |
| 2   | Trust pages and Organization identity        | [`phase-2.md`](./phase-2.md) |
| 3   | Recoverable 404 and no-JavaScript HTML proof | [`phase-3.md`](./phase-3.md) |
| 4   | Brand activation and public verification     | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                               | Verified                                                                                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://acceptmarkdown.com/guides/accept-text-markdown               | `text/markdown` is the registered media type; preferences and `q` values must be honored.                                                            |
| https://acceptmarkdown.com/guides/vary-accept                        | Every negotiated Markdown response must advertise `Vary: Accept`, optionally with `Accept-Encoding`.                                                 |
| https://llmstxt.org/                                                 | Version 2 requires an H1, blockquote summary, untitled details, then link lists under H2 headings; it also recommends `alternate` and `describedby`. |
| https://nextjs.org/docs/app/api-reference/file-conventions/proxy     | A Next Proxy can negotiate on request headers, may be async, and can return a response directly.                                                     |
| https://github.com/vercel/next.js/issues/85999                       | Next 16 currently overwrites custom `Vary` values on final App Router HTML responses.                                                                |
| https://nextjs.org/docs/app/api-reference/file-conventions/not-found | `global-not-found.tsx` is the correct global 404 entry point for multiple root layouts and preserves a 404 status.                                   |
| https://schema.org/Organization                                      | `contactPoint` accepts a `ContactPoint` and `address` a `PostalAddress`.                                                                             |
| https://vercel.com/docs/project-configuration/vercel-json            | Vercel headers and routes can be verified in preview without replacing existing security rules.                                                      |
| https://pulpe.app/                                                   | Verified August 25, 2026: `200 text/html`, same body for `Accept: text/markdown`, no `Vary`.                                                         |
| https://pulpe.app/llms.txt                                           | Verified August 25, 2026: 404.                                                                                                                       |
| https://pulpe.app/this-path-does-not-exist-agent-audit               | Verified August 25, 2026: real HTML 404, but recovery links only to the homepage and app.                                                            |

## Decisions

| Decision                                                                                         | Why                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replace the pure export with statically rendered Next pages plus a Proxy limited to public paths | A static Vercel matcher cannot correctly rank every `q` value and `q=0`; Proxy provides compliant negotiation while pages remain prerendered.                                                                                                      |
| Serve negotiated Markdown directly from Proxy and keep the native Next build                     | Direct responses preserve `Vary: Accept, Accept-Encoding` for Markdown, 404, and 406 without patching private Next internals. Final HTML keeps Next's RSC `Vary` tokens; the upstream omission of `Accept` is recorded rather than falsely hidden. |
| Do not “add SSR” to the homepage                                                                 | Production already delivers 6,000+ characters, an H1, and an H1/H2/H3/H4 hierarchy in raw HTML; a regression test is appropriate, not an unnecessary rendering migration.                                                                          |
| Publish `/about` and `/privacy` in French without replacing the app's complete policy            | The audit checks root trust anchors on `pulpe.app`; the Angular policy remains the detailed legal document and the new page links to it explicitly.                                                                                                |
| Reuse the existing SEO kit instead of creating a second campaign                                 | `2026_07_23_growth-seo-assets` already contains targets, messages, directories, and rules; brand rank then depends on external action and time.                                                                                                    |
