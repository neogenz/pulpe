# Review: Stabiliser le durcissement de preview

- **Verdict**: approve
- **Diff**: `origin/preview...7298116ee267`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_29
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Rendre le rekey et le bootstrap exhaustifs

- [x] Un utilisateur avec 1 001 lignes est entièrement rechiffré et le compteur est exact — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:2041`.
- [x] Une erreur sur une page ultérieure arrête le rekey avant le RPC atomique — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:2093`.
- [x] Une donnée chiffrée après les 1 000 premières lignes interdit le bootstrap — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:1940`.
- [x] Une erreur explicite de requête d’existence interdit le bootstrap — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:1978`.
- [x] La sentinelle de dernière page est lisible avec la nouvelle clé et rejetée avec l’ancienne — `backend-nest/src/modules/encryption/encryption.integration.spec.ts:865`.
- [x] Le contrat documente lecture exhaustive, validation, RPC atomique et canari — `docs/ENCRYPTION.md:108`.

### Phase 2 — Exiger une preuve de coffre fraîche pour chaque mutation

- [x] Une DEK obsolète en cache est rejetée à la requête suivante — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:739`.
- [x] Plusieurs champs d’une même mutation réutilisent la preuve limitée à la requête — `backend-nest/src/common/guards/auth.guard.ts:196`.
- [x] Une clé arbitraire ne peut exécuter une mutation métier protégée — `backend-nest/src/common/guards/auth.guard.spec.ts:597`.
- [x] Les lectures tolérantes et le premier `setup-recovery` restent accessibles — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:1491`.
- [x] `targetAmount` remplacé ou effacé exige une DEK vérifiée — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts:562`.
- [x] Changement de PIN, récupération et mode démo conservent leurs résultats — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:3257`.
- [x] Une réponse `setup-recovery` perdue est récupérable au retry — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:365`.
- [x] Un échec `updateUser` ne crée ni boucle ni perte d’accès au retry — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:336`.

### Phase 3 — Assainir les erreurs et verrouiller le runtime production

- [x] La sentinelle est absente des lignes Pino sérialisées en production et preview détaillée — `backend-nest/src/test/redaction.spec.ts:226`.
- [x] Preview détaillée conserve body/query assainis, request ID et frames; production reste standard — `backend-nest/src/test/redaction.spec.ts:341`.
- [x] Une erreur de recherche conserve statut/code sans requête ni message brut — `frontend/projects/webapp/src/app/core/analytics/http-error-interceptor.spec.ts:131`.
- [x] `$exception_list[].value` et les chaînes arbitraires de grouping sont retirés; une structure invalide échoue fermé — `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.spec.ts:300`.
- [x] Le payload HTTP et le comportement d’erreur restent inchangés — `backend-nest/src/test/redaction.spec.ts:301`.
- [x] Un signal Railway production domine `NODE_ENV=development` — `backend-nest/src/config/environment.spec.ts:363`.
- [x] Preview détaillée, local, test et production suivent la matrice attendue — `backend-nest/src/config/environment.spec.ts:369`.

### Phase 4 — Isoler les identités landing et app sans perdre les CTA

- [x] Landing et app ont des persistences distinctes sans cookie cross-subdomain — `landing/app/accessibility.test.tsx:590`.
- [x] Le cookie parent legacy est supprimé avant l’initialisation — `landing/app/accessibility.test.tsx:613`.
- [x] Un CTA navigue dans une borne de 300 ms même sans PostHog — `landing/lib/posthog.ts:77`.
- [x] Clics modifiés, `_blank` et liens internes gardent le comportement natif — `landing/components/PostHogProvider.tsx:31`.
- [x] L’URL finale est exacte et ne transporte aucune identité — `landing/app/accessibility.test.tsx:687`.
- [x] La documentation ne promet plus de session analytics partagée — `docs/VERCEL_ROUTING.md:135`.

### Phase 5 — Restaurer complètement l’analytics après opt-in

