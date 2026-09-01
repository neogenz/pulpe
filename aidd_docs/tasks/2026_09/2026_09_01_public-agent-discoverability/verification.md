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

## Assistant recommendation baseline

The baseline uses fresh French-language sessions with no prior Pulpe mention.
The exact prompt text is frozen for the 30-day comparison:

| ID  | Role             | Prompt                                                                                                                                                                                                                                              |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Matching need    | Quelle application gratuite me recommandes-tu pour planifier mon budget sur toute l’année en CHF ou EUR, sans connexion bancaire, en plaçant impôts, vacances et grosses dépenses dans les bons mois et en voyant ce qu’il me restera chaque mois ? |
| P2  | Matching need    | Je cherche une alternative plus simple à un tableur ou à YNAB pour préparer les mois futurs, pas seulement suivre mes dépenses passées. Quelles applications devrais-je comparer ?                                                                  |
| N1  | Negative control | Je cherche une application de budget avec synchronisation bancaire automatique et budget partagé en couple. Quelle est la meilleure option ?                                                                                                        |

Each response is classified only for whether Pulpe is surfaced, recommended,
linked to `pulpe.app`, and described accurately. Full assistant responses are
not retained.

### Baseline result — 2026-09-01

All runs used the assistants' search mode. Score cells for P1 and P2 are ordered
`surfaced / recommended / canonical Pulpe citation / accurate`.

| Engine             | Fresh-session controls                                                                              | P1                    | P2                 | N1                 | Exact `Pulpe`  |
| ------------------ | --------------------------------------------------------------------------------------------------- | --------------------- | ------------------ | ------------------ | -------------- |
| ChatGPT Search     | Signed-in Pro account; temporary chat; `Unpersonalized`; French prompt                              | No / No / No / N/A    | No / No / No / N/A | Excluded correctly | Not recognized |
| Gemini Flash + Web | Signed-in Google account; temporary chat; Gemini activity disabled; IP location Vétroz, Switzerland | No / No / No / N/A    | No / No / No / N/A | Excluded correctly | Not recognized |
| Perplexity Search  | Signed-in free account; incognito session; no saved history; French prompt                          | Yes / Yes / Yes / Yes | No / No / No / N/A | Excluded correctly | Not recognized |

Perplexity ranked Pulpe first for P1 and cited
`https://pulpe.app/conseils-budget/meilleure-app-budget-suisse`. Its compact
description matched the public product surface: free, CHF and EUR, no required
bank connection, future month planning, and web/mobile availability. No engine
resolved the one-word brand query to the application; all three interpreted the
generic French word instead.

### Cited URLs

ChatGPT Search P1:

- `https://moneymanagerex.org/docs/features/scheduled/?utm_source=chatgpt.com`
- `https://moneymanagerex.org/moneymanagerex/fr_FR/index.html?utm_source=chatgpt.com`
- `https://android.moneymanagerex.org/usermanual/?utm_source=chatgpt.com`
- `https://moneymanagerex.org/?utm_source=chatgpt.com`
- `https://apps.apple.com/fr/app/cashew-expense-budget-tracker/id6463662930?utm_source=chatgpt.com`

ChatGPT Search P2:

- `https://budgetbakers.com/fr/products/wallet/features/planned-payments/?utm_source=chatgpt.com`
- `https://www.wiz.money/?utm_source=chatgpt.com`
- `https://www.pocketsmith.com/features/budgets-and-planning/?utm_source=chatgpt.com`
- `https://goodbudget.com/help/customize-your-goodbudget/how-to-schedule/?utm_source=chatgpt.com`
- `https://www.budgetwithbuckets.com/blog/2018/02/23/v34-lots-of-newstuff.html/?utm_source=chatgpt.com`
- `https://actualbudget.org/docs/schedules/?utm_source=chatgpt.com`
- `https://help.wiz.money/en/articles/4492243-release-notes?utm_source=chatgpt.com`
- `https://learn.pocketsmith.com/calendar--forecasting/6a6X8SseDAXwf8ZqYunJuU/using-the-calendar-and-forecast-graph/6a6X8SseDAA8P3gNUSiqxi?utm_source=chatgpt.com`
- `https://support.simplifi.quicken.com/en/articles/14893966-how-to-set-up-the-spending-plan?utm_source=chatgpt.com`

ChatGPT Search N1:

