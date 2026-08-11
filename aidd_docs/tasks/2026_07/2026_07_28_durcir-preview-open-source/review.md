# Review: Durcir preview avant publication open source

- **Verdict**: blocked
- **Diff**: `origin/preview...codex/durcir-preview-open-source`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_28
- **Findings**: 2 critical, 11 warning, 0 minor

## Phases

### Phase 1 — Protéger la récupération iOS

- [x] L’entitlement, l’AASA et le redirect désignent `app.pulpe.app/reset-password`, avec repli Angular — `frontend/projects/webapp/public/.well-known/apple-app-site-association:10`, `ios/Pulpe/Pulpe.entitlements:8`, `backend-nest/supabase/config.toml:122`
- [x] Seul le universal link HTTPS possédé crée une récupération; `pulpe://` reste non sensible — `ios/Pulpe/App/Navigation/DeepLinkDestination.swift:18`, `ios/PulpeTests/App/ResetPasswordDeepLinkRoutingTests.swift:12`
- [x] Le callback local et les opérations distantes manuelles sont distingués — `backend-nest/supabase/config.toml:122`, `docs/DEPLOYMENT.md:266`
- [x] Les configurations et vérifications statiques du universal link sont présentes — `ios/project.yml:84`, `vercel.json:55`, `ios/PulpeTests/App/ResetPasswordDeepLinkRoutingTests.swift:12`
- [x] Les gates post-déploiement restent explicitement manuels — `docs/DEPLOYMENT.md:266`

### Phase 2 — Fiabiliser la suppression de compte

- [x] `user_metadata.scheduledDeletionAt` ne pilote plus le blocage ni le cron — `backend-nest/src/common/guards/auth.guard.ts:103`, `backend-nest/src/modules/account-deletion/infrastructure/persistence/supabase-account-deletion.repository.ts:59`
- [x] La date serveur est écrite dans `app_metadata` et le cron applique la grâce — `backend-nest/src/modules/user/infrastructure/persistence/supabase-user.repository.ts:139`, `backend-nest/src/modules/account-deletion/infrastructure/persistence/supabase-account-deletion.repository.ts:74`
- [ ] Un bearer avec clé arbitraire est toujours refusé avant mutation — `verifyAndEnsureKeyCheck` accepte et enregistre toute clé lorsque `key_check` manque; fail-closed requis avant suppression
- [x] L’idempotence précède la révocation globale — `backend-nest/src/modules/user/infrastructure/persistence/supabase-user.repository.ts:142`, `backend-nest/src/modules/user/application/schedule-account-deletion.use-case.ts:48`

### Phase 3 — Éliminer les fuites opérationnelles

- [x] La production force le mode standard malgré le flag détaillé — `backend-nest/src/config/environment.ts:145`, `backend-nest/src/config/environment.ts:160`
- [ ] Les détails preview restent utiles sans exposer de secret — la capture `res.json` peut être remplacée par le JSON brut, les réponses `debug` sont filtrées en preview et les erreurs gardent la query brute
- [x] Les clients et le backend propagent un request ID corrélable — `ios/Pulpe/Core/Network/APIClient.swift:193`, `backend-nest/src/app.module.ts:171`, `docs/MONITORING.md:200`
- [x] Le log de recherche conserve le compte sans le texte ni les tags — `backend-nest/src/modules/transaction/application/search-transactions.use-case.ts:76`
- [x] Turnstile est borné à cinq secondes — `backend-nest/src/common/services/turnstile.service.ts:94`

### Phase 4 — Rendre la déconnexion iOS réelle

- [x] Le logout appelle Supabase puis purge les identifiants biométriques et locaux — `ios/Pulpe/App/AppState+SessionReset.swift:116`, `ios/Pulpe/App/AppState+SessionReset.swift:133`
- [x] Le démarrage ne restaure plus une session froide via le snapshot biométrique — `ios/Pulpe/App/Auth/StartupCoordinator.swift:150`, `ios/Pulpe/App/Auth/StartupCoordinator.swift:186`
- [x] Face ID reste limité au déverrouillage d’une session active — `ios/Pulpe/App/Auth/SessionLifecycleCoordinator.swift:208`, `ios/PulpeTests/App/AppStateLogoutBiometricTests.swift:17`

