# Review: Durcissement preview — état final

- **Verdict**: blocked
- **Diff**: `origin/preview...HEAD + working tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_28
- **Findings**: 4 critical, 10 warning, 1 minor

## Phases

### Phase 1 — Verrouiller le cycle de vie du coffre et la suppression

- [ ] Une clé arbitraire ne peut pas passer d’une lecture à une écriture ou un effacement — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:1110` chiffre ou efface encore `target_amount` via la primitive de lecture tolérante
- [x] `validate-key` sans canari ne crée rien et la programmation de suppression reste sans effet — `backend-nest/src/modules/encryption/application/validate-user-key.use-case.ts:15`; `backend-nest/src/modules/user/application/schedule-account-deletion.use-case.ts:38`
- [ ] Seule une DEK vérifiée alimente le cache, écrit ou autorise une action destructive — le cache n’est pas revalidé entre instances et les suppressions métier ne vérifient que le format du header
- [x] Le bootstrap vide écrit `key_check` et `wrapped_dek` atomiquement et traite les courses — `backend-nest/src/modules/encryption/infrastructure/persistence/supabase-encryption-key.repository.ts:216`
- [ ] Un coffre contenant des données ne peut pas être repris ni partiellement re-chiffré — les lectures PostgREST non paginées sont tronquées à 1 000 lignes avant bootstrap et rekey
- [ ] L’inventaire production reste un gate de déploiement non exécuté — not-applicable avant déploiement production
- [x] Les clients courants web et iOS séparent création par `setup-recovery` et retour par `validate-key` — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:285`; `ios/Pulpe/Features/Auth/Pin/PinSetupView.swift:263`

### Phase 2 — Rendre les logs preview utiles sans fuite

- [x] La chaîne Express `json → send → finish` journalise une seule structure assainie — `backend-nest/src/test/redaction.spec.ts:230`
- [x] Un `send` direct est assaini sans altérer la réponse — `backend-nest/src/test/redaction.spec.ts:266`
- [x] Preview opt-in utilise `debug`; preview standard et production utilisent `info` — `backend-nest/src/app.module.ts:161`
- [ ] Les erreurs standards et détaillées restent sans donnée sensible — `err`, `msg` et `customErrorMessage` conservent le message et la stack arbitraires hors du sanitizer

### Phase 3 — Fermer les contournements analytics web et iOS

- [x] Le sanitizer iOS retire récursivement secrets, montants et contenus métier — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:218`
- [ ] Les URLs et erreurs perdent tous les contenus sensibles — `q`, `errorMessage`, `backendErrorMessage` et `$exception_list[].value` survivent
- [x] Une URL non analysable ne ressort pas telle quelle — `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.ts:280`
- [ ] Le contrat de monitoring correspond au comportement — l’identité landing reste partagée par cookie, du contenu saisi atteint encore PostHog et le replay iOS SwiftUI configuré ne produit pas de snapshot

### Phase 4 — Réparer les contrats publics et valider l’ensemble

