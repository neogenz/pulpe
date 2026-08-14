# Review: PUL-296 — SEO/GEO foundation for `/conseils-budget`

- **Verdict**: approve
- **Diff**: `origin/preview...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Typed registry, article layout, and prose CSS

- [x] The registry exports a strictly typed array; required `updatedAt` values feed article metadata and sitemap freshness — `landing/components/guides/guides.ts:5-82`, `landing/app/sitemap.ts:18-22`
- [x] Prose keeps Poppins, a 65–75ch measure, underlined links, the warm background, and no glass or content animation — `landing/app/globals.css:13`, `landing/app/globals.css:75-77`, `landing/app/globals.css:558-617`
- [x] The shared layout renders one H1 and one primary CTA; visible FAQ content and `FAQPage` JSON-LD use the same data — `landing/components/guides/ArticleLayout.tsx:58-158`
- [x] Landing contracts fail on a second H1, CTA drift, divergent FAQ schema, or page-to-registry mismatch — `landing/components/guides/ArticleLayout.test.tsx:44-247`

### Phase 2 — `/conseils-budget` index and GEO-structured seed article

- [x] `/conseils-budget` lists the seed article from the registry, and every registry entry becomes an index card — `landing/app/conseils-budget/page.tsx:52-84`
- [x] The seed article has one H1, a direct answer, sourced figures, visible FAQ content equal to `FAQPage`, and one CTA — `landing/app/conseils-budget/comment-faire-son-budget-en-suisse/page.tsx:27-247`, `landing/components/guides/ArticleLayout.tsx:58-158`
- [x] The static export has the expected title, description, canonical, and server-rendered article content without client JavaScript — verified in `landing/dist/conseils-budget*.html`

### Phase 3 — Dynamic sitemap, Organization entity, and internal linking

- [x] The dynamic sitemap publishes static routes and all registered articles with registry-backed modification dates — `landing/app/sitemap.ts:8-23`
- [x] The root graph defines one Organization without unsupported `sameAs` claims, and site/article nodes reference it by `@id` — `landing/app/layout.tsx:154-192`, `landing/components/guides/ArticleLayout.tsx:49-56`
- [x] Every page footer exposes an internal “Conseils budget” link to `/conseils-budget` — `landing/components/sections/Footer.tsx:6-13`, `landing/components/sections/Footer.tsx:58-73`

### Phase 4 — Review corrections and merge validation

- [x] Index/article social metadata has one shared preview source and registry-backed article dates — `landing/lib/config.ts:12-14`, `landing/app/conseils-budget/page.tsx:9-49`, `landing/components/guides/guides.ts:40-82`
- [x] Organization claims, article interaction states, pull-quote semantics, and JSON-LD assertion scope are accurate and regression-tested — `landing/app/globals.css:609-617`, `landing/components/guides/ArticleLayout.test.tsx:79-166`
- [x] PR-added developer documentation is English; PR #602 metadata uses the final route, all 20 review threads are resolved, and GitHub reports `MERGEABLE`/`CLEAN`.
- [x] Landing tests, type-check, lint, the 9-page static export, exported metadata/JSON-LD inspection, root `pnpm quality`, Vercel, Claude review, CodeQL, and `✅ CI Success` pass.

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (14/14)                                                                                                                                                                                                                                                                                                          |
| Files checked | All files changed by `origin/preview...HEAD`; implementation focus: `config.ts`, `layout.tsx`, both `/conseils-budget` pages, `globals.css`, `sitemap.ts`, `guides.ts`, `ArticleLayout.tsx`, `ArticleLayout.test.tsx`, `accessibility.test.tsx`; all PR-added task documents; hosted PR metadata, threads, and checks |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                  |
| Unplanned     | Footer regrouping, header lifecycle hardening, and PUL-304 measurement notes — reviewed as coherent supporting changes                                                                                                                                                                                                |