### Phase 5 — Durcir la télémétrie identifiée

- [ ] Une session identifiée ne peut jamais transmettre montant, contenu ou token — le sanitizer iOS est superficiel et le sanitizer URL web conserve des query params sensibles comme `access_token`
- [x] L’opt-out local arrête les captures et l’opt-in ré-identifie la session — `frontend/projects/webapp/src/app/core/analytics/posthog.ts:135`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift:137`
- [x] Les réglages réutilisent les pages et contrôles natifs existants — `frontend/projects/webapp/src/app/feature/settings/settings-page.ts:369`, `ios/Pulpe/Features/Account/PreferencesView.swift:44`
- [ ] Replay, clé de récupération, tests et déclarations sont alignés — les tests omettent les propriétés iOS imbriquées et les query params sensibles; `MONITORING.md` contredit la collecte identifiée livrée

### Phase 6 — Séparer la CI de la production

- [x] L’archive Supabase est vérifiée avant extraction, y compris après cache hit — `.github/actions/setup-supabase-cli/action.yml:63`, `.github/actions/setup-supabase-cli/action.yml:76`
- [x] Les secrets de migration restent sur un push `main` après CI, avec dry-run avant application — `.github/workflows/ci.yml:711`, `.github/workflows/ci.yml:786`, `.github/workflows/ci.yml:810`
- [x] L’image backend n’installe plus Bun et démarre avec Node — `backend-nest/Dockerfile:8`, `backend-nest/Dockerfile:58`

### Phase 7 — Assainir la surface publique du dépôt

- [x] Le clone ne préautorise plus commandes, réseau, Git, déploiements ni hook — `.claude/settings.json:1`, `.github/scripts/public-surface.test.mjs:16`
- [x] Les claims E2EE, zero-knowledge et zéro rétention sont retirés — `.github/scripts/public-surface.test.mjs:42`, `landing/app/support/page.tsx:321`
- [x] Les fixtures, chemins locaux et archives de tâches ne sont plus suivis sans supprimer l’inventaire local — `.github/scripts/public-surface.test.mjs:72`, `aidd_docs/tasks/2026_07/2026_07_28_durcir-preview-open-source/phase-7.md:107`
- [x] Les noms privés recherchés sont absents hors landing — `.github/scripts/public-surface.test.mjs:90`
- [x] Le dump de schéma obsolète n’est plus suivi et les migrations restent la source de vérité — `.gitignore:73`, `.github/scripts/public-surface.test.mjs:76`
- [x] Le scan historique reste borné, local et non destructif — `aidd_docs/tasks/2026_07/2026_07_28_durcir-preview-open-source/phase-7.md:109`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 | code | 2 | `backend-nest/src/modules/user/application/schedule-account-deletion.use-case.ts:38`; `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:350` | La suppression appelle une primitive de bootstrap qui considère toute clé correcte lorsque `key_check` est absent, puis écrit un canari dérivé de cette clé. Un bearer volé suffit alors à programmer la suppression d’un compte ancien et à empoisonner son coffre. | Séparer bootstrap et vérification stricte; la suppression doit échouer sans canari existant ou preuve cryptographique équivalente, sans aucune écriture, puis couvrir le cas réel `key_check=null`. |
| 🔴 | functional | 2 | `backend-nest/src/modules/user/application/schedule-account-deletion.use-case.ts:38` | Le critère « bearer valide + clé arbitraire refusé avant mutation » n’est pas satisfait pour un coffre sans `key_check`; le test unitaire mocke `false` et ne traverse pas la primitive réelle. | Ajouter un test d’intégration use-case + crypto avec `key_check=null`, puis rendre ce parcours fail-closed avant `scheduleDeletion`. |
| 🟠 | code | 3 | `backend-nest/src/common/middleware/response-logger.middleware.ts:32` | Express fait passer `res.json()` par `res.send()`; le second override remplace l’objet déjà masqué par sa chaîne JSON brute, que le sanitizer ne reparcourt pas. | Capturer à une seule frontière ou empêcher `send` d’écraser une capture JSON; tester la vraie chaîne Express `json → send`. |
| 🟠 | code | 3 | `backend-nest/src/app.module.ts:170`; `backend-nest/src/common/middleware/response-logger.middleware.ts:46` | `preview` est `productionLike`, donc Pino reste à `info` et supprime tous les corps de réponse émis en `debug`; le debug distant promis ne montre aucune réponse. | Passer le niveau à `debug` uniquement quand `loggingDecision.mode === 'detailed'`; conserver `info` en production verrouillée. |
| 🟠 | code | 3 | `backend-nest/src/common/filters/global-exception.filter.ts:307` | Le filtre d’exception journalise `request.url` brut; une erreur de recherche peut donc remettre sa query et son texte métier dans les logs production. | Journaliser seulement le path partagé; exposer `request.query` uniquement en mode détaillé via le sanitizer récursif. |
| 🟠 | functional | 3 | `backend-nest/src/common/middleware/response-logger.middleware.ts:32`; `backend-nest/src/common/filters/global-exception.filter.ts:307` | Le critère de détails preview lisibles sans sentinelle secrète n’est pas satisfait sur la chaîne HTTP réelle. | Corriger les trois frontières de log ci-dessus et ajouter une régression avec Express réel, query d’erreur et niveau preview effectif. |
| 🟠 | code | 5 | `ios/Pulpe/Core/Analytics/AnalyticsService.swift:218` | Le sanitizer iOS filtre seulement les clés de premier niveau; un dictionnaire ou tableau imbriqué peut conserver montant, token ou contenu saisi. | Sanitizer récursivement dictionnaires et tableaux dans la fonction centrale; ajouter une sentinelle imbriquée. |
| 🟠 | code | 5 | `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.ts:255` | Les query params URL ne passent que par une liste exacte; `access_token`, `refresh_token`, `password` ou `recovery_key` restent envoyables alors que les fragments utilisent déjà le prédicat sensible. | Réutiliser `isSensitiveProperty` dans la boucle des query params et supprimer l’URL entière en cas de parsing incertain. |
| 🟠 | functional | 5 | `ios/Pulpe/Core/Analytics/AnalyticsService.swift:218`; `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.ts:255` | Le critère d’une identité support sans montant, contenu ni token n’est pas garanti aux deux frontières centrales. | Rendre les deux sanitizers récursifs/fail-closed et tester des payloads imbriqués ainsi que des URLs avec tokens. |
| 🟠 | functional | 5 | `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:120`; `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.spec.ts:11`; `docs/MONITORING.md:287` | Le critère de défense et de déclarations alignées reste incomplet: les tests ne couvrent pas les contournements trouvés et la documentation affirme encore que les emails sont masqués et PostHog limité à la production. | Ajouter les deux régressions minimales et corriger les déclarations pour refléter l’email/prénom identifiés et l’activation configurable local/preview. |
| 🟠 | conform | 7 | `.github/scripts/public-surface.test.mjs:77`; `backend-nest/package.json:13` | `pnpm quality` échoue après le workflow local légitime `dump:db`, car le test interdit l’existence de `schema.sql` alors que ce fichier est volontairement généré et ignoré. | Vérifier qu’il n’est pas suivi avec `git ls-files`, pas qu’il est absent du disque. |
| 🟠 | fit | 7 | `landing/app/support/page.tsx:107` | « tes données ne sortent jamais de ton compte » contredit l’envoi assumé de l’UUID, de l’email, du prénom et des événements à PostHog; formulation facilement attaquable publiquement. | Limiter explicitement la phrase aux montants et libellés financiers, sans promettre l’absence générale de partage. |
| 🟠 | rot | 5, 6 | `docs/MONITORING.md:287`; `docs/MONITORING.md:300`; `docs/CI.md:30`; `docs/CI.md:53` | Les docs modifiées restent contradictoires: email annoncé masqué malgré l’identification, PostHog annoncé production-only, permissions PR et Node 22 différents du workflow (`write`, Node 24). | Mettre ces quatre valeurs à l’identique du code et du workflow actuels. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 87% (26/30) |
| Files checked | 278 fichiers du diff; sources critiques: suppression de compte, chiffrement, logs HTTP, analytics web/iOS, universal links, CI, surface publique et documentation |
| Unchecked     | Phase 2 critère 3 — fix; Phase 3 critère 2 — fix; Phase 5 critère 1 — fix; Phase 5 critère 4 — fix |
| Unplanned     | none |
