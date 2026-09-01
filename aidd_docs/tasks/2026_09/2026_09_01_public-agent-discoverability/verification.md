---
status: in-progress
---

# Public agent discoverability verification

## Observation scope

| Field               | Evidence                                                          |
| ------------------- | ----------------------------------------------------------------- |
| Observed            | 2026-09-01 12:56–13:15 CEST                                       |
| Repository baseline | `7bfc66bf1455d151f01227d3a94a9a442583c85b`                        |
| Production origin   | `https://pulpe.app`                                               |
| Locale              | French, Switzerland                                               |
| Production commit   | `aefa93bd66cd45ebbfdc0aa474056c63d7e02a1a`, Vercel status `Ready` |

This report records public responses and repository checks only. Public search
results are not used as a substitute for Google Search Console or Bing
Webmaster Tools URL Inspection.

## Dashboard access

| Dashboard             | Result                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| Google Search Console | Connected to the verified URL-prefix property `https://pulpe.app/`       |
| Bing Webmaster Tools  | Connected; only `https://pulpe.app/` imported from Google Search Console |
| Vercel                | Connected to `pulpe-landing`; production deployment and commit verified  |
| PostHog               | Connected to project 87621 and dashboard `SEO — pulpe.app`               |

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

## Webmaster sitemap evidence

| Engine | Observed state                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------- |
| Google | `/sitemap.xml` submitted 2026-08-18, read 2026-09-01, successful, 30 pages discovered                   |
| Bing   | `/sitemap.xml` imported 2026-09-01, 0 errors, 0 warnings, status `Processing`, up to 48 hours announced |

## Priority URL index states

| URL                                                   | Google Search Console                         | Bing Webmaster Tools                                   |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `/`                                                   | Indexed; last crawl 2026-08-30 07:05          | Indexed; last crawl 2026-08-26 23:09; no SEO/GEO issue |
| `/about`                                              | Detected, currently not indexed; no crawl yet | Not discovered                                         |
| `/privacy`                                            | Unknown to Google; no crawl yet               | Not discovered                                         |
| `/support`                                            | Indexed; last crawl 2026-08-12 15:15          | Indexed; last crawl 2026-07-19 06:17; no SEO/GEO issue |
| `/conseils-budget`                                    | Unknown to Google; no crawl yet               | Indexed; last crawl 2026-07-19 06:17; no SEO/GEO issue |
| `/conseils-budget/meilleure-app-budget-suisse`        | Indexed; last crawl 2026-08-25 00:24          | Discovered 2026-09-01, not crawled                     |
| `/conseils-budget/alternative-ynab-suisse`            | Indexed; last crawl 2026-08-24 01:26          | Discovered 2026-09-01, not crawled                     |
| `/conseils-budget/comment-faire-son-budget-en-suisse` | Indexed; last crawl 2026-08-19 02:56          | Discovered 2026-09-01, not crawled                     |

Google selected each indexed page's declared canonical. Both engines reported
successful fetches, allowed crawling, and allowed indexing for every indexed
priority URL. The non-indexed states are discovery or provider-processing
states, not a repository-controlled robots, canonical, fetch, or response
defect.

## Manual indexing submissions

At 2026-09-01 13:25 CEST, the owner authorized both eligible Google requests.
Search Console acknowledged `Indexation demandée` for `/privacy` and
`/conseils-budget` and added each canonical URL to its priority crawl queue.
No request was sent for `/about`, which Google had already discovered, or to
Bing while the imported sitemap is processing. Google notes that repeated
submission does not improve queue priority.
