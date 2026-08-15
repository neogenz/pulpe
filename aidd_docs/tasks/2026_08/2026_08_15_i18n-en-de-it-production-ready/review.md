# Review: i18n EN/DE/IT production readiness

- **Verdict**: approve
- **Diff**: `origin/preview@07433bbe6...working tree` (contains remote feature tip `38ae006` and merge commit `e3206fb42`)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_15
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Synchroniser et contrôler la pointe distante

- [x] The reviewed history contains `38ae006` and the production-readiness diff — `aidd_docs/tasks/2026_08/2026_08_15_i18n-en-de-it-production-ready/phase-1.md:61`
- [x] The two unreferenced rollover formatter files remain deleted and frontend compilation passes — `aidd_docs/tasks/2026_08/2026_08_15_i18n-en-de-it-production-ready/phase-1.md:12`

### Phase 2 — Finaliser les corrections fonctionnelles i18n

- [x] Landing CTA locale is validated and persisted while an existing app preference remains authoritative — `frontend/projects/webapp/src/app/core/i18n/language-resolver.ts:25`, `frontend/e2e/tests/features/authentication.spec.ts:12`
- [x] UI language and currency select the correct date and number locale independently, with complete iOS catalogs — `frontend/projects/webapp/src/app/core/locale.ts:58`, `.github/scripts/lexicon.test.mjs:1`
- [x] Landing, webapp and iOS PostHog events carry an English `locale` property that follows the active product language — `landing/lib/posthog.ts:40`, `frontend/projects/webapp/src/app/core/analytics/posthog.ts:592`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift:76`

### Phase 3 — Fiabiliser la couverture automatisée

- [x] Sensitive auth, password, savings-goal and responsive journeys use deterministic mocks and pass without arbitrary waits — `frontend/e2e/tests/features/authentication.spec.ts:12`, `frontend/e2e/utils/auth-bypass.ts:1`

### Phase 4 — Supprimer la suggestion automatique et traduire les CGU

- [x] The language banner is removed and the explicit language selector remains — `landing/components/LanguageSwitcher.tsx:14`, `landing/components/sections/Footer.tsx:151`
- [x] Terms render complete FR/EN/DE/IT titles, dates, sections, lists and footer copy — `frontend/projects/webapp/src/app/feature/legal/components/terms-of-service.spec.ts:15`
- [x] Terms variants preserve the same ten sections and legal links — `frontend/projects/webapp/src/app/feature/legal/components/terms-of-service.spec.ts:40`

### Phase 5 — Traduire la politique de confidentialité

- [x] Privacy policy renders complete FR/EN/DE/IT copy — `frontend/projects/webapp/src/app/feature/legal/components/privacy-policy.spec.ts:72`
- [x] All variants preserve providers, contacts, durations, rights and thirteen-section structure — `frontend/projects/webapp/src/app/feature/legal/components/privacy-policy.spec.ts:97`

### Phase 6 — Internationaliser les nouveautés et le pipeline de release

- [x] Localized changelog pages expose the 0.44.0 release without mixing the French archive — `landing/data/releases.json:3`, `.claude/skills/release/SKILL.md:255`
- [x] Web and iOS What's New projections select FR/EN/DE/IT with French fallback — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts:13`, `backend-nest/src/modules/whats-new/domain/releases-data.ts:51`
- [x] The deterministic release validator enforces four product copies and the release workflow keeps GitHub French-only — `.claude/skills/release/scripts/validate-whats-new-release.ts:300`, `.claude/skills/release/SKILL.md:234`

### Phase 7 — Réduire le bundle, exécuter les gates, documenter et commiter

- [x] Shared/schema suites pass and the 1.37 MB initial Angular bundle stays below the 1.40 MB warning and 1.50 MB error limits — `frontend/angular.json:75`
- [x] All applicable local gates pass and the eight audit reports record feature tip `38ae006` on preview base `07433bbe6` — `aidd_docs/tasks/2026_08/2026_08_15_audit/report.md:1`
- [x] Locale is constrained and owner-scoped, legacy metadata is read-only fallback, locale-only writes avoid service role, and SQL RLS assertions pass — `backend-nest/supabase/migrations/20260815100000_create_user_locale_preference.sql:4`, `backend-nest/supabase/tests/user_locale_preference_rls.sql:28`
- [x] Functional commits and merged preview base are contained by remote `feat/i18n-en-de-it` at `e3206fb42`; the final AIDD evidence commit is pushed immediately after this review snapshot

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (18/18)                                                                                                                                  |
| Files checked | Plan and seven phase files; changed shared, backend, frontend, landing, iOS, SQL, analytics and release-automation files; eight audit reports |
| Unchecked     | none                                                                                                                                          |
| Unplanned     | none                                                                                                                                          |
