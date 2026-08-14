---
objective: "Pulpe has acquisition assets that compound over time (SEO articles, comparison pages, and a lead-magnet calculator) plus a ready-to-send distribution kit, without relying on a paid channel."
status: pending
---

# Plan: Growth — SEO and distribution assets for growing Pulpe awareness

## Overview

| Field      | Value                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Turn the “€0→€2M” playbook into assets AI can execute: SEO article foundation, competitor pages, budget calculator, evergreen guides, and an outreach kit |
| **Source** | Raw post “15 SaaS growth levers” supplied by Maxime, with a request to keep only work that can be completed autonomously                                  |

## Strategic scope

The July 2026 retention diagnosis says the wall is the first transaction, not acquisition: do not start mass marketing until transaction adoption reaches 40–50%. This plan is compatible because SEO takes three to six months to yield results. Build the assets **now** so they mature while retention improves. Burst levers such as Google Ads and Product Hunt are prepared but deferred.

**Facts validated through adversarial research (July 2026), 10 clusters, 16 agents:**

- **Measured baseline (PostHog project 87621, `$host='pulpe.app'`)**: about 28 pageviews over 30 days (about 16 visitors), about five organic pageviews per month, 70% direct. SEO KPIs will use **absolute values** (organic visitors per month), not percentages. The “Pulpe Landing” PostHog project (75556) is dormant and receives only the old domain; do not measure there.
- **The French SEO gap is real, but the window is closing**: BudgetHub (Innopulse GmbH, Zug) is already executing this exact playbook with French/German guides, a French `alternative-ynab-suisse` page (weak: about 400 words, no table, does not rank), and “vs” pages. Searches for “alternative à YNAB gratuite” and “remplacer YNAB” return only English listicles. This is time-sensitive.
- **“YNAB avis” is lost ground** (Mustachian Post is pro-YNAB and updated in July 2026, alongside French sites), so it was removed from the targets.
- **Health-premium seasonality is confirmed and dated**: FOPH announces the next premiums at the end of September each year (+4.4% for 2026, CHF 393.30 average, CHF 326.30 for ages 19–25); the 2027 increase has already been signaled (+3.7% from Comparis in May 2026, about 5% from FOPH). Publish the premium guide **before early September 2026**.
- **Every competitor claim in the comparison pages comes from its publisher** (YNAB pricing, free tiers for BudgetHub/Goodbudget/MoneyControl, and the free nonprofit BudgetCH); details are in phase 2.
- **Method caveat**: the SERPs were read from a US index. Verify them again from a Swiss locale (google.ch, fr-CH) before finalizing briefs (phase 2 task).

**Mapping the 15 levers to this plan:**

| Lever from the post                   | Verdict       | Where                                                                      |
| ------------------------------------- | ------------- | -------------------------------------------------------------------------- |
| 1. ICP + Facebook groups/communities  | Partial       | Phase 5 (communities verified against their actual rules; Maxime sends)    |
| 2. Lead magnets                       | ✅ Executable | Phase 3 (interactive budget calculator)                                    |
| 4. Listicles / external discovery     | Partial       | Phase 5 (verified targets and contacts, with drafted emails)               |
| 7. Competitor article (SEO gap)       | ✅ Executable | Phase 2 (comparison pages)                                                 |
| 10. Industry news articles            | ✅ Executable | Phase 4 (evergreen guides, with a dated health-premium angle)              |
| 12. Third-party platform launch       | Partial       | Phase 5 (AlternativeTo now/passive; Product Hunt prepared and deferred)    |
| 6. YouTube SEO, 14. Webinars          | ❌ Excluded   | Require filming or a human presence                                        |
| 5. Affiliate, 9. Commission reselling | ❌ Excluded   | Pulpe is free, so no commission is available                               |
| 11. Dormant-base re-engagement        | ❌ Deferred   | No email delivery infrastructure (Resend/Brevo); GDPR scope still required |
| 13. Google Ads                        | ❌ Deferred   | Requires budget and the retention gate                                     |
| 15. EdTech                            | ❌ Excluded   | Not relevant to a B2C budget planner                                       |
| 3. Beta test / pre-launch emails      | ❌ N/A        | Pulpe has already launched and is free                                     |

