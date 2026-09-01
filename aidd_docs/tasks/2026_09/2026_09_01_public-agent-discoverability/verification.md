---
status: in-progress
---

# Public agent discoverability verification

## Observation scope

| Field               | Evidence                                                          |
| ------------------- | ----------------------------------------------------------------- |
| Observed            | 2026-09-01 12:56–14:16 CEST                                       |
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

## Article author identity

The Article JSON-LD now identifies `Maxime De Sogus` with the canonical
`https://pulpe.app/about` URL. This follows Google's current Article guidance,
which recommends an `author.url` or `author.sameAs` value that uniquely
identifies the author. Visible article content and design are unchanged.

| Check                                       | Result                |
| ------------------------------------------- | --------------------- |
| `pnpm --filter pulpe-landing test`          | 137 passed, 0 failed  |
| `pnpm --filter pulpe-landing type-check`    | Passed                |
| `git diff --check`                          | Passed                |
| Article author name, type, and `/about` URL | Asserted by unit test |

## Independent citation activation

### AlternativeTo

The target rules and duplicate search were revalidated on 2026-09-01. The
search suggestions contained similarly named products but no Pulpe listing.
The owner connected an existing AlternativeTo account through GitHub after
AlternativeTo rejected new Google sign-ups.

Pulpe was submitted on 2026-09-01 with these public facts:

- canonical website: `https://pulpe.app`;
- platforms: Online and iPhone;
- pricing: Free;
- languages: English, French, German, and Italian;
- source classification: Source available, with no licence selected;
- source URL: `https://github.com/neogenz/pulpe`;
- author: Maxime De Sogus, Switzerland, linked to `https://pulpe.app/about`;
- alternatives: Actual Budget and You Need A Budget.

Final submitted description:

> Pulpe is a free budget app for planning the year ahead. Set up a typical
> month, place taxes, holidays and large expenses in the right months, and see
> what will be left each month. No bank connection. Available on the web and
> iPhone, with CHF and EUR support. Pulpe is available in French, English,
> German and Italian. Its source code is public.

State: waiting for review. AlternativeTo says the backlog can take a few
months and that only the owner can currently see the candidate page at
`https://alternativeto.net/software/pulpe/about/`. No paid priority was used,
and the private candidate URL must not be promoted until approval.

### Les Pépites Tech

The current free Starter offer and submission form were revalidated on
2026-09-01. The Google consent screen exposed only the owner's name, profile
photo, and email address. OAuth created the account, although the site's nested
destination produced a malformed 404 before the authenticated submission form
was opened directly.

The owner completed the free listing with the canonical URL, French and English
descriptions, `Finance / FinTech`, active maturity, `French Tech Switzerland`,
the App Store URL, a promotional image, and the Pulpe logo. The platform
rejected the initial 306-character short description because its limit is 255
characters; the owner shortened it before submission.

Submission was confirmed at 2026-09-01 14:11 CEST on
`https://lespepitestech.com/content-final`. The page says the request will be
reviewed and that Les Pépites Tech will contact the owner. No public profile URL
has been issued yet, so the listing remains pending review. No paid offer or
newsletter opt-in was accepted.

### Editorial contacts

The current contact rules and target articles were revalidated on 2026-09-01:

- The Poor Swiss: `https://thepoorswiss.com/no-need-to-pay-budgeting-app/` and
  `https://thepoorswiss.com/contact-me/`;
- Jowi: `https://www.jowi.fr/application-gestion-budget/` and
  `https://www.jowi.fr/contact/`.

At 2026-09-01 14:13 CEST, the owner explicitly authorized sharing the contact
email with both targets and sending the approved messages.

The Poor Swiss message attempted:

> Hi Baptiste,
>
> Your article “You do not need to pay for a budgeting app” matches Pulpe’s
> approach. I build Pulpe, a free budget app for planning the year ahead
> without bank sync. It is available on the web and iPhone, in French,
> English, German and Italian, and its source code is public.
>
> https://pulpe.app
> https://github.com/neogenz/pulpe
>
> Happy to answer questions if you ever review it.
>
> Maxime De Sogus

State: not sent. Two attempts, including one from a fresh GET of the contact
page, were rejected by the site with `Your nonce was invalid.` The failure
happened before delivery, so no response is expected and no public comment or
alternate channel was used.

Jowi message sent:

> Bonjour Jordan,
>
> Ton comparatif est à jour pour 2026. Je développe Pulpe, une application
> gratuite pour planifier le budget sur l’année, sans connexion bancaire, en
> CHF et EUR, sur le web et iPhone. Elle pourrait compléter les outils de suivi
> mensuel déjà présentés.
>
> https://pulpe.app
>
> Merci,
> Maxime De Sogus

State: sent at 2026-09-01 14:16 CEST. The embedded Tally form reported `Form
submitted` and displayed `Merci pour votre demande Maxime!` with a promise to
reply as soon as possible.

## Entity claim constraint

No repository `LICENSE` or `COPYING` file was found. External copy therefore
uses the accurate claim that the source code is public and never calls Pulpe
open source. AlternativeTo was intentionally set to `Source available` with no
licence selected. Choosing and publishing a licence remains a product decision.
