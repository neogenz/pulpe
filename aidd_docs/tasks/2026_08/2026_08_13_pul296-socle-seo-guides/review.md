# Review: PUL-296 — Socle SEO/GEO `/guides`

- **Verdict**: approve
- **Diff**: `origin/preview...maximedesogus/pul-296-creer-le-socle-seo-guides-sur-la-landing`
- **Axes run**: code, functional, relevancy (deux passes agent indépendantes + trace fonctionnelle)
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 3 minor

## Phases

### Phase 1 — Socle : registre typé, layout article, prose CSS

- [x] Registre typé strict, `updatedAt` obligatoire — `landing/components/guides/guides.ts:6-15`
- [x] Prose Poppins seul, mesure 65–75ch (70ch), liens soulignés, fond chaud, sans glass ni animation de contenu — `landing/app/globals.css:558-651`
- [x] H1 unique, un seul CTA primaire, JSON-LD FAQ identique mot pour mot à la FAQ visible (même prop `answer: string`) — `landing/components/guides/ArticleLayout.tsx:51-63,89`
- [x] `pnpm test` passe et casse sur second H1, FAQ divergente ou FAQ retirée du visible (le test exclut le script ld+json avant de vérifier le rendu) — `landing/components/guides/ArticleLayout.test.tsx:54-101` (run : 85/85)

### Phase 2 — Index `/guides` + article seed GEO-structuré

- [x] `/guides` liste depuis le registre, une entrée suffit pour une carte ; toute entrée sans page casse le test (garde anti-404 index/sitemap) — `landing/app/guides/page.tsx:17-62`, `ArticleLayout.test.tsx:136-145`
- [x] Article en build prod : H1 unique (grep dist = 1, re-testé sur la vraie page), réponse 40–80 mots en tête, chiffres OFS/OFSP/Budget-conseil sourcés en liens, FAQ visible ≡ FAQPage (parse dist), un seul CTA — `landing/app/guides/comment-faire-son-budget-en-suisse/page.tsx`, `ArticleLayout.test.tsx:128-134`
- [x] title/description/canonical corrects dans `dist/` (via `guideMetadata`), contenu entier dans le HTML serveur — `landing/components/guides/guides.ts:44-90`

### Phase 3 — Découvrabilité : sitemap dynamique, Organization, maillage

- [x] `dist/sitemap.xml` : 5 pages statiques + article avec `lastmod` = `updatedAt` (2026-08-13) ; `public/sitemap.xml` supprimé — `landing/app/sitemap.ts`
- [x] JSON-LD racine : `Organization` + `sameAs` (GitHub, App Store), référencée par `publisher` de l'article via la constante partagée `ORGANIZATION_ID` (parse dist : le `@id` résout) — `landing/lib/config.ts:12-15`, `landing/app/layout.tsx:148-157`
- [x] Footer de toutes les pages : lien interne « Guides » (grep dist : 4/4 pages) — `landing/components/sections/Footer.tsx:14`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 2 | `landing/components/guides/guides.ts:33-37` | `SOCIAL_PREVIEW_IMAGE`/`ALT` restent copiés dans layout.tsx, modeles-et-budgets et ici : bump `?v=3` = 3 sites à toucher. Copie assumée : le test a11y (l.1102) exige la déclaration DANS layout.tsx | Accepté en l'état ; centraliser si le contrat a11y évolue |
| 🟢 | frontend | 2 | `landing/app/globals.css:648` | `.table-scroll` ne défile jamais avec le tableau actuel (2 colonnes étroites) et n'a pas de `tabIndex` clavier | Gardé : conteneur exigé par le plan (phase 1) ; ajouter `tabIndex={0}` + label le jour où un tableau déborde réellement |
| 🟢 | fit | 3 | `landing/components/sections/Footer.tsx:14` | « Guides » (→ /guides) coexiste avec la section « Guides pour utiliser Pulpe » de /support : deux sens du mot dans le même parcours | Décision produit à trancher (renommer la section support, copy antérieure à cette PR) |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (10/10)                                      |
| Files checked | guides.ts, ArticleLayout.tsx, ArticleLayout.test.tsx, globals.css, guides/page.tsx, comment-faire-son-budget-en-suisse/page.tsx, sitemap.ts, layout.tsx, accessibility.test.tsx, Footer.tsx, Platforms.tsx, config.ts, package.json, dist/ (article, index, sitemap.xml, 4 pages footer) |
| Unchecked     | none                                              |
| Unplanned     | Durcissements issus des deux passes de revue : FAQ visible prouvée hors ld+json, garde registre↔page, vraie page testée (H1/CTA), sources guides enregistrées dans accessibility.test.tsx (skip-link, transition-all, tirets), `SITE_URL`/`ORGANIZATION_ID` partagés, `guideMetadata`/`getGuide`, montants alignés sur lib/amount.ts (`7’024 CHF`), `formatDate` en UTC, espace fine insécable avant « ? » (7 sites), `image` + publisher typé au JSON-LD Article, back-link vers /guides, `text-wrap: pretty` sur la prose, hairline en `color-mix`, classe `group` morte retirée ; `lib/config.ts` normalisé prettier (pré-existant) ; commit de préservation `aidd_docs/tasks/2026_07/2026_07_23_growth-seo-assets/` (demande explicite hors plan) |
