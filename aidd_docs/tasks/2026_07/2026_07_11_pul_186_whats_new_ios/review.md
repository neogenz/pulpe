# Review: PUL-186 What's New iOS

- **Verdict**: changes-requested
- **Diff**: `origin/preview...maximedesogus/pul-186-afficher-une-dialog-de-nouveautes-apres-mise-a-jour-ios`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_15
- **Findings**: 0 critical, 3 warning, 2 minor

## Phases

### Phase 1 — Aligner le contrat et les données sur les versions iOS

- [x] Les releases iOS portent une `iosVersion` distincte de la version produit sans modifier le rendu landing — `landing/data/releases.json:20`, `backend-nest/src/modules/whats-new/releases-data.ts:31`
- [x] Le backend filtre dans l'espace `MARKETING_VERSION`, couvre `1.0.4 → 1.1.0`, les plages vides et valide le dataset complet — `backend-nest/src/modules/whats-new/whats-new-payload.ts:44`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:164`
- [x] Les releases produit partageant un même binaire iOS sont agrégées sous une seule version SwiftUI — `backend-nest/src/modules/whats-new/whats-new-payload.ts:45`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:130`
- [ ] La procédure autorise une version sans note tout en empêchant une projection mal mappée — `ios-release.md:32` autorise l'absence de projection, `ios-release.md:71` exige pourtant deux copies, et `releases-data.ts:12` rend `iosVersion` omissible

### Phase 2 — Fiabiliser migration, authentification et idempotence

- [x] Première installation, migration pré-PUL-186 et baseline `1.0.4` sont distinguées et testées — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:42`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:8`
- [x] Tout passage vers `.authenticated` déclenche uniquement le contrôle What's New ; le chargement métier initial reste dans `handleAppStart()` — `ios/Pulpe/App/RootViewModifiers.swift:150`, `ios/Pulpe/App/PulpeApp.swift:356`
- [x] Les contrôles concurrents ou pendant une présentation sont coalescés et l'événement n'est émis qu'à la présentation effective — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:32`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:129`
- [x] Réponse vide, erreur réseau et dismissal ont chacun une sémantique de marqueur explicite et testée — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:73`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:64`

### Phase 3 — Finaliser la présentation et prouver le parcours complet

- [x] Les dates valides sont localisées et la chaîne brute reste le fallback — `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:98`, `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:136`
- [x] Dynamic Type, scroll et action principale utilisent les composants et tokens existants — `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:13`, `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:44`
- [x] Les validations du commit `9d177039` passent — GitHub PR #498 : `CI Success`, iOS, unitaires, intégration, E2E, quality, CodeQL et Vercel verts
- [x] Le parcours réel affiche une seule sheet après authentification et persiste le dismissal — `ios/Pulpe/App/RootViewModifiers.swift:85`, `ios/Pulpe/Domain/Store/WhatsNewStore.swift:99`
- [ ] La review finale ne contient aucun warning et chaque thread GitHub dispose d'une conclusion — 9 threads non obsolètes restent ouverts sur la PR #498

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | 1 | `.claude/skills/update-changelog/references/ios-release.md:32,71` | Le cas valide « nouvelle version sans note » laisse le backend inchangé, puis le préflight exige malgré tout la version dans les deux copies et déclare la release non prête. | Rendre le contrôle conditionnel : parité des deux copies lorsqu'une projection existe ; sinon vérifier la version canonique et l'absence intentionnelle de projection avant la synchro Railway. |
| 🟡 warning | code | 1 | `backend-nest/src/modules/whats-new/releases-data.ts:6-12` | Une projection backend peut omettre `iosVersion`, compiler, puis être exclue silencieusement avant la validation globale ; une future note utile peut donc ne jamais être servie. | Rendre `iosVersion` obligatoire dans `WhatsNewReleaseEntry` ; représenter une version sans note par l'absence d'entrée, pas par une entrée incomplète. |
| 🟡 warning | functional | 3 | `GitHub PR #498 review threads` | 9 threads non obsolètes restent sans conclusion, y compris des retours déjà corrigés et deux suggestions sur le HEAD courant. | Répondre avec la preuve de correction ou la décision motivée, puis résoudre chaque thread. |
| 🟢 minor | conform | 1 | `backend-nest/src/modules/whats-new/whats-new.controller.ts:54` | Le contrôleur appelle la construction métier directement, contrairement à l'architecture backend déclarée ; l'impact reste faible pour ce read-model pur et sans dépendance. | Passer par un use-case léger, ou documenter une exception de read-model applicable aussi au module analogue `app-version`. |
| 🟢 minor | code | 2 | `ios/Pulpe/Domain/Store/WhatsNewStore.swift:92` | L'annulation normale de `.task(id:)` est journalisée comme une erreur réseau, ce qui pollue le diagnostic sans casser le retry. | Intercepter `CancellationError` séparément et conserver le `catch` d'erreur pour les échecs réels. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 85% (11/13) |
| Files checked | Plan et 3 phases, skill/referentiel de release, données landing/backend, payload/controller/tests NestJS, schémas partagés, flags/store/lifecycle/sheet/tests iOS, diff complet, checks et threads GitHub |
| Unchecked | Phase 1 — invariant release sans note et mapping obligatoire — fix ; Phase 3 — conclusions des threads de review — fix |
| Unplanned | none |
