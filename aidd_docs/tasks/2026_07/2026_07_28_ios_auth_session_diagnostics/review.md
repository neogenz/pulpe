# Review: iOS auth session diagnostics

- **Verdict**: changes-requested
- **Diff**: `origin/preview...217e5c454`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_29
- **Findings**: 0 critical, 1 warning, 0 minor

## Phases

### Phase 1 — Rendre la capture déterministe et durable

- [x] Une capture différée conserve le distinct ID et l’horodatage présents au signal — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:159`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:36`
- [x] Le test du snapshot reste local, sans réseau ni projet PostHog — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:36`
- [x] Tous les diagnostics passent par le sanitizer, sans donnée financière ou secrète — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:70`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift:125`, `ios/Pulpe/Core/Auth/AuthSessionDiagnostics.swift:79`
- [x] Le projet résout exactement Supabase 2.54.0 et le parser reconnaît les quatre codes terminaux — `ios/project.yml:17`, `ios/Pulpe/Core/Auth/AuthSessionDiagnostics.swift:68`, `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift:66`
- [x] Un log de requête contenant un refresh token ne produit aucun diagnostic terminal — `ios/Pulpe/Core/Auth/AuthSessionDiagnostics.swift:88`, `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift:89`
- [x] `AuthService.swift` ne désactive plus `file_length` et reste sous le seuil de 500 lignes — `ios/Pulpe/Core/Auth/AuthService.swift:1`
- [x] Le flux produit uniquement `auth_session_observed`, déclaré avec ses propriétés et sa taxonomie — `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift:41`, `.claude/rules/05-workflows-and-processes/posthog-events.md:123`

### Phase 2 — Classer chaque fin de session

- [x] Chaque scope terminal possède une raison unique et une classification explicite — `ios/Pulpe/App/AppState+SessionReset.swift:303`, `ios/PulpeTests/App/AppStateLogoutScopeTests.swift:17`
- [x] Suppression de compte, abandon d’inscription et perte au foreground ont des raisons distinctes — `ios/Pulpe/App/AppState+SessionReset.swift:251`, `ios/Pulpe/App/AppState+SessionReset.swift:266`, `ios/PulpeTests/App/AppStateBackgroundLockTests.swift:390`
- [x] Le diagnostic terminal est enqueue synchronement avec l’identité courante avant le reset PostHog — `ios/Pulpe/App/AppState+SessionReset.swift:354`, `ios/Pulpe/App/AppState+SessionReset.swift:393`
- [x] Les effets de logout, reset local, biométrie, PIN et navigation restent couverts — `ios/PulpeTests/App/AppStateResetMatrixTests.swift:53`, `ios/PulpeTests/App/AppStateResetMatrixTests.swift:69`, `ios/PulpeTests/App/AppStateBiometricColdStartTests.swift:130`
- [x] Aucun chemin de production connu n’émet `system_unspecified`; il reste un sentinel de compatibilité — `ios/Pulpe/App/AppState+FlowState.swift:195`, `ios/Pulpe/App/AppState+SessionReset.swift:190`
- [x] Une expiration API conserve statut 401, retry, request ID, endpoint expurgé et éventuel code Supabase — `ios/Pulpe/Core/Network/APIClient.swift:233`, `ios/Pulpe/Core/Network/APIClient.swift:368`, `ios/Pulpe/Core/Auth/AuthSessionDiagnostics.swift:79`
- [x] Les suites ciblées, SwiftLint strict ciblé et le build optimisé `PulpeProd` ont passé; les 19 violations globales restent hors diff — `ios/PulpeTests/App/AppStateLogoutScopeTests.swift:17`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:28`, `ios/project.yml:14`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | fit | 1 | `ios/Pulpe/App/PulpeApp.swift:32` | `AppState()` instancie `AuthService.shared`, qui démarre immédiatement son listener, avant `AnalyticsService.initialize()` à la ligne 92. Les nouveaux événements `initialSession`, `tokenRefreshed`, `signedOut` et les logs Supabase peuvent donc prendre leur snapshot avant le setup PostHog; `getDistinctId()` vaut alors une chaîne vide. Le premier diagnostic d’un cold start peut être capturé sans utilisateur attribuable. | Initialiser `AnalyticsService.shared` avant `AppState()` et donc avant `AuthService.shared`, puis ajouter un test d’ordre d’initialisation ou un garde équivalent. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (14/14) |
| Files checked | `.claude/rules/05-workflows-and-processes/posthog-events.md`, `aidd_docs/tasks/2026_07/2026_07_28_ios_auth_session_diagnostics/{plan,phase-1,phase-2}.md`, `ios/project.yml`, `ios/Pulpe/App/{AppState+Auth,AppState+Bootstrap,AppState+FlowState,AppState+SessionReset,AppStateDependencies,PostAuthResolver,PulpeApp}.swift`, `ios/Pulpe/Core/Analytics/{AnalyticsEvent,AnalyticsService}.swift`, `ios/Pulpe/Core/Auth/{AuthService,AuthSessionDiagnostics,AuthTypes,PulpeAuthStorage}.swift`, `ios/Pulpe/Core/Network/APIClient.swift`, `ios/PulpeTests/App/{AppStateBackgroundLockTests,AppStateBiometricColdStartTests,AppStateLogoutScopeTests,AppStateResetMatrixTests,PostAuthResolutionTests,ResolvePostAuthOrThrowTests}.swift`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift`, `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift`, `ios/PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift` |
| Unchecked     | None |
| Unplanned     | Diagnostics startup, post-auth, widget/deep-link, keychain et backend 401: pertinents à l’objectif et inclus dans la review |