- [x] Le web restaure UUID, email, prénom, devise et préférence après opt-in — `frontend/projects/webapp/src/app/core/analytics/analytics.spec.ts:297`.
- [x] Le replay web redémarre seulement en local/preview configuré, jamais en production — `frontend/projects/webapp/src/app/core/analytics/posthog.spec.ts:179`.
- [x] iOS republie une fois l’identité et les préférences après opt-in — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:174`.
- [x] iOS désactive replay et télémétrie réseau dans tous les environnements — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:165`.
- [x] L’opt-out arrête la capture et réinitialise l’identité locale sans toucher Supabase — `frontend/projects/webapp/src/app/core/analytics/posthog.spec.ts:240`.
- [x] Les feature flags iOS restent faux et leur reload ne contacte plus PostHog après opt-out — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:174`.

### Phase 6 — Simplifier Face ID autour du flux actif

- [x] Une session expirée préserve la préférence Face ID sans credential utilisable — `ios/PulpeTests/App/AppStateLogoutBiometricTests.swift:44`.
- [x] Logout explicite, suppression et changement de compte désactivent Face ID — `ios/PulpeTests/App/AppStateLogoutBiometricTests.swift:17`.
- [x] Les anciens chemins de validation de session biométrique sont absents du code de production — `ios/PulpeTests/Core/Auth/AuthServiceBiometricRefactorTests.swift:17`.
- [x] Aucun token Supabase n’est écrit dans les slots biométriques et les slots legacy sont purgés — `ios/PulpeTests/App/AppStateBiometricColdStartTests.swift:272`.
- [x] PIN, Face ID, privacy shield et timeout foreground conservent leur comportement — `ios/PulpeTests/App/AppStateBackgroundLockTests.swift:209`.

### Phase 7 — Sécuriser les workflows locaux et assainir les skills

- [x] Un clone public n’enregistre aucun hook lisant automatiquement des `.env` — `.github/scripts/public-surface.test.mjs:16`.
- [x] La machine locale synchronise encore les worktrees sans exécuter de fichier du worktree — `~/.claude/settings.json:47`.
- [x] Premier passage, no-op, source invalide et symlink sont protégés — `~/.claude/hooks/pulpe-sync-env-on-worktree-start.sh:34`.
- [x] Le test public-surface refuse le hook dangereux et accepte le script manuel — `.github/scripts/public-surface.test.mjs:20`.
- [x] `aidd_docs/tasks` et le schéma obsolète ne sont plus suivis sans suppression locale utile — `.github/scripts/public-surface.test.mjs:95`.
- [x] Les références personnelles ciblées sont retirées des skills — `.claude/skills/product-owner/SKILL.md:1`.
- [x] Méthodes, références, contraintes UX, template, barème et Linear sont conservés — `.claude/skills/product-designer/SKILL.md:1`.

### Phase 8 — Verrouiller le rollout production et les contrats

- [ ] Les inventaires production sont agrégés et aucun coffre incompatible n’est exposé — not-applicable: requêtes et gates présents dans `docs/DEPLOYMENT.md:75`, exécution production non autorisée.
- [x] L’outil pagine et le dry-run ne relit ni n’écrit individuellement aucun compte — `backend-nest/scripts/migrate-scheduled-deletion-metadata.spec.ts:27`.
- [x] L’apply relit le compte et préserve claim et metadata apparues après le listing — `backend-nest/scripts/migrate-scheduled-deletion-metadata.spec.ts:142`.
- [x] Les erreurs retournées ou rejetées ne réémettent aucune chaîne fournisseur — `backend-nest/scripts/migrate-scheduled-deletion-metadata.spec.ts:206`.
- [x] Le runbook impose maintenance vérifiée et compteur legacy à zéro — `docs/DEPLOYMENT.md:104`.
- [ ] Le compteur production des suppressions uniquement dans `user_metadata` est zéro — not-applicable: mesure production différée au rollout approuvé.
- [ ] Une ancienne app iOS n’est pas exposée à un backend incompatible — not-applicable: ordre documenté dans `docs/DEPLOYMENT.md:141`, opération App Store/production non exécutée.
- [x] Chemins de réglage et domaines correspondent aux interfaces — `.github/scripts/public-surface.test.mjs:76`.

### Phase 9 — Fermer les fuites résiduelles des logs détaillés

- [x] Les valeurs financières sont retirées des requêtes, queries, erreurs et réponses sans casser leur structure — `backend-nest/src/common/utils/log-anonymization.spec.ts:156`.
- [x] Route, request ID, statut, code, enums, booléens et compteurs restent exploitables — `backend-nest/src/test/redaction.spec.ts:341`.
- [x] Les cinq erreurs crypto ne sérialisent plus leur message brut — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:2747`.
- [x] Le middleware journalise une copie assainie sans modifier la réponse — `backend-nest/src/test/redaction.spec.ts:301`.
- [x] Analytics, Face ID, landing et workflows sont inchangés par cette phase — commit `1aa963590`.

