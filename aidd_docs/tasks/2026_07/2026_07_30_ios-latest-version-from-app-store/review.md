# Review: iOS latest version resolved from the App Store (PR #564)

- **Verdict**: changes-requested
- **Diff**: `origin/preview...cb7b94b4f`
- **Axes run**: code, functional (criteria derived from the stated objective, no `plan.md` exists), relevancy
- **Date**: 2026_07_30
- **Findings**: 0 critical, 2 warning, 3 minor

## Phases

### Phase 1 — Supprimer l'opération Railway manuelle après approbation App Store

- [x] `ios.latestVersion` suit la version App Store sans opération Railway — `backend-nest/src/modules/app-version/ios-version-gate.service.ts:70` (`max(env, App Store)`), lookup live vérifié : Apple renvoie `1.3.0`
- [x] Aucune doc ni skill ne planifie encore un flip `LATEST_IOS_VERSION` — `.claude/skills/release/SKILL.md:671`, `.claude/skills/release/references/ios-release.md:76`, `docs/DEPLOYMENT.md:405`, `docs/VERSIONING.md:125`
- [x] `LATEST_IOS_VERSION` reste un override manuel, jamais une régression — `ios-version-gate.service.ts:70` + test `should keep the configured version when the App Store reports an older one`

### Phase 2 — Aucun effet de bord sur le contrat public

- [x] Mêmes clés, même schéma Zod sur `GET /api/v1/app/version` — `backend-nest/src/modules/app-version/app-version-payload.ts:17`
- [x] Clients iOS et webapp intouchés (ils ne lisent que `minVersion`) — aucun fichier `ios/` ni `frontend/` dans le diff
- [x] Payload prod identique après déploiement — prod sert `{minVersion:1.0.0, latestVersion:1.3.0}`, Apple renvoie `1.3.0`, donc `max(1.3.0, 1.3.0) = 1.3.0`

### Phase 3 — Dégradation sûre

- [x] Apple injoignable ou timeout → valeur précédente/env servie, pas de 500 — `ios-version-gate.service.ts:116` + test `should keep the configured version when the App Store lookup fails`
- [x] Version non SemVer rejetée avant d'atteindre le schéma de réponse — `ios-version-gate.service.ts:9` + test `should ignore an App Store version that is not semver-shaped`
- [x] Aucune requête client n'attend Apple — `ios-version-gate.service.ts:82` (`void ... .finally()`)
- [x] Le plancher ne peut pas forcer un binaire indisponible — `ios-version-gate.service.ts:56` + tests `should clamp the floor...` / `should apply the floor as soon as...`
- [x] Le refine web `MIN <= LATEST` reste actif au boot — `backend-nest/src/config/environment.ts:80`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | 3 | `backend-nest/src/modules/encryption/encryption.e2e.spec.ts:114` | `app.init()` sur `AppModule` déclenche `onApplicationBootstrap`, donc un vrai appel sortant vers `itunes.apple.com` pendant la suite de tests. La suite dépend silencieusement de la joignabilité d'Apple, et le fetch fire-and-forget peut survivre au `app.close()`. | Ajouter `IOS_STORE_URL` sans identifiant (ex. `https://apps.apple.com/app/pulpe`) au bloc de force-override d'env du spec : depuis `cb7b94b4f` ce cas court-circuite sans réseau. |
| 🟡 | rot | 1 | `docs/VERSIONING.md:104` | Le paragraphe ne décrit que le refresh paresseux. Ni la pré-chauffe au bootstrap ni l'arrêt définitif du retry sur `IOS_STORE_URL` sans identifiant n'y figurent — incohérence doc/code introduite par `cb7b94b4f`. | Compléter la phrase : lookup au bootstrap puis paresseux, et un seul `warn` sans retry quand l'URL ne porte pas d'identifiant. |
| 🟢 | code | 3 | `backend-nest/src/modules/app-version/ios-version-gate.service.spec.ts` | `onApplicationBootstrap()` n'est couvert par aucun test ; c'est le comportement le plus récent du service. | Un test appelant `service.onApplicationBootstrap()` puis `flushPendingRefresh()`, assertant `mockFetch` appelé une fois. |
| 🟢 | code | 3 | `backend-nest/src/modules/app-version/ios-version-gate.service.ts:93` | `Number.POSITIVE_INFINITY` littéral : la valeur se lit, l'intention (« ne plus jamais réessayer ») non. Les autres TTL du fichier sont des constantes nommées. | Extraire `const NEVER_REFRESH_AGAIN = Number.POSITIVE_INFINITY;` à côté de `RETRY_TTL_MS`. |
| 🟢 | rot | 1 | `backend-nest/src/modules/app-version/ios-version-gate.service.ts:9` | `/^\d+\.\d+\.\d+$/` est dupliqué : 4 fois dans `environment.ts` (préexistant) et une nouvelle fois ici, alors que ce diff crée justement `@common/utils/semver-compare` comme point commun SemVer. | Exporter `SEMVER_PATTERN` depuis `backend-nest/src/common/utils/semver-compare.ts` et le consommer aux deux endroits. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (12/12)                                      |
| Files checked | `ios-version-gate.service.ts`, `ios-version-gate.service.spec.ts`, `app-version-payload.ts`, `app-version.controller.ts`, `app-version.module.ts`, `environment.ts`, `environment.spec.ts`, `semver-compare.ts`, `.env.example`, `docs/VERSIONING.md`, `docs/DEPLOYMENT.md`, `.claude/skills/release/SKILL.md`, `.claude/skills/release/references/ios-release.md` |
| Unchecked     | none                                              |
| Unplanned     | `onApplicationBootstrap` (pré-chauffe) et l'arrêt définitif du retry, tous deux issus de la review bot du round 3, hors objectif initial mais cohérents avec lui |
