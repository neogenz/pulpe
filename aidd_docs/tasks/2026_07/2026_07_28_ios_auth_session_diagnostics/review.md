# Review: iOS auth session diagnostics

- **Verdict**: changes-requested
- **Diff**: `origin/preview...5fd06e4e0`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_28
- **Findings**: 0 critical, 4 warning, 1 minor

## Phases

### Phase 1 — Diagnostic des déconnexions iOS en production

- [x] La version, le build, l’environnement et la plateforme accompagnent les événements — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:39`
- [x] L’état du stockage persistant et l’expiration de l’access token sont capturés pendant validation et refresh — `ios/Pulpe/Core/Auth/AuthService.swift:184`
- [x] Le code terminal Supabase et le statut HTTP sont extraits sans transmettre le body ni les tokens — `ios/Pulpe/Core/Auth/AuthService.swift:461`
- [x] Chaque 401 backend indique le retry, le request ID et un endpoint sans UUID — `ios/Pulpe/Core/Network/APIClient.swift:368`
- [x] L’entrée widget et la destination finale du démarrage ou post-auth sont capturées — `ios/Pulpe/App/PulpeApp.swift:194`, `ios/Pulpe/App/AppState+Auth.swift:151`
- [ ] Chaque fin de session est classée sans ambiguïté comme attendue ou anormale avec une raison stable — fix
- [ ] Les diagnostics conservent l’identité utilisateur et l’ordre temporel au travers d’un reset analytics — fix
- [x] Les propriétés excluent tokens, emails, identifiants de budget et données financières — `ios/Pulpe/Core/Auth/AuthService.swift:461`, `ios/Pulpe/Core/Network/APIClient.swift:380`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | functional | 1 | `ios/Pulpe/App/AppState+SessionReset.swift:126` | `source` vaut seulement `user_initiated` ou `system`. Suppression de compte, abandon d’inscription, abandon de retry, session réellement expirée et perte anormale du blob deviennent tous `system`; l’incident ne permet donc pas de conclure « normal » ou « bug ». | Ajouter une raison stable et granulaire au point d’appel, par exemple `user_logout`, `session_expiry`, `account_deletion`, `signup_abandon`, `startup_abandon`, `password_reset`; conserver `source` comme regroupement optionnel. |
| 🟡 | functional | 1 | `ios/Pulpe/Core/Analytics/AnalyticsService.swift:67`, `ios/Pulpe/App/AppState+SessionReset.swift:130` | Tous les diagnostics passent par un `Task` non structuré, alors qu’un logout appelle immédiatement `reset()`. Le task peut capturer après rotation du distinct ID PostHog, rendant l’événement anonyme ou attribué au mauvais utilisateur et faussant son ordre. | Capturer identité et timestamp à l’appel puis les transmettre explicitement, ou rendre l’envoi attendu/drainé avant `reset()`; couvrir aussi le logger SDK synchrone. |
| 🟡 | code | 1 | `ios/Pulpe/Core/Auth/AuthService.swift:481`, `ios/project.yml:19` | L’extraction des codes repose sur le texte de log verbose non contractuel de Supabase, tandis que la dépendance accepte toute version `2.x` et que le lockfile n’est pas versionné. Une mise à jour peut supprimer silencieusement ces diagnostics; le test actuel ne vérifie que la chaîne recopiée. | Épingler la version SDK utilisée en production ou utiliser un hook de réponse stable; à défaut, versionner le contrat résolu et tester le format réellement émis par cette version. |
| 🟡 | conform | 1 | `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift:41`, `.claude/rules/05-workflows-and-processes/posthog-events.md:162` | `auth_session_diagnostic` ne suit pas la convention locale `object_action` au passé, et ses espaces de valeurs `source`/`outcome` ne sont pas documentés dans le catalogue analytics. | Renommer avant diffusion, par exemple `auth_session_observed`, puis documenter les valeurs autorisées de chaque propriété. |
| 🟢 | rot | 1 | `ios/Pulpe/Core/Auth/AuthService.swift:1` | Le disable `file_length` couvre désormais tout un fichier de 622 lignes et masque sa croissance future. | Déplacer le logger et les diagnostics de session dans un fichier ciblé, puis retirer le disable global. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 75% (6/8) |
| Files checked | `ios/Pulpe/App/AppState+Auth.swift`, `ios/Pulpe/App/AppState+Bootstrap.swift`, `ios/Pulpe/App/AppState+SessionReset.swift`, `ios/Pulpe/App/PostAuthResolver.swift`, `ios/Pulpe/App/PulpeApp.swift`, `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift`, `ios/Pulpe/Core/Auth/AuthService.swift`, `ios/Pulpe/Core/Auth/PulpeAuthStorage.swift`, `ios/Pulpe/Core/Network/APIClient.swift`, `ios/PulpeTests/App/PostAuthResolutionTests.swift`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift`, `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift`, `ios/PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift`, `ios/project.yml`, `ios/Pulpe/App/Runtime/AppRuntimeCoordinator.swift`, `ios/Pulpe/App/RootViewModifiers.swift`, `ios/Pulpe/App/AppState+FlowState.swift`, `ios/Pulpe/App/Auth/StartupCoordinator.swift`, `ios/Pulpe/App/Auth/SessionLifecycleCoordinator.swift`, `ios/Pulpe/Core/Network/Endpoints.swift`, `.claude/rules/05-workflows-and-processes/posthog-events.md` |
| Unchecked     | Classification attendue ou anormale de la fin de session — fix; identité et ordre des diagnostics après reset — fix |
| Unplanned     | Disable global de la règle `file_length` dans `AuthService.swift` — aucun critère associé |
