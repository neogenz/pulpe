# Review: iOS auth session diagnostics

- **Verdict**: changes-requested
- **Diff**: `origin/preview...86ce7d9e8`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_29
- **Findings**: 0 critical, 4 warning, 1 minor

## Phases

### Phase 1 — Rendre la capture déterministe et durable

- [x] Une capture différée conserve le distinct ID et l’horodatage présents au signal — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:105`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift:142`
- [x] Le test du snapshot est local et indépendant du réseau ou d’un projet PostHog — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:36`
- [x] Les diagnostics passent par le sanitizer sans propriété financière ou secrète ajoutée — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:73`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift:142`
- [x] Le projet résout exactement Supabase 2.54.0 et le parser reconnaît les quatre codes terminaux — `ios/project.yml:19`, `ios/Pulpe/Core/Auth/AuthSessionDiagnostics.swift:72`
- [x] Un log de requête contenant un refresh token ne produit aucun diagnostic terminal — `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift:89`
- [x] `AuthService.swift` ne contient plus de disable `file_length` et reste au seuil de 500 lignes — `ios/Pulpe/Core/Auth/AuthService.swift:490`
- [x] Le flux produit uniquement `auth_session_observed`, déclaré avec ses propriétés — `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift:41`, `.claude/rules/05-workflows-and-processes/posthog-events.md:123`

### Phase 2 — Classer chaque fin de session

- [x] Chaque scope déclaré possède une raison unique et une classification — `ios/Pulpe/App/AppState+SessionReset.swift:303`, `ios/PulpeTests/App/AppStateLogoutScopeTests.swift:17`
- [x] Suppression de compte, abandon d’inscription et perte au foreground ont des raisons distinctes — `ios/Pulpe/App/AppState+SessionReset.swift:67`, `ios/Pulpe/App/AppState+SessionReset.swift:258`, `ios/Pulpe/App/AppState+SessionReset.swift:266`
- [ ] Toute expiration terminale passe par la capture typée avant le reset PostHog — `unauthenticatedSessionExpired` contourne `resetSession` dans `ios/Pulpe/App/AppState+Auth.swift:182`
- [x] Les effets de reset local, biométrie, PIN et navigation restent couverts par la matrice existante — `ios/PulpeTests/App/AppStateResetMatrixTests.swift:53`, `ios/PulpeTests/App/AppStateBiometricColdStartTests.swift:130`
- [x] Aucun appel système de production connu n’emploie `system_unspecified` — `ios/Pulpe/App/AppState+FlowState.swift:196`, `ios/Pulpe/App/AppState+SessionReset.swift:67`
- [x] Une expiration API conserve statut 401, retry, request ID, endpoint expurgé et éventuel code Supabase — `ios/Pulpe/Core/Network/APIClient.swift:369`, `ios/Pulpe/Core/Auth/AuthService.swift:244`, `ios/Pulpe/Core/Auth/AuthSessionDiagnostics.swift:79`
- [ ] Les suites ciblées et le build passent, mais SwiftLint strict global reste rouge sur 19 violations — première preuve à `ios/Pulpe/App/AppState.swift:506`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | functional | 2 | `ios/Pulpe/App/AppState+Auth.swift:182` | Le chemin production `vault-status 401 → refresh terminal → unauthenticatedSessionExpired` place directement l’app en `unauthenticated`. Il conserve `currentUser`, n’émet aucun `session_reset` et omet `is_expected_user_action`; cette déconnexion reste hors de la taxonomie terminale annoncée. | Router cette destination par un scope terminal précis et le nettoyage central, ou émettre l’équivalent terminal explicite puis vider l’état utilisateur sans modifier le comportement UI attendu. |
| 🟡 | functional | 2 | `ios/Pulpe/App/AppState.swift:506` | Le critère « SwiftLint strict passe » n’est pas satisfait: le contrôle global retourne 19 violations préexistantes, dont `AppState.swift` à 506 lignes pour un seuil strict de 500. | Corriger la baseline globale, ou reformuler explicitement le critère vers un lint strict limité aux fichiers modifiés avec une baseline documentée avant de déclarer la phase terminée. |
| 🟡 | fit | 1 | `ios/Pulpe/Core/Analytics/AnalyticsService.swift:116`, `ios/Pulpe/App/AppState+SessionReset.swift:391` | Le diagnostic terminal est seulement mis en attente, puis `reset()` s’exécute avant son enqueue. PostHog supprime alors les propriétés enregistrées et réinitialise la session: le distinct ID et le timestamp survivent, mais `environment`, `platform`, `build_number` et le contexte de session ne suivent plus l’incident. | Enqueue le snapshot terminal synchronement sur le MainActor avant `reset()`, ou inclure ce contexte immuable dans le snapshot et réenregistrer les propriétés après le reset. |
| 🟡 | conform | 1 | `.claude/rules/05-workflows-and-processes/posthog-events.md:138` | Le catalogue déclare six sources, dont `api_401_refresh` qui n’est jamais émise, mais omet notamment `api_401`, `backend_api`, `vault_status_401`, `startup_result`, `post_auth_destination`, `deep_link` et les sources keychain; plusieurs outcomes et la propriété `source` de `logout_completed` manquent aussi. | Aligner le catalogue sur toutes les valeurs réellement émises et supprimer ou renommer les valeurs fantômes. |
| 🟢 | code | 2 | `ios/Pulpe/App/AppState+SessionReset.swift:317`, `ios/PulpeTests/App/AppStateLogoutScopeTests.swift:19` | Le `default: false` et la table manuelle ne forcent pas la classification d’un futur scope; un nouveau cas peut être ajouté sans faire échouer ce contrat supposé exhaustif. | Rendre le switch exhaustif sans `default` et vérifier l’exhaustivité de la table, par exemple avec `CaseIterable`. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 86% (12/14) |
| Files checked | `.claude/rules/05-workflows-and-processes/posthog-events.md`, `aidd_docs/tasks/2026_07/2026_07_28_ios_auth_session_diagnostics/{plan,phase-1,phase-2}.md`, `ios/project.yml`, `ios/Pulpe/App/{AppState+Auth,AppState+Bootstrap,AppState+FlowState,AppState+SessionReset,PostAuthResolver,PulpeApp}.swift`, `ios/Pulpe/Core/Analytics/{AnalyticsEvent,AnalyticsService}.swift`, `ios/Pulpe/Core/Auth/{AuthService,AuthSessionDiagnostics,AuthTypes,PulpeAuthStorage}.swift`, `ios/Pulpe/Core/Network/APIClient.swift`, `ios/PulpeTests/App/{AppStateBackgroundLockTests,AppStateLogoutScopeTests,PostAuthResolutionTests}.swift`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift`, `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift`, `ios/PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift`, `ios/Pulpe/App/Auth/StartupCoordinator.swift`, `ios/Pulpe/App/AppState+Recovery.swift`, `ios/Pulpe/App/RootViewModifiers.swift`, `ios/PulpeTests/App/{AppStateResetMatrixTests,AppStateBiometricColdStartTests}.swift` |
| Unchecked     | Expiration post-auth hors du reset terminal — fix; SwiftLint strict global non passant — fix |
| Unplanned     | Diagnostics startup, post-auth, widget/deep-link, keychain et backend 401 du commit `5fd06e4e0`: pertinents pour l’objectif, mais hors des projections correctives des phases 1 et 2 |