- [x] Le contrôle du dump SQL porte sur la surface suivie par Git — `.github/scripts/public-surface.test.mjs:95`
- [x] La landing borne sa promesse aux données financières — `landing/app/support/page.tsx:107`
- [x] La documentation CI correspond au workflow — `docs/CI.md:30`; `.github/workflows/ci.yml:18`
- [x] Les checks du HEAD sont verts et les tests ciblés revus passent — PR #556; web 95/95; iOS analytics 16/16; public-surface 4/4
- [ ] La revue finale ne confirme pas l’absence de nouvelle régression critique ou warning — 15 findings ouverts

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 | code | 1 | `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:1110`; `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:235` | `targetAmount` utilise `getDekFor`, qui retourne volontairement une DEK non validée pour les lectures. Une clé arbitraire peut donc chiffrer une cible sous la mauvaise DEK ou l’effacer avec `null`, avant toute vérification du canari. | Dès que `targetAmount !== undefined`, appeler `ensureUserDEK` avant les branches valeur/null, réutiliser cette DEK pour chiffrer et tester les deux mutations avec canari absent ou invalide. |
| 🔴 | code | 1 | `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:840`; `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:1024`; `backend-nest/supabase/config.toml:16` | Le rekey charge chaque table sans pagination alors que PostgREST borne les réponses à 1 000 lignes. La RPC accepte le lot incomplet puis remplace `key_check`; les lignes restantes gardent l’ancienne DEK et deviennent illisibles après changement de PIN ou récupération. Les mêmes fetchs rendent aussi le contrôle de coffre vide incomplet. | Paginer exhaustivement et chunker les listes d’IDs pour le rekey; utiliser des requêtes d’existence fail-closed pour le bootstrap; tester plus de 1 000 lignes et une donnée sensible hors première page. |
| 🔴 | functional | 3 | `landing/lib/posthog.ts:34`; `frontend/projects/webapp/src/app/core/analytics/posthog.ts:76`; `landing/app/accessibility.test.tsx:583` | Retirer `ph_did` et l’option explicite ne sépare pas les identités : PostHog active par défaut le cookie cross-subdomain sur `pulpe.app` et `app.pulpe.app`. Avec la même clé et `localStorage+cookie`, `distinct_id`, `device_id` et session restent partagés; le test ne rejette que le littéral `true`. | Définir `cross_subdomain_cookie: false` et des namespaces de persistence distincts app/landing, traiter l’ancien cookie partagé, puis tester la configuration effective et la navigation réelle entre domaines. |
| 🔴 | code | 4 | `.claude/settings.json:5`; `.claude/hooks/sync-env-on-worktree-start.sh:47`; `sync-env.sh:45` | Le `SessionStart` versionné exécute le `sync-env.sh` contrôlé par la branche avec les droits utilisateur, puis lui donne accès aux `.env` du workspace source. Une branche/PR hostile peut exfiltrer ou écraser les secrets avant revue; le test courant vérifie seulement forme et existence. | Garder la synchronisation automatique dans `~/.claude/settings.json`, mais exécuter un script de confiance hors worktree. Le dépôt ne doit autoriser aucun hook de branche qui lit les `.env`. |
| 🟡 | code | 1 | `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:192`; `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:1108` | `ensureUserDEK` accepte pendant cinq minutes une DEK cachée sans relire le canari. Après rekey sur une autre instance, une instance stale peut encore écrire sous l’ancienne clé. | Revalider le canari courant sur le chemin d’écriture avant d’accepter le cache, puis évincer et zéroiser sur mismatch; couvrir deux services partageant un repository mutable. |
| 🟡 | fit | 1 | `backend-nest/src/common/guards/auth.guard.ts:149`; `backend-nest/src/modules/transaction/application/remove-transaction.use-case.ts:28`; `backend-nest/src/modules/budget/application/remove-budget.use-case.ts:20` | La garantie planifiée « toute action destructive exige une preuve cryptographique » est fausse : un bearer et une clé arbitraire bien formée suffisent encore pour supprimer budgets ou transactions. | Soit vérifier le canari à une frontière commune pour les mutations/destructions avec exceptions bootstrap/demo, soit réduire explicitement le contrat et accepter ce risque dans le threat model. |
| 🟡 | code | 2 | `backend-nest/src/common/filters/global-exception.filter.ts:327`; `backend-nest/src/app.module.ts:199`; `backend-nest/src/common/filters/global-exception.filter.spec.ts:386` | Pino reçoit l’`Error`, son message et sa stack après sanitization; le test exige même que `ENCRYPTION_MASTER_KEY` reste dans `err.message`. La fuite existe en production standard et preview détaillée. | Journaliser code/type/request ID et contexte assaini; retirer les messages arbitraires et la première ligne sensible des stacks, puis tester la sortie Pino réelle avec une sentinelle absente dans les deux modes. |
| 🟡 | functional | 3 | `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts:81`; `frontend/projects/webapp/src/app/core/analytics/http-error-interceptor.ts:64`; `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.ts:136` | Une erreur de recherche envoie encore le texte `q`; le même flux conserve les messages bruts dans `errorMessage`, `backendErrorMessage` et `$exception_list[].value`. Cela contredit la politique « aucun contenu saisi ». | Protéger `q`; normaliser les exceptions HTTP avec statut + code/type stable; supprimer les messages payload du contexte et tester une sentinelle jusqu’à `before_send`. |
| 🟡 | functional | 3 | `frontend/projects/webapp/src/app/core/analytics/posthog.ts:135`; `frontend/projects/webapp/src/app/core/analytics/analytics.ts:128`; `ios/Pulpe/Core/Analytics/AnalyticsService.swift:137`; `ios/Pulpe/Core/Analytics/CurrencyAnalyticsSyncModifier.swift:20` | Après opt-out puis opt-in, le web ne redémarre pas le replay preview et web/iOS ne republient pas devise et préférence d’affichage tant qu’elles ne changent pas. UUID/email reviennent, mais la restauration analytics reste partielle. | Au ré-opt-in, redémarrer le replay web uniquement derrière le gate non-production et republier explicitement les propriétés courantes après `identify`; tester le cycle complet sans modifier les réglages. |
| 🟡 | functional | 3 | `ios/Pulpe/Core/Analytics/AnalyticsService.swift:39`; `ios/Pulpe.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved:68` | PostHog iOS 3.42 ignore les snapshots d’un `UIHostingController` sans `screenshotMode`; le replay SwiftUI annoncé est donc inopérant. L’activer aveuglément peut capturer l’écran financier, tandis que la télémétrie réseau est activée par défaut. | Pour le correctif minimal sûr, désactiver explicitement replay et télémétrie réseau iOS et documenter le replay web-only; n’activer le screenshot iOS qu’après une revue dédiée du masquage des montants et contenus. |
| 🟡 | functional | 3 | `landing/components/PostHogProvider.tsx:7`; `landing/lib/posthog.ts:62` | Le retrait du handoff a aussi supprimé l’attente bornée : un CTA vers l’app peut naviguer avant la fin de l’import/capture PostHog et perdre le premier événement. | Restaurer uniquement une attente bornée de capture avant navigation vers l’URL originale, sans paramètre d’identité, et tester import lent + timeout. |
| 🟡 | functional | - | `ios/Pulpe/App/AppState.swift:282`; `ios/Pulpe/App/AppState+SessionReset.swift:106`; `ios/Pulpe/App/Auth/SessionLifecycleCoordinator.swift:70` | L’expiration à froid désactive durablement Face ID alors que l’expiration à chaud conserve la préférence. En parallèle, le démarrage n’utilise plus la reconnexion biométrique mais le snapshot access/refresh token, sa resynchronisation et ses seams de test restent actifs sans consommateur. | Conserver `isEnabled` lors d’une expiration, le désactiver seulement au logout explicite; supprimer ensuite le chemin cold-start/token mort et ses tests trompeurs, en gardant le verrouillage arrière-plan par clé biométrique. |
| 🟡 | fit | 1 | `backend-nest/src/modules/encryption/application/validate-user-key.use-case.ts:15`; `ios/Pulpe/Core/Auth/PinValidation.swift:20`; `docs/VERSIONING.md:103` | Le backend rend `/validate-key` strict, mais l’app iOS actuellement distribuée l’appelle encore avant `/setup-recovery` lors d’une création. Déployer le backend d’abord casse les nouvelles inscriptions des anciens clients. | Publier le client corrigé contre l’ancien backend, attendre sa disponibilité, forcer la version minimale si nécessaire, puis seulement déployer le backend strict; inscrire ce gate dans la checklist de release. |
| 🟡 | rot | 4 | `.claude/skills/product-designer/SKILL.md:75`; `.claude/skills/product-designer/references/process-design.md:40`; `.claude/skills/product-owner/SKILL.md:182` | La restauration remet un jugement de QI, un exemple personnel âge/prénom et des métriques personnelles figées. Ils n’améliorent pas les contraintes UX, vieillissent vite et l’estimation rétroactive des issues Done biaise la vélocité. | Garder les apps de référence, contraintes UX, barème et procédure Linear; retirer seulement QI/âge/table personnelle et calculer la vélocité depuis les estimations existantes sans backfill. |
| 🟢 | conform | 4 | `docs/CONSENT.md:25`; `frontend/projects/webapp/src/app/feature/legal/components/privacy-policy.ts:131`; `ios/Pulpe/Features/Account/PreferencesView.swift:44` | Les documents indiquent « Paramètres → Données de diagnostic » pour les deux plateformes; iOS expose « Préférences → Données et confidentialité ». | Documenter séparément le chemin web et le chemin iOS avec les libellés réellement affichés. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 60% (12/20) |
| Files checked | 305 fichiers du diff; coffre/rekey, suppressions, logs Pino, analytics web/iOS/landing, auth iOS, CI, hooks et skills restaurés |
| Unchecked | Phase 1 critères 1, 3 et 5 — fix; inventaire production — not-applicable; Phase 2 critère 4 — fix; Phase 3 critères 2 et 4 — fix; Phase 4 critère 5 — fix |
| Unplanned | Commit iOS `162175f09`; restaurations locales hook/settings/skills/test public; compatibilité des anciens clients, cookie PostHog effectif et conservation du CTA non tracées dans le plan de remédiation |
