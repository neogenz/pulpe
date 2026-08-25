# Review: landing agent readiness

- **Verdict**: changes-requested
- **Diff**: `origin/preview...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_25
- **Findings**: 0 critical, 8 warning, 1 minor

## Phases

### Phase 1 — Markdown negotiation and agent instructions

- [x] Existing pages remain static/SSG and unsupported locales stay closed — `landing/next.config.ts:3`, `landing/app/[lang]/layout.tsx:14`
- [ ] Final HTML and Markdown variants preserve RSC fields and emit `Vary: Accept, Accept-Encoding` — the plan records that Next/Vercel overwrites the final HTML header, while the diff only checks proxy and patched source responses (`aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/plan.md:32`, `landing/app/agent-readiness.test.tsx:257`)
- [x] `llms.txt` follows the required structure and gives precise when-to-use guidance without claiming an API — `landing/public/llms.txt:1`
- [x] Landing tests cover Markdown content, negotiation, cache headers, discovery links, and patch guards — `landing/app/agent-readiness.test.tsx:106`, `landing/app/agent-readiness.test.tsx:211`

### Phase 2 — Trust pages and Organization identity

- [x] `/about` has a canonical, one H1, ordered headings, and more than 500 server-rendered characters — `landing/app/(fr)/about/page.tsx:14`, `landing/app/agent-readiness.test.tsx:290`
- [x] `/privacy` has the same document contract and links to the unchanged full policy — `landing/app/(fr)/privacy/page.tsx:15`, `landing/app/(fr)/privacy/page.tsx:125`
- [x] Sitemap and agent files expose About, Privacy, and Contact without fake translations — `landing/app/sitemap.ts:49`, `landing/public/llms.txt:20`
- [x] Organization JSON-LD contains a reachable ContactPoint and Swiss PostalAddress without invented phone or street — `landing/components/RootDocument.tsx:103`, `landing/app/agent-readiness.test.tsx:324`

### Phase 3 — Recoverable 404 and no-JavaScript evidence

- [x] Missing HTML and Markdown routes remain real recoverable 404 responses — `landing/proxy.ts:38`, `landing/app/global-not-found.tsx:21`
- [x] Raw homepage markup is guarded for one H1, useful text, and ordered headings — `landing/app/agent-readiness.test.tsx:273`
- [ ] Local and Vercel preview GET/HEAD matrices show identical statuses, types, `Vary`, and links — no integration or preview evidence is stored in the diff, and the unit test invokes `proxy()` directly (`landing/app/agent-readiness.test.tsx:106`)

### Phase 4 — Brand activation and public verification

- [ ] Production matches the preview endpoint matrix — the phase records that production still serves HTML for Markdown and returns 404 for the new files/pages (`aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/phase-4.md:9`)
- [ ] Search Console and external profiles use the canonical identity — credentials and authorization remain outstanding (`aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/phase-4.md:12`)
- [ ] The technical score is rescanned after deployment and the clean-brand result is confirmed — only the brand result is recorded; no post-deployment audit exists (`aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/phase-4.md:15`)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| — | code | - | - | None. | - |
| 🟡 | functional | 1 | `landing/scripts/patch-next-vary.js:7` | Phase 1 criterion 2 is unmet: source patch tests do not prove the final Vercel HTML response keeps `Accept` in `Vary` and preserves its RSC fields. | Add a deploy-compatible header path plus an automated final-response check, or explicitly revise the criterion if the upstream limitation is accepted. |
| 🟡 | functional | 3 | `landing/app/agent-readiness.test.tsx:106` | Phase 3 criterion 3 is unmet: direct proxy tests cannot prove the local production server and Vercel preview matrices are identical. | Add a production-server and preview contract check for HTML/Markdown GET/HEAD status, type, `Vary`, noindex, and recovery links. |
| 🟡 | functional | 4 | `aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/phase-4.md:9` | The canonical production endpoint matrix still serves the pre-change behavior. | Promote through the authorized deployment workflow, then record the complete endpoint and JSON-LD matrix. |
| 🟡 | functional | 4 | `aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/phase-4.md:12` | Search Console and external-profile consistency are not verified. | Complete the authorized Search Console and profile updates with the canonical Pulpe identity. |
| 🟡 | functional | 4 | `aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/phase-4.md:15` | The post-deployment Is Agentic rescan is missing. | Purge/deploy first, then rerun the audit and record the score and clean-brand observation. |
| 🟡 | fit | 1 | `landing/components/pages/metadata.ts:18` | Every localized homepage advertises French `/index.md` as its Markdown alternate, although the proxy serves Markdown only for `/` and returns 406 for Markdown-only requests to `/en`, `/de`, and `/it`. | Advertise the alternate only for the French root, or publish and negotiate locale-specific Markdown variants. |
| 🟡 | fit | 2 | `landing/app/(fr)/about/page.tsx:91` | The trust page grants MIT reuse and self-hosting rights, but the tracked repository contains no LICENSE or COPYING file. | Remove the MIT and reuse-right claims, or add the actual MIT license after the owner confirms that licensing decision. |
| 🟡 | conform | - | `aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/plan.md:6` | Newly added AIDD documentation and implementation comments are French, contrary to `AGENTS.md:38` (“Code and docs are English”). | Translate non-product documentation and code comments to English; keep user-facing copy in French. |
| 🟢 | rot | 3 | `landing/app/global-not-found.tsx:13` | The comment still says the static export serves Next's built-in 404 even though this diff removes static export. | Update the comment to describe the current multi-root-layout/global-not-found behavior. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 64% (9/14) |
| Files checked | `.vercelignore`, `aidd_docs/tasks/2026_08/2026_08_25_landing-agent-readiness/plan.md`, `phase-1.md`, `phase-2.md`, `phase-3.md`, `phase-4.md`, `landing/app/(fr)/about/page.tsx`, `landing/app/(fr)/layout.tsx`, `landing/app/(fr)/privacy/page.tsx`, `landing/app/[lang]/layout.tsx`, `landing/app/agent-readiness.test.tsx`, `landing/app/global-not-found.tsx`, `landing/app/sitemap.ts`, `landing/components/RootDocument.tsx`, `landing/components/pages/metadata.ts`, `landing/content/dictionaries/fr.ts`, `landing/lib/routes.ts`, `landing/next.config.ts`, `landing/package.json`, `landing/proxy.ts`, `landing/public/index.md`, `landing/public/llms.txt`, `landing/scripts/patch-next-vary.js`, `pnpm-lock.yaml` |
| Unchecked     | Phase 1 criterion 2 — fix; Phase 3 criterion 3 — fix; Phase 4 criterion 1 — fix; Phase 4 criterion 2 — fix; Phase 4 criterion 3 — fix |
| Unplanned     | none |
