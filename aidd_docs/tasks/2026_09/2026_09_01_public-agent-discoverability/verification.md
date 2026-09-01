---
status: blocked
---

# Public agent discoverability verification

## Observation scope

| Field               | Evidence                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| Observed            | 2026-09-01 12:56 CEST                                                               |
| Repository baseline | `7bfc66bf1455d151f01227d3a94a9a442583c85b`                                          |
| Production origin   | `https://pulpe.app`                                                                 |
| Locale              | French, Switzerland                                                                 |
| Production commit   | Not exposed by the public response; authenticated Vercel deployment access required |

This report records public responses and repository checks only. Public search
results are not used as a substitute for Google Search Console or Bing
Webmaster Tools URL Inspection.

## Reproduction and automated results

| Command                                                                 | Result               |
| ----------------------------------------------------------------------- | -------------------- |
| `pnpm --filter pulpe-landing test`                                      | 137 passed, 0 failed |
| `pnpm test:public-surface`                                              | 6 passed, 0 failed   |
| `pnpm --filter pulpe-landing verify:agents -- https://pulpe.app --json` | 13 passed, 0 failed  |

The production verifier covered HTML GET and HEAD, Markdown GET and HEAD,
weighted negotiation, wildcard HTML, localized and unsupported `406`
responses, HTML and Markdown `404` responses, and `robots.txt`. Negotiated
Markdown and error responses returned `Vary: Accept, Accept-Encoding`. The
known Next.js limitation remains confined to final HTML responses, which keep
their native RSC cache keys.

## Priority canonical set

| URL                                                                    | Recommendation-relevant role                          |     HTTP | Canonical | Sitemap |  H1 |
| ---------------------------------------------------------------------- | ----------------------------------------------------- | -------: | --------- | ------- | --: |
| `https://pulpe.app`                                                    | Annual budget projection without bank synchronization | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/about`                                              | Creator, purpose, and business legitimacy             | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/privacy`                                            | Data handling and privacy trust                       | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/support`                                            | Product fit, help, currencies, and contact            | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/conseils-budget`                                    | Budget-planning topic index                           | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/conseils-budget/meilleure-app-budget-suisse`        | Swiss budget-app comparison                           | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/conseils-budget/alternative-ynab-suisse`            | Swiss YNAB alternative                                | 200 HTML | Exact     | Yes     |   1 |
| `https://pulpe.app/conseils-budget/comment-faire-son-budget-en-suisse` | Swiss annual-budget guidance                          | 200 HTML | Exact     | Yes     |   1 |

The raw homepage response contained one H1 followed by H2, H3, and H4 sections
without a skipped heading level. Its H1 was visible in the server response, and
the landing test independently asserted more than 500 visible characters
without JavaScript.

## Machine-readable and trust surfaces

| Surface              | Public result                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/llms.txt`          | 200 `text/plain; charset=utf-8`, 1,992 characters, `When to use Pulpe` and sitemap link present                           |
| `/index.md`          | 200 `text/markdown; charset=utf-8`, 1,622 characters                                                                      |
| `/sitemap.xml`       | 200 `application/xml`, 9,166 characters                                                                                   |
| `/robots.txt`        | 200 `text/plain; charset=utf-8`, generic crawler access allowed and sitemap declared                                      |
| Organization JSON-LD | Parsed Organization with contact email, contact type, support URL, four languages, and country-only Swiss `PostalAddress` |

The generic `User-agent: *` rule allows `/`, so Googlebot, Bingbot, and
OAI-SearchBot are not denied by the published robots policy. Sitemap receipt or
processing still requires the relevant webmaster console.

## Index coverage blocker

| URL set                 | Google state                                                  | Bing state                                                                      |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| All eight priority URLs | Unavailable: verified Search Console property access required | Unavailable: verified or imported Bing Webmaster Tools property access required |

Only an authorized property owner can now:

1. Inspect every priority URL and record coverage reason and last crawl in
   Google Search Console.
2. Confirm sitemap processing and URL Inspection for the same URLs in Bing
   Webmaster Tools.
3. Request indexing only for canonical URLs that are neither indexed nor
   already queued.

Phase 2 was not started because it changes third-party state and requires
explicit approval of each submission. Phase 3 was not started because its
comparable follow-up observation is due 30 days after the approved citation
work.