## Phases

| #   | Phase                                                      | File                         |
| --- | ---------------------------------------------------------- | ---------------------------- |
| 1   | SEO article foundation on the landing (`/conseils-budget`) | [`phase-1.md`](./phase-1.md) |
| 2   | Competitor comparison pages (SEO gap)                      | [`phase-2.md`](./phase-2.md) |
| 3   | Lead magnet: Swiss budget calculator                       | [`phase-3.md`](./phase-3.md) |
| 4   | French-speaking Switzerland evergreen guides (3 articles)  | [`phase-4.md`](./phase-4.md) |
| 5   | Distribution kit: listicles, communities, and directories  | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                                                                    | Verified                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| https://www.ynab.com/pricing                                                              | YNAB costs $14.99/month or $109/year, USD only (“Exchange rates are not reflected”), with no free tier and one currency per budget |
| https://www.budgethub.ch/fr/guides/alternative-ynab-suisse                                | A competing French page exists but is weak (about 400 words, no table, does not rank), confirming the ranking gap                  |
| https://budgethub.ch/preise                                                               | BudgetHub: free tier limited to two accounts, then CHF 6.90/11.90 per month; PWA; “Datenhaltung in der Schweiz, Compute in der EU” |
| https://apps.apple.com/fr/app/budgetch-app/id725506023                                    | BudgetCH is real, free, nonprofit (Budget-conseil Suisse), available in French, and updated in July 2025                           |
| https://goodbudget.com/signup                                                             | Goodbudget free tier: 20 envelopes, one account, two devices; paid tier $10/month; bank sync is US-only                            |
| https://www.bag.admin.ch/fr/newnsb/d2okh_kUK_OFhmMDfpyiy                                  | 2026 premiums: +4.4%, CHF 393.30 average, CHF 326.30 for ages 19–25 (FOPH announcement, September 23, 2025)                        |
| https://www.bfs.admin.ch/bfs/en.assetdetail.36195848.html                                 | Swiss median salary CHF 7,024/month (ESS 2024, published in 2025)                                                                  |
| https://www.moneyhaxx.ch/fr/calculateur                                                   | #1 for “calculateur budget suisse” is moneyhaxx; beatable on Romandy specifics, not authority                                      |
| https://alternativeto.net/faq                                                             | Maker submissions are allowed; account must be about one week old; claim ownership through support@alternativeto.net               |
| https://help.producthunt.com/en/articles/479581-can-i-post-my-own-product-on-product-hunt | Product Hunt officially permits self-posting; no hunter is required                                                                |
| https://forum.mustachianpost.com/guidelines                                               | Self-promotion is forbidden except in the dedicated monthly thread (last Wednesday), the only sanctioned Swiss slot                |
| https://web.archive.org/web/20250517120126/https://www.reddit.com/r/Suisse/               | r/Suisse rule 6 forbids advertising except for “public interest”; contact moderators first                                         |

## Decisions

| Decision                                                                    | Why                                                                                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| TSX article pages with a shared `Article` layout; no MDX or CMS             | No Markdown tooling is installed and the local TSX/data `changelog` pattern exists; add MDX only beyond 5–10 articles                 |
| Route `/conseils-budget` rather than `/blog`                                | Evergreen, search-oriented content rather than a dated feed; the route conveys value rather than freshness                            |
| `app/sitemap.ts` replaces `public/sitemap.xml` in the same PR               | Metadata routes work with `output: 'export'`; the stale static file would collide                                                     |
| No `pulpe-shared` dependency in the landing                                 | Onboarding uses three sums, while `getCurrencyFormatter` forces two decimals; inline adaptive `Intl.NumberFormat('de-CH')` is smaller |
| Absolute SEO KPIs in PostHog 87621 (`$host='pulpe.app'`)                    | At about 28 pageviews/month, percentages mislead; “Pulpe Landing” 75556 is dormant on the old domain                                  |
| Paid/burst levers deferred until transaction retention reaches at least 40% | Acquiring before retaining wastes traffic; SEO's delay lets both efforts mature together                                              |
