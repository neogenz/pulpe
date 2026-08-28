---
status: blocked
---

# Landing agent-readiness verification

## Proven candidate

| Field             | Evidence                                                             |
| ----------------- | -------------------------------------------------------------------- |
| Date              | 2026-08-25                                                           |
| Runtime commit    | `954303d96bd600f0ac85e246fef038df12ec6f25`                           |
| Pull request      | https://github.com/neogenz/pulpe/pull/684                            |
| Immutable preview | https://pulpe-landing-4xqnnaylp-maximes-projects-56d66b35.vercel.app |
| Vercel deployment | `6084477263`, success                                                |
| Required CI       | https://github.com/neogenz/pulpe/actions/runs/32855162820, success   |

The preview was queried through authenticated `vercel curl`. No bypass secret,
CLI token, cookie, or credential was copied into this report.

## Local and CI verification

| Check                              | Result                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Landing unit tests                 | 138 passed, 0 failed                                                                                       |
| Landing lint                       | Passed                                                                                                     |
| Landing TypeScript check           | Passed                                                                                                     |
| Verifier syntax and formatting     | Passed                                                                                                     |
| Repository pre-commit quality hook | Passed for the candidate commits                                                                           |
| Required PR check `✅ CI Success`  | Passed; build, unit, integration, E2E, iOS, quality, dependency, format, and critical-audit jobs succeeded |
| Review threads                     | 0 unresolved                                                                                               |
| GitHub mergeability                | Mergeable; overall status remains unstable only because optional checks are not all green                  |

The optional Expo Android preview could not start because the free-plan monthly
Android build quota was exhausted. This is not a required check or a code-test
failure. `Maestro smoke` was still pending when this evidence was recorded and
is also not required.

## Exact preview response matrix

| Check                     | Method and path             | Accept                                 | Status | Content type      | Vary                                                                              | Result |
| ------------------------- | --------------------------- | -------------------------------------- | ------ | ----------------- | --------------------------------------------------------------------------------- | ------ |
| HTML                      | `GET /`                     | `text/html`                            | 200    | `text/html`       | `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` | Pass   |
| HTML HEAD                 | `HEAD /`                    | `text/html`                            | 200    | `text/html`       | Native RSC tokens                                                                 | Pass   |
| Markdown                  | `GET /`                     | `text/markdown`                        | 200    | `text/markdown`   | `Accept, Accept-Encoding`                                                         | Pass   |
| Markdown HEAD             | `HEAD /`                    | `text/markdown`                        | 200    | `text/markdown`   | `Accept, Accept-Encoding`                                                         | Pass   |
| Weighted Markdown         | `GET /`                     | `text/html;q=0.2, text/markdown;q=0.8` | 200    | `text/markdown`   | `Accept, Accept-Encoding`                                                         | Pass   |
| Wildcard HTML             | `GET /`                     | `*/*`                                  | 200    | `text/html`       | Native RSC tokens                                                                 | Pass   |
| Localized Markdown        | `GET /en`                   | `text/markdown`                        | 406    | No representation | `Accept, Accept-Encoding`                                                         | Pass   |
| Unsupported homepage      | `GET /`                     | `application/json`                     | 406    | No representation | `Accept, Accept-Encoding`                                                         | Pass   |
| Markdown 404              | `GET /missing-agent-check`  | `text/markdown`                        | 404    | `text/markdown`   | `Accept, Accept-Encoding`                                                         | Pass   |
| Markdown 404 HEAD         | `HEAD /missing-agent-check` | `text/markdown`                        | 404    | `text/markdown`   | `Accept, Accept-Encoding`                                                         | Pass   |
| HTML 404                  | `GET /missing-agent-check`  | `text/html`                            | 404    | `text/html`       | `Accept, Accept-Encoding`                                                         | Pass   |
| Unsupported missing route | `GET /missing-agent-check`  | `application/json`                     | 406    | No representation | `Accept, Accept-Encoding`                                                         | Pass   |
| Robots                    | `GET /robots.txt`           | Default                                | 200    | `text/plain`      | Not negotiated                                                                    | Pass   |

The homepage HTML response keeps Next.js App Router's native RSC cache keys but
does not keep `Accept` in its final `Vary` header. This is the documented
Next/Vercel limitation accepted by the correction plan. Direct Markdown, 404,
and 406 responses are cache-safe. The HTML 404 requires both negotiated cache
keys and permits native RSC additions because local Next and Vercel differ there.

## Machine-readable and trust surfaces

| Surface              | Preview evidence                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/llms.txt`          | 200 `text/plain`, 2,041 bytes, required ordering and when-to-use guidance present                                                |
| `/index.md`          | 200 `text/markdown`, 1,676 bytes, one H1 and useful plain Markdown                                                               |
| `/about`             | 200, one H1, 1,694 visible characters                                                                                            |
| `/privacy`           | 200, one H1, 1,931 visible characters                                                                                            |
| `/support`           | 200, one H1, 3,599 visible characters and contact guidance                                                                       |
| `/sitemap.xml`       | 200 XML, 9,166 bytes, includes About and Privacy                                                                                 |
| Organization JSON-LD | Parsed; `contactPoint.email`, `contactType`, support URL, and Swiss `PostalAddress` present; no phone or street address invented |

A clean web search for `Pulpe` showed `pulpe.app` as the first result in the
2026-08-25 observation. Search order is transient, so this is evidence for that
snapshot rather than a ranking guarantee.

## Production gate

The same verifier fails against `https://pulpe.app` because production still
serves the previous release: Markdown requests return HTML, negotiated `Vary`
is absent, unavailable representations are not rejected consistently, and the
Markdown 404 recovery response is not live. A production rescan would therefore
measure the old behavior and was deliberately not run.

Completion requires the existing human-approved release flow to promote the
proven candidate, followed by the same production matrix, authorized Search
Console inspection, and a fresh Is Agentic scan. No direct production mutation
was performed.
