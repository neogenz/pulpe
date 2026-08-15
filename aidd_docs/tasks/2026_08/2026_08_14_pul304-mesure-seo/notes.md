---
objective: "Measure the effect of SEO assets in one click: dedicated PostHog dashboard, absolute KPIs, and a recorded baseline (PUL-304)."
status: implemented
---

# PUL-304 — SEO measurement (PostHog dashboard)

This was a PostHog configuration task with no code; this file is the record. It was completed on 2026-08-14 through the PostHog MCP in the “Pulpe Webapp” project (87621), the only project receiving pulpe.app traffic.

## AC1 — Dashboard and insights

[SEO — pulpe.app](https://eu.posthog.com/project/87621/dashboard/895450) (dashboard 895450, tags `seo`, `marketing`) contains four insights. All filter on `$host = 'pulpe.app'` and exclude internal accounts:

| Insight                                      | Content                                                 | Link                                                               |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| SEO · Pageviews par page (30 j)              | Total `$pageview`, broken down by `$pathname`           | [akonbzcd](https://eu.posthog.com/project/87621/insights/akonbzcd) |
| SEO · Visiteurs par page (30 j)              | Unique `$pageview` visitors, broken down by `$pathname` | [RnVQjpaa](https://eu.posthog.com/project/87621/insights/RnVQjpaa) |
| SEO · Referrers — organique vs direct (30 j) | Total `$pageview`, broken down by `$referring_domain`   | [8WNZNB6S](https://eu.posthog.com/project/87621/insights/8WNZNB6S) |
| SEO · Visiteurs organiques par mois (KPI)    | Monthly unique visitors from a search-engine referrer   | [WalJF76O](https://eu.posthog.com/project/87621/insights/WalJF76O) |

`/conseils-budget/*` (formerly `/guides`, renamed before any deployment) and `/calculateur-budget` will appear automatically in the `$pathname` breakdown after their first pageviews; no extra landing-side tracking is needed.

## Conversion funnels (same dashboard)

Two ordered funnels use a 14-day window over the last 30 days and exclude internal accounts:

| Funnel                          | Steps                                                                                                                                                                   | Link                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SEO · Guide → Premier budget    | `$pageview` (`$pathname` contains `/conseils-budget`) → `cta_clicked` (`cta_location = guide_article`) → `signup_started` → `signup_completed` → `first_budget_created` | [A6SztlQr](https://eu.posthog.com/project/87621/insights/A6SztlQr) |
| SEO · Visite organique → Signup | `$pageview` (organic referrer) → `cta_clicked` → `signup_completed`                                                                                                     | [9gWciHT0](https://eu.posthog.com/project/87621/insights/9gWciHT0) |

The first funnel remains empty until `/conseils-budget` is deployed (PUL-296); `guide_article` matches the article CTA's `data-cta-location`. The second already runs: the baseline is seven organic visitors → five CTAs → two signups during the 30 days before creation.

## AC2 — Absolute KPI and baseline

- KPI: **organic visitors/month, as an absolute value**, not a percentage.
- Organic means `$referring_domain` matches `google|bing|duckduckgo|ecosia|qwant|startpage|yahoo|perplexity|chatgpt|copilot`.
- Baseline recorded on the dashboard (text tile + description): July 2026, about 28 pageviews/30 days, about 16 visitors, about five organic pageviews/month, 70% direct.
- Actual KPI series at creation (February through August 2026): 1, 0, 7, 5, 6, 4, 4 (August partial).

## Remaining (outside a CLI session's scope)

- AC3: verify the pulpe.app Google Search Console property. This requires Maxime's Google account; the verification meta tag already exists in `landing/app/layout.tsx`.
- AC4: decide what to do with the dormant “Pulpe Landing” project (75556): archive it or document why it remains.
- Post-merge PUL-296 operations: submit `https://pulpe.app/sitemap.xml` to Bing Webmaster Tools because ChatGPT search relies on the Bing index. This requires a Microsoft account.
