---
objective: "Mesurer l'effet des actifs SEO en un clic : dashboard PostHog dédié, KPIs absolus, baseline notée (PUL-304)."
status: implemented
---

# PUL-304 — Mesure SEO (dashboard PostHog)

Tâche de configuration PostHog : aucun code, ce fichier est la trace. Exécutée le
2026-08-14 via le MCP PostHog, projet « Pulpe Webapp » (87621) — le seul qui reçoit
le trafic de pulpe.app.

## CA1 — Dashboard et insights

[SEO — pulpe.app](https://eu.posthog.com/project/87621/dashboard/895450) (dashboard 895450,
tags `seo`, `marketing`), 4 insights, tous filtrés `$host = 'pulpe.app'` + comptes
internes exclus :

| Insight | Contenu | Lien |
| --- | --- | --- |
| SEO · Pageviews par page (30 j) | `$pageview` total, breakdown `$pathname` | [akonbzcd](https://eu.posthog.com/project/87621/insights/akonbzcd) |
| SEO · Visiteurs par page (30 j) | `$pageview` visiteurs uniques, breakdown `$pathname` | [RnVQjpaa](https://eu.posthog.com/project/87621/insights/RnVQjpaa) |
| SEO · Referrers — organique vs direct (30 j) | `$pageview` total, breakdown `$referring_domain` | [8WNZNB6S](https://eu.posthog.com/project/87621/insights/8WNZNB6S) |
| SEO · Visiteurs organiques par mois (KPI) | visiteurs uniques mensuels, referrer moteur | [WalJF76O](https://eu.posthog.com/project/87621/insights/WalJF76O) |

`/guides/*` et `/calculateur-budget` apparaîtront d'eux-mêmes dans les breakdowns
`$pathname` dès leurs premiers pageviews — aucun tracking additionnel côté landing.

## CA2 — KPI absolu et baseline

- KPI : **visiteurs organiques/mois, en absolu** (pas en %).
- Organique = `$referring_domain` matche
  `google|bing|duckduckgo|ecosia|qwant|startpage|yahoo|perplexity|chatgpt|copilot`.
- Baseline notée sur le dashboard (tuile texte + description) : juillet 2026,
  ~28 pageviews/30 j, ~16 visiteurs, ~5 pv organiques/mois, 70 % direct.
- Série réelle du KPI à la création (fév→août 2026) : 1, 0, 7, 5, 6, 4, 4 (août partiel).

## Restant (hors de portée d'une session CLI)

- CA3 : vérifier la propriété Google Search Console de pulpe.app — exige le compte
  Google de Maxime (la meta verification est déjà dans `landing/app/layout.tsx`).
- CA4 : décision sur le projet dormant « Pulpe Landing » (75556) — archiver ou
  documenter pourquoi il reste.
- Ops post-merge PUL-296 : soumettre `https://pulpe.app/sitemap.xml` à Bing
  Webmaster Tools (ChatGPT search s'appuie sur l'index Bing) — compte Microsoft requis.
