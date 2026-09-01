---
objective: "Pulpe's public site has verified Google, Bing, and ChatGPT-search discovery, consistent independent citations, and a repeatable measure of whether assistants recommend it for its real use cases."
status: in-progress
---

# Plan: improve public discovery and recommendation by AI assistants

## Overview

| Field      | Value                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Close the remaining discovery and authority gap without rebuilding the agent-facing HTTP and content work already live on `pulpe.app`.                 |
| **Source** | User-provided Ora findings and the clarified 2026-09-01 objective: public assistants should understand, cite, and recommend Pulpe to the right people. |

## Phases

| #   | Phase                                 | File                         |
| --- | ------------------------------------- | ---------------------------- |
| 1   | Prove crawlability and index coverage | [`phase-1.md`](./phase-1.md) |
| 2   | Earn consistent independent citations | [`phase-2.md`](./phase-2.md) |
| 3   | Measure assistant recommendations     | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                       | Verified                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://pulpe.app/                                                           | On 2026-09-01, the raw HTML exposed the product narrative and headings, and the repository production verifier passed its complete HTML, Markdown, 404, 406, and robots matrix. |
| https://help.openai.com/en/articles/12627856                                 | ChatGPT summaries and citations require crawl access for `OAI-SearchBot`; ChatGPT referral links include `utm_source=chatgpt.com`.                                              |
| https://developers.google.com/search/docs/fundamentals/ai-optimization-guide | Google generative search uses the normal Search index and prioritizes technical SEO plus unique, useful content; extra AI files and artificial GEO tactics are not required.    |
| https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed                       | Bing Webmaster Tools accepts the existing XML sitemap and reports discovery and processing errors per sitemap.                                                                  |
| https://www.bing.com/webmasters/help/add-and-verify-site-12184f8             | A verified Google Search Console property can be imported into Bing together with its sitemap, avoiding a second verification implementation.                                   |

## Decisions

| Decision                                                                                                                                               | Why                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do not change landing product code unless Google or Bing diagnostics expose a concrete crawl, canonical, or index defect.                              | The existing implementation already has server-rendered content, recoverable 404s, Markdown negotiation, `llms.txt`, trust pages, structured data, a sitemap, and passing tests in production. |
| Judge success with relevant unbranded use cases, canonical citations, and factual accuracy rather than the Ora score or the clean `Pulpe` query alone. | `Pulpe` is a common noun, while the desired behavior is a recommendation to people seeking annual budget planning without bank synchronization.                                                |
| Reuse the existing SEO pages, PostHog dashboard, and outreach kits.                                                                                    | Rebuilding content infrastructure or a second distribution campaign would duplicate `2026_07_23_growth-seo-assets`, PUL-296, PUL-304, and the August agent-readiness work.                     |
| Keep external submissions and outreach behind explicit owner approval and real account access.                                                         | Search Console, Bing, directories, and editorial messages change external state and cannot be completed or represented truthfully without the owner's credentials and consent.                 |
