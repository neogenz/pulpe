---
objective: "The landing publishes Swiss budget advice from /conseils-budget: adding an article to the registry publishes it in the index, sitemap, and structured data in a form optimized for both Google and AI answer engines (ChatGPT, Perplexity, AI Overviews)."
status: reviewed
---

# Plan: PUL-296 — SEO/GEO foundation for `/conseils-budget` on the landing

## Overview

| Field      | Value                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Typed registry + article layout + prose styles + dynamic sitemap + seed article, with 2026 GEO/AEO practices built into the foundation rather than added as a separate layer |
| **Source** | Linear ticket PUL-296 + spec `2026_07_23_growth-seo-assets/phase-1.md` (retrieved from the `pulpe-growth-axes-5075bf` worktree, not committed on `preview`)                  |

## GEO/AEO scope (August 2026 research)

The foundation serves two readers: the traditional Google crawler and AI answer engines.
What matters in practice, verified through dedicated research:

- **Already provided by the architecture**: complete static HTML from server rendering (`output: 'export'`), an allow-all robots.txt, and a CSP compatible with inline JSON-LD. Preserve these properties.
- **Built into the foundation**: a direct 40–80-word answer at the beginning of each article, question-shaped H2 headings, numbered steps, sourced Swiss figures, a visible FAQ strictly identical to its `FAQPage` JSON-LD, real `datePublished`/`dateModified` values, and an `Organization` entity linked to articles.
- **Deliberately excluded**: llms.txt (not used for discovery by any major engine according to Google's May 2026 position), AI crawler blocks in robots.txt, MDX, and a CMS.
- **Outside the codebase but required for ChatGPT visibility**: Bing indexing (ChatGPT search cites roughly 75–87% Bing results). Post-merge operations action: submit the sitemap to Bing Webmaster Tools.

## Phases

| #   | Phase                                                              | File                         |
| --- | ------------------------------------------------------------------ | ---------------------------- |
| 1   | Foundation: typed registry, article layout, and prose CSS          | [`phase-1.md`](./phase-1.md) |
| 2   | `/conseils-budget` index and GEO-structured seed article           | [`phase-2.md`](./phase-2.md) |
| 3   | Discoverability: dynamic sitemap, Organization entity, and linking | [`phase-3.md`](./phase-3.md) |
| 4   | Review corrections and merge validation                            | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                          | Verified                                                                                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| https://codersera.com/blog/llms-txt-complete-guide-2026/                        | llms.txt is not consumed by OpenAI, Google, or Anthropic for web discovery (Google guide, May 2026), so it is omitted   |
| https://gugubrand.com/en/blog/allow-ai-crawlers-robots-txt-guide/               | robots.txt posture: allow GPTBot, PerplexityBot, ClaudeBot, Google-Extended, and Bingbot; the current `*` rule does so  |
| https://www.clickrank.ai/how-to-get-indexed-in-chatgpt-search/                  | AI citation factors: 40–80-word answers, Q&A formatting, numbered steps, and fresh `dateModified` values                |
| https://ailabsaudit.com/blog/en/schema-markup-ai-visibility-guide/              | Useful 2026 JSON-LD types: FAQPage + Organization + Article linked in an `@graph`; schema must reflect the page         |
| https://www.shadow.inc/resources/how-to-rank-on-chatgpt                         | ChatGPT search depends on Bing indexing; server-rendered HTML is essential because JavaScript-only content is misparsed |
| https://www.relevantaudience.com/seo/ai-overview-impact-on-organic-search-2026/ | AI Mode (April 2026) reduces organic CTR; appearing in the generated answer matters more than traditional rank alone    |

> Exact figures from these sources (2.5x lift, FCP thresholds, and similar claims) come from SEO blogs and are directional rather than established facts.

## Decisions

| Decision                                                                                        | Why                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| TSX articles + a typed local registry, with no MDX or CMS                                       | Fewer than 10 articles; the existing `changelog` pattern already uses TSX + local data; no dependency is added             |
| `app/sitemap.ts` replaces `public/sitemap.xml`, removed in the same PR                          | Keeping both would create a route collision; metadata routes work with `output: 'export'` (verified in July 2026)          |
| No llms.txt                                                                                     | No major engine consumes it (Google, May 2026); maintaining it would add debt without a discovery signal                   |
| robots.txt remains `User-agent: * / Allow: /`                                                   | Blocking Google-Extended or GPTBot removes AI Overviews or ChatGPT visibility; the existing posture is already appropriate |
| The visible FAQ and `FAQPage` JSON-LD come from the SAME data source                            | Schema drift from visible content reduces trust; the shared layout prevents divergence by construction                     |
| `updatedAt` is required in the registry and feeds JSON-LD `dateModified` plus sitemap `lastmod` | One registry edit updates every article freshness signal                                                                   |
| One `Organization` entity lives in the root layout and article/site nodes reference it by `@id` | A single entity avoids duplication; `sameAs` remains absent until Pulpe has an unambiguous organization profile URL        |
| Social preview image and alt text live in the existing shared config module                     | Root, support, index, and article metadata must not drift when the versioned image changes                                 |