- `https://support.ynab.com/en_us/ynab-together-B1nS78Cki`
- `https://support.budgetbakers.com/hc/fr/articles/7149394922002-Tout-sur-le-partage-de-groupe?utm_source=chatgpt.com`
- `https://www.bilanceapp.com/blog/couples-budgeting?utm_source=chatgpt.com`
- `https://support.ynab.com/en_us/direct-import-in-europe-Syae1z_A9?mobile-help=true&utm_source=chatgpt.com`

Gemini P1:

- `https://magicheidi.ch/en/budgeting-apps#:~:text=Goodbudget%20*%20Pricing%3A%20Free%20(10%20envelopes)%20or,planning%20tools.%20*%20No%20bank%20connection%20required.`
- `https://finary.com/fr/blog/finance-perso/budget/meilleures-applications-budget`
- `https://finary.com/fr/blog/finance-perso/budget/meilleures-applications-budget#:~:text=Pourquoi%20c'est%20une%20bonne%20application%20%3A%20Pourquoi,deux%20fois%20%3A%20Combien%20%C3%A7a%20co%C3%BBte%20%3F`
- `https://expatmoney.ch/best-money-apps-budgeting-tools-switzerland/#:~:text=It%20is%20useful%20for%20building%20a%20first,it%20as%20a%20surprise%20creates%20avoidable%20debt.`
- `https://finary.com/fr/blog/finance-perso/budget/meilleures-applications-budget#:~:text=Combien%20%C3%A7a%20co%C3%BBte%20%3F%20Finary%20propose%20une,synchronisations%20illimit%C3%A9es%2C%20budget%20et%20scanner%20de%20frais.`

Gemini P2:

- `https://www.pocketsmith.com/ynab-alternative/`
- `https://myfinancialfreedomtracker.com/en/blog/ynab-alternative-free#:~:text=The%20catch%3A%20every%20feature%20is%20your%20job,that%20never%20seems%20to%20be%20free.%205.`
- `https://www.financialaha.com/articles/best-ynab-alternatives/#:~:text=The%20%E2%80%9Cin%20my%20pocket%E2%80%9D%20feature%20shows%20how,plan%2C%20custom%20categories%2C%20and%20more%20detailed%20reports.`
- `https://getfinny.app/blog/best-ynab-alternatives-2026#:~:text=It%20connects%20to%20over%2010%2C000%20institutions%20and,YNAB%20but%20still%20in%20the%20premium%20range.`
- `https://www.pocketsmith.com/ynab-alternative/#:~:text=You%20will%20also%20love%20our%20intuitive%20calendar,bank%20below.%20Is%20PocketSmith%20here%20to%20stay%3F`

Gemini N1:

- `https://www.planandmultiply.fr/blog/meilleures-appli-gestion-budget#:~:text=Prix%20%3A%20Gratuit%20(version%20limit%C3%A9e)%20%2F%20Premium,suivi%20des%20d%C3%A9penses%20et%20la%20pr%C3%A9vision%20budg%C3%A9taire.`
- `https://www.planandmultiply.fr/blog/meilleures-appli-gestion-budget#:~:text=M%C3%A9thode%20des%20enveloppes%20avec%20allocation%20visuelle%20et,financi%C3%A8re%20pour%20mesurer%20vos%20progr%C3%A8s%20chaque%20mois.`
- `https://epargneclair.com/epargne-budget/application-gestion-budget-couple/#:~:text=Un%20partage%20au%20prorata%20des%20revenus%20est,sur%20Google%20Play.%20T%C3%A9l%C3%A9charger%20Couple%20Count.%202.`
- `https://www.planandmultiply.fr/blog/meilleures-appli-gestion-budget#:~:text=Prix%20%3A%20Gratuit%20(version%20de%20base)%20%2F,automatique%20avec%20plus%20de%20350%20banques%20fran%C3%A7aises.`

Perplexity P1:

- `https://apps.apple.com/lc/app/calbudget/id6768733467`
- `https://apps.apple.com/us/app/atlantic-budget-expenses/id6768097594`
- `https://apps.apple.com/us/app/expense-tracker-money-note/id1320730220`
- `https://play.google.com/store/apps/details?id=gplx.simple.budgetapp&hl=fr`
- `https://github.com/actualbudget/actual`
- `https://pulpe.app/conseils-budget/meilleure-app-budget-suisse`
- `https://finch-agent.ch/blog/best-budgeting-apps-switzerland-2026`
- `https://magicheidi.ch/en/budgeting-apps`
- `https://www.kualto.com/`
- `https://budgethub.ch/`
- `https://www.calbudget.com/free-budget-calendar`
- `https://futurebalance.pro/`
- `https://www.planandmultiply.fr/`
- `https://www.theactualbudget.com/`
- `https://www.estibudget.com/`