### Phase 10 — Fermer les findings finaux et revalider la branche

- [x] Les trois findings techniques échouent avant correction pour la cause attendue puis passent après correction — preuves rouge/vert d’implémentation et tests aux lignes `aes-gcm.crypto-service.spec.ts:2010`, `posthog-sanitizer.spec.ts:369`, `APIClientClientKeyHeaderTests.swift:70`.
- [x] `data: null` interdit le bootstrap sans appeler `initializeVaultIfEmpty` — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:2010`.
- [x] Une page de rekey `data: null` arrête le flux avant RPC tandis que `[]` reste une fin valide — `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts:2129`.
- [x] La sentinelle est absente de chaque champ texte d’exception; type, fichier, ligne et colonne sûrs restent disponibles — `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.spec.ts:369`.
- [x] Identification, opt-out/in, feature flags et replay gardent leurs comportements — `frontend/projects/webapp/src/app/core/analytics/analytics.spec.ts:297` et `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:174`.
- [x] Retry et échec final iOS n’exposent plus `localizedDescription`, mais gardent request ID, type et code `URLError` — `ios/PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift:70`.
- [x] Qualité, unités CI, analytics ciblés, diff-check, public-surface et suite iOS complète sont verts sur `7298116ee267` — preuves same-HEAD dans Verification.
- [x] La review finale est `approve`, sans critical, warning, critère correctif ouvert ni modification distante — ce snapshot.

## Findings

None.

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 95% (63/66); trois critères opérationnels production classés not-applicable |
| Files checked | 340 fichiers modifiés, 27 commits, `plan.md`, `phase-1.md` à `phase-10.md`, code/tests/docs/hooks/workflows associés |
| Unchecked | Phase 8 inventaires production — not-applicable; phase 8 compteur legacy production — not-applicable; phase 8 rollout App Store — not-applicable |
| Unplanned | Protection du lien recovery iOS/AASA; révocation de session iOS et corrélation réseau `X-Request-Id`; changements pertinents à l’objectif initial, sans dette ni régression identifiée |
| Static review | `git diff --check origin/preview...7298116ee267` vert; aucun test relancé par cette review statique |
| Existing same-HEAD evidence | Findings ciblés: backend AES 114 pass, analytics web 85 pass, iOS 7 pass; `pnpm quality` 11/11; `pnpm test:unit` 4 432 pass; public-surface et diff-check verts |
| Existing iOS evidence | Suite iOS CI-equivalent complète verte sur `7298116ee267` en 44,768 s |
| Existing runtime evidence | Preview local: debug détaillé actif, request ID présent, valeurs financières `[REDACTED]`, messages bruts absents; production distante non touchée |
| Branch base | `origin/preview` à jour et ancêtre direct; `origin/preview...7298116ee267` = 0 behind, 27 ahead; working tree suivi propre avant remplacement de ce rapport ignoré |
