# Review: deux pages de conseils en allemand suisse

- **Verdict**: approve
- **Diff**: `57b5536a410991b45f95baa30fa06575dd880021^..97b6d45adc31e9d6c8716e02703c3a7f5335748d`
- **Reviewed HEAD**: `97b6d45adc31e9d6c8716e02703c3a7f5335748d`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_18
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 1 — Chrome d’article localisable, registre DE à part

- [x] Un `ArticleLayout` sans `chrome` produit le même HTML contractuel qu’aujourd’hui (URL FR, dates FR, CTA FR) — `landing/components/guides/ArticleLayout.tsx:45` `landing/components/guides/chrome.ts:27` `landing/components/guides/ArticleLayout.test.tsx:128`
- [x] Avec `DE_GUIDE_CHROME`, JSON-LD `inLanguage` = `de-CH` et `url` contient `/de/budget-ratgeber/` — `landing/components/guides/chrome.ts:45` `landing/components/guides/ArticleLayout.test.tsx:316`
- [x] `DE_GUIDES` a deux slugs distincts de tout `GUIDES`. `getDeGuide` d’un slug inconnu jette — `landing/components/guides/guides.de.ts:3` `landing/components/guides/ArticleLayout.test.tsx:289`
- [x] `guideMetadata(guide)` sans chrome reste canonical `/conseils-budget/…` et `openGraph.locale` `fr_CH` — `landing/components/guides/guides.ts:110` `landing/components/guides/ArticleLayout.test.tsx:161`
- [x] `ArticleLayout.test.tsx` : « has a page for every registry entry » ne parcourt que `GUIDES` — `landing/components/guides/ArticleLayout.test.tsx:275`

### Phase 2 — Page comparatif Budget-App Schweiz

- [x] `generateStaticParams` pour `lang: "en"` et `"it"` est `[]`. Pour `"de"`, contient `beste-budget-app-schweiz` — `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:20` `landing/components/guides/ArticleLayout.test.tsx:359`
- [x] Metadata canonical = `/de/budget-ratgeber/beste-budget-app-schweiz`, sans `alternates.languages` à 4 langues — `landing/components/guides/guides.ts:124` `landing/components/guides/ArticleLayout.test.tsx:384`
- [x] H1 / title portent Budget-App et Schweiz. Le tableau compare au moins Pulpe et une autre app, critère Deutsch — `landing/components/guides/guides.de.ts:5` `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:106` `landing/components/guides/ArticleLayout.test.tsx:391`
- [x] Le HTML de la page contient une phrase de limite Pulpe (pas de synchro bancaire et/ou pas de ménage partagé) — `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:154` `landing/components/guides/ArticleLayout.test.tsx:402`
- [x] JSON-LD Article `inLanguage` = `de-CH`. Aucune occurrence de `Transaktion` dans le HTML article — `landing/components/guides/ArticleLayout.test.tsx:406` `landing/components/guides/ArticleLayout.test.tsx:411`

### Phase 3 — Page Prämien provisionner + câblage sitemap/footer

- [x] La page primes cite 393.30, 326.30 et 4,4 % à côté d’un lien bag.admin.ch. Angle = Rückstellung / provisionner — `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:196` `landing/components/guides/ArticleLayout.test.tsx:434`
- [x] Exemple 380/397/17/4 mois présent. Aucun `Transaktion`. Registre du — `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:228` `landing/components/guides/ArticleLayout.test.tsx:441`
- [x] Sitemap contient les deux URL `https://pulpe.app/de/budget-ratgeber/…` sans clé `alternates` — `landing/app/sitemap.ts:56` `landing/components/guides/ArticleLayout.test.tsx:471`
- [x] Footer DE montre les deux libellés allemands ; Footer FR/EN/IT ne les montre pas. `frenchOnly` inchangé — `landing/components/sections/Footer.tsx:40` `landing/app/accessibility.test.tsx:1867`
- [x] Les quatre `titleDefault` échouent un match `suisse|schweiz|swiss|svizzera` (insensible à la casse) — `landing/app/accessibility.test.tsx:1472` `landing/content/dictionaries/de.ts:9`
- [x] Chaque entrée `DE_GUIDES` est un `slug` de `generateStaticParams` pour `lang: "de"` — `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:23` `landing/components/guides/ArticleLayout.test.tsx:368`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | code | 2 | `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx:265` | Tout slug du registre autre que `beste-budget-app-schweiz` rend `PremiumsArticle` / `premiumsFaq`. Correct tant qu’il n’y a que deux entrées ; un troisième slug `DE_GUIDES` publierait le corps primes par défaut. | Dispatch explicite (`slug → body`) et `notFound()` si le slug n’a pas de corps. |
| 🟢 | rot | 1 | `landing/components/guides/ArticleLayout.tsx:23` | Le JSDoc de `dict` dit encore « L’article est français », alors que le chrome DE sert un article allemand. | Reformuler : `dict` suit la locale du chrome, pas toujours le FR. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (16/16)                                      |
| Files checked | `landing/app/[lang]/budget-ratgeber/[slug]/page.tsx`, `landing/app/accessibility.test.tsx`, `landing/app/sitemap.ts`, `landing/components/guides/ArticleLayout.test.tsx`, `landing/components/guides/ArticleLayout.tsx`, `landing/components/guides/RelatedGuides.tsx`, `landing/components/guides/chrome.ts`, `landing/components/guides/guides.de.ts`, `landing/components/guides/guides.ts`, `landing/components/sections/Footer.tsx`, `landing/lib/routes.ts` |
| Unchecked     | none |
| Unplanned     | none |