Perplexity P2:

- `https://monthli.dev/blog/ynab-alternatives`
- `https://www.kualto.com/`
- `https://bountisphere.com/blog/ynab-alternatives`
- `https://getfinny.app/blog/best-ynab-alternatives-2026`
- `https://www.moneyflock.com/contents/articles/best-ynab-alternatives-in-2026-monarch-everydollar-and-more`
- `https://www.financialaha.com/articles/best-ynab-alternatives/`
- `https://thefrontkit.com/blogs/ynab-alternatives-2026`
- `https://moneko.io/blogs/ynab-alternatives-2026`
- `https://finsee.app/blog/meilleures-applications-budget-previsionnel/`
- `https://www.reddit.com/r/budget/comments/18ol2hf/what_app_most_closely_mimics_the_envelope/`
- `https://appvulture.com/apps-like/ynab/`
- `https://vento.money/blog/budgeting-app-better-than-ynab/`
- `https://pocketclear.app/blog/envelope-budgeting-app.html`
- `https://aimoneyvault.app/resources/articles/best-envelope-budgeting-apps`
- `https://www.reddit.com/r/SavingMoney/comments/1q9uz31/best_budgeting_apps_looking_to_level_up_in_2026/`

Perplexity N1:

- `https://chromewebstore.google.com/detail/sobary/egmeemifenkjmahecbopflcdlbpjmefd`
- `https://play.google.com/store/apps/details?id=com.fivetsolutions.couplesexpensebudgettracker&hl=fr`
- `https://apps.apple.com/fr/app/wezioo-budget-compte-couple/id6755319522?l=en-GB`
- `https://money-talks.app/fr/blog/best-budgeting-app-for-couples`
- `https://epargneclair.com/epargne-budget/application-gestion-budget-couple/`
- `https://www.financites.fr/applications-gestion-budget-couple/`
- `https://www.reddit.com/r/eupersonalfinance/comments/15fa1bs/best_budgeting_app/`
- `https://www.wezioo.com/en`
- `https://epargneclair.com/epargne-budget/application-suivi-depenses/`
- `https://www.bilanceapp.com/blog/best-apps-europe`
- `https://www.planandmultiply.fr/blog/application-budget-gratuit-comparatif`
- `https://getfinny.app/blog/best-euro-expense-trackers-2026`
- `https://econono.com/blog/comparatif-applications-budget-2026-bankin-linxo-finary-ynab/`
- `https://magicheidi.ch/en/budgeting-apps`
- `https://finch-agent.ch/blog/best-budgeting-apps-switzerland-2026`

Perplexity exact `Pulpe`:

- `https://www.dictionnaire-academie.fr/article/A9P5049`
- `https://www.cnrtl.fr/lexicographie/pulpe`
- `https://de.wikipedia.org/wiki/Fruchtpulpe`
- `https://www.larousse.fr/dictionnaires/francais/pulpe/65046`
- `https://fr.wikipedia.org/wiki/Pulpe`
- `https://de.wikipedia.org/wiki/Pulpe_(Verarbeitungstechnik)`
- `https://www.cnrtl.fr/definition/pulpe`
- `https://de.wikipedia.org/wiki/Pulpe`
- `https://dictionnaire.lerobert.com/en/definition/pulpe`
- `https://www.cnrtl.fr/definition/academie8/pulpe`

ChatGPT Search and Gemini cited no URL for exact `Pulpe`.

## PostHog acquisition baseline

The connected `SEO — pulpe.app` dashboard (`895450`, project `87621`) was
force-refreshed on 2026-09-01 for `2026-08-02 00:00:00` through
`2026-09-01 23:59:59` in `Europe/Zurich`:

- organic visitors: 8;
- organic CTA visitors: 3;
- organic `signup_completed`: 0;
- guide visitors: 2;
- guide CTA, signup, and first-budget conversions: 0;
- search-referred unique visitors: 8 across the displayed August and partial
  September buckets, consistent with the 8-person organic funnel;
- AI-referred unique visitors: 0;
- visitors whose landing URL contained `utm_source=chatgpt.com`: 1.

The search/AI split reuses verified `$pageview` properties `$host`,
`$referring_domain`, and `$current_url`. No tracking or dashboard change was
made.

The follow-up is scheduled in this task for the first run on or after
2026-10-01 under `Recheck Pulpe assistant discovery`. It will reuse the frozen
matrix and dashboard, record the comparison, then pause itself. Phase 3 remains
in progress until that observation exists.
