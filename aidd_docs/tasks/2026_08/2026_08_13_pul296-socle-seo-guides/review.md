# Review: PUL-296 — SEO/GEO foundation for `/conseils-budget`

- **Verdict**: approve
- **Diff**: `origin/preview...working tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Typed registry, article layout, and prose CSS

- [x] The registry is strictly typed and fails loudly when a page and registry entry drift apart — `landing/components/guides/guides.ts:5-37`
- [x] The shared layout renders one H1 and one primary CTA; visible FAQ content and `FAQPage` JSON-LD use the same data — `landing/components/guides/ArticleLayout.tsx:58-158`
- [x] Article contracts cover headings, CTA count, structured data, dates, and page-to-registry parity — `landing/components/guides/ArticleLayout.test.tsx:44-235`

### Phase 2 — `/conseils-budget` index and GEO-structured seed article

- [x] The index owns complete Open Graph and Twitter metadata with its canonical route and the shared social preview — `landing/app/conseils-budget/page.tsx:9-49`
- [x] Article Open Graph metadata exposes registry publication and modification dates — `landing/components/guides/guides.ts:40-82`
- [x] The seed article is server-rendered, uses live official Swiss sources, and presents the Pulpe pull quote without quotation semantics — `landing/app/conseils-budget/comment-faire-son-budget-en-suisse/page.tsx:27-114`, `landing/app/conseils-budget/comment-faire-son-budget-en-suisse/page.tsx:232`

### Phase 3 — Dynamic sitemap, Organization entity, and internal linking

- [x] The dynamic sitemap publishes static routes and all registered articles with registry-backed modification dates — `landing/app/sitemap.ts:8-23`
- [x] The root graph defines one Organization without unsupported `sameAs` claims, and site/article nodes reference it by `@id` — `landing/app/layout.tsx:154-192`, `landing/components/guides/ArticleLayout.tsx:49-56`
- [x] Shared social preview data lives in the existing config module and is reused by all metadata producers — `landing/lib/config.ts:12-14`

### Phase 4 — Review corrections and merge validation

- [x] Article links have explicit hover and keyboard-focus feedback while retaining the global focus outline — `landing/app/globals.css:609-617`
- [x] The JSON-LD assertion describes `ArticleLayout`'s actual scope, and regressions for metadata, Organization claims, link states, and pull-quote semantics are covered — `landing/components/guides/ArticleLayout.test.tsx:79-164`
- [x] PR-added developer documentation and comments are English; deliberate French product copy remains French.

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified      | 100% (12/12)                                                                                                                                                                                                                                                                         |
| Files checked | All files changed by `origin/preview...working tree`; implementation focus: `config.ts`, `layout.tsx`, both `/conseils-budget` pages, `globals.css`, `sitemap.ts`, `guides.ts`, `ArticleLayout.tsx`, `ArticleLayout.test.tsx`, `accessibility.test.tsx`; all PR-added task documents |
| Unchecked     | Hosted PR metadata, review-thread resolution, and post-push CI — external delivery steps pending before the final mergeability verdict                                                                                                                                               |
| Unplanned     | none                                                                                                                                                                                                                                                                                 |
