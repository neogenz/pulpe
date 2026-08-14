# Review: Retrait du gate multi-devise

- **Verdict**: changes-requested
- **Diff**: `73ebb0d4d...819184d5c`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 2 warning, 1 minor

## Phases

### Phase 1 — Retirer le gate du frontend et du contrat partagé

- [x] La clé et l’adaptateur multi-devise disparaissent, tandis que les primitives génériques restent disponibles et testées — `shared/src/feature-flags.ts:12`, `frontend/projects/webapp/src/app/core/analytics/posthog.ts:123`, `frontend/projects/webapp/src/app/core/analytics/posthog.spec.ts:326`
- [x] Paramètres et profil initial exposent CHF/EUR sans PostHog ; la création suit directement `showCurrencySelector` — `frontend/projects/webapp/src/app/feature/settings/settings-page.ts:119`, `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:192`, `frontend/projects/webapp/src/app/pattern/amount-input/amount-input.ts:133`
- [x] Les métadonnées FX pilotent desktop, mobile, dialog et bottom sheet — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-grid/budget-grid-card.ts:191`, `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-grid/budget-grid-mobile-card.ts:151`, `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/details-dialog/dialog.ts:105`, `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/details-dialog/bottom-sheet.ts:125`
- [x] Les tests restants couvrent préférence/devise et les cinq comportements E2E sans injection du flag — `frontend/projects/webapp/src/app/pattern/amount-input/amount-input.spec.ts:129`, `frontend/e2e/tests/features/live-conversion-preview.spec.ts:123`

### Phase 2 — Retirer le gate et son store dédié d’iOS

- [x] Le store dédié sort du cycle de vie ; XcodeGen source le projet par dossier et les primitives génériques restent disponibles — `ios/Pulpe/App/PulpeApp.swift:35`, `ios/project.yml:59`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift:108`
- [x] Les créations lisent directement `showCurrencySelector` et les éditions conservent `isAlternateCurrency` — `ios/Pulpe/Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift:104`, `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift:66`, `ios/Pulpe/Shared/Components/EditBudgetLineSheet.swift:63`
- [x] Compte, préférences, onboarding et badges de conversion ne consultent plus PostHog — `ios/Pulpe/Features/Account/AccountView.swift:92`, `ios/Pulpe/Features/Account/CurrencySettingView.swift:32`, `ios/Pulpe/Features/Onboarding/Steps/IncomeStep.swift:25`, `ios/Pulpe/Shared/Components/CurrencyConversionBadge.swift:12`
- [x] Les tests iOS ne dépendent plus de `FeatureFlagsStore` ni d’une assertion de gate — `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:5`, `ios/PulpeTests/Shared/Components/EditBudgetLineSheetTests.swift:158`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | conform | 2 | `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:5` | Le test dédié au gate iOS est supprimé sans assertion de non-régression équivalente ; les deux tests restants valident seulement la mutation du store et passaient déjà avec le comportement fautif. Cela ne conserve pas le test exigé par la règle projet « bug reported → write test reproducing bug ». | Ajouter un test persistant au point de décision de visibilité iOS, prouvant qu’une préférence `true` expose le sélecteur sans dépendance à un feature flag. |
| 🟡 warning | rot | 1–2 | `memory-bank/systemPatterns.md:266`, `memory-bank/techContext.md:134`, `.claude/rules/05-workflows-and-processes/posthog-events.md:105` | Les références projet décrivent encore `FEATURE_FLAGS.MULTI_CURRENCY`, `FeatureFlagsService`, `FeatureFlagsStore`, `showCurrencySelectorEffective` et des événements gated, en contradiction directe avec le diff. | Marquer le rollout multi-devise terminé et remplacer les sections courantes par la règle réelle : préférence utilisateur pour la saisie, métadonnées FX pour l’affichage, primitives PostHog génériques seulement. |
| 🟢 minor | code | 1 | `frontend/projects/webapp/src/app/core/analytics/analytics.ts:46` | Le commentaire annonce encore une resynchronisation sur changement d’exposition de flag alors que l’effet n’observe plus que les paramètres utilisateur. | Remplacer « settings or flag exposure » par « settings ». |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (8/8) |
| Files checked | 60/60 fichiers modifiés, `AGENTS.md`, règles Angular/Swift/PostHog/tests ciblées, `memory-bank/systemPatterns.md`, `memory-bank/techContext.md` |
| Unchecked | none |
| Unplanned | none |
