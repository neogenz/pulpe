# Pulpe - Technical Context & Decision Records

> Technical decisions and stack details following MADR (Markdown Any Decision Records) 2026 standard.

---

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21+, Signals, Material 21, Tailwind v4 |
| Backend | NestJS 11+, Bun runtime |
| iOS | SwiftUI, Swift 6, Xcode 26+, XcodeGen |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Shared | TypeScript strict, Zod schemas |
| Orchestration | pnpm workspaces + Turborepo |

---

## Decisions

| ID | Title | Date |
|----|-------|------|
| DR-001 | Backend-First Demo Mode | 2025-06-15 |
| DR-002 | Automated Demo Cleanup | 2025-06-15 |
| DR-003 | Remove Variable Transaction Recurrence | 2025-07-20 |
| DR-004 | Typed & Versioned Storage Service | 2025-11-10 |
| DR-005 | Temp ID Replacement Before Toggle Cascade | 2026-01-30 |
| DR-006 | Split-Key Encryption for Financial Amounts | 2026-01-29 |
| DR-007 | Zoneless Testing — Child Input Signal Limitation | 2026-02-13 |
| DR-008 | Centralized ApiClient with Mandatory Zod Validation | 2026-02-13 |
| DR-009 | Signal Store Pattern with SWR | 2026-02-13 |
| DR-010 | Greenlight Preflight & FormTextField `hint:` Rename | 2026-03-16 |
| DR-011 | iOS Swift 6 Migration & Build Optimization | 2026-03-31 |
| DR-012 | VariableBlur for Progressive Blur Effects | 2026-04-10 |
| DR-013 | Onboarding Step Visibility & Apple App Store Compliance | 2026-04-12 |

---

## DR-013: Onboarding Step Visibility & Apple App Store Compliance

**Date**: 2026-04-12

### Problem

Apple a rejeté l'app parce qu'on demandait le prénom à un user authentifié via Apple Sign In alors que le provider le fournissait déjà. Au-delà du fix ponctuel, l'onboarding avait plusieurs paths divergents (social vs email) avec leur propre logique de skip — fragile, dur à maintenir, et le compteur de progression "X/Y" affichait des chiffres incohérents avec le nombre d'étapes réellement vues. Le path email se terminait sur RegistrationStep (form lourd) au lieu de BudgetPreview (peak-end), cassant l'arc émotionnel.

### Decision Drivers

- App Store : refus garanti si on collecte une donnée déjà fournie par le SDK social
- Le compteur de progression doit refléter exactement ce que le user voit (pas "5/7" pour quelqu'un qui ne fait que 4 étapes)
- Social et email convergent au même point fonctionnellement (création de budget = finale) — la divergence des paths code est artificielle
- Future-proof : si on rajoute des étapes conditionnelles (KYC, documents légaux, A/B variants), le pattern doit scaler sans dupliquer la logique de skip
- Peak-end rule : l'expérience doit se terminer sur la célébration du budget, pas sur un formulaire de credentials

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Skip ad-hoc inline (`if isSocial && hasName { skipFirstName }` dans `nextStep()`) | Rejected — duplique la logique entre forward/backward + counter + tests, fragile à chaque ajout |
| B | Visibility-driven step filter (`isStepVisible(_:)` central + `nextVisibleStep`/`previousVisibleStep` helpers) | Chosen |
| C | Deux flows séparés (`SocialOnboardingFlow` vs `EmailOnboardingFlow`) | Rejected — sur-engineering, casse le edit round-trip de BudgetPreview, duplique les étapes financières |

### Decision

1. **`isStepVisible(_:)`** central sur `OnboardingState` détermine la visibilité de chaque step en fonction de l'auth state : welcome toujours visible ; `firstName` masqué pour social-with-name ; `registration` masqué une fois authentifié ; le reste toujours visible
2. **`nextVisibleStep(after:)` / `previousVisibleStep(before:)`** helpers privés consommés par `nextStep()` / `previousStep()` — un seul mécanisme de skip, pas de cas particuliers
3. **`progressBarSteps: [OnboardingStep]`** computed feedé à `OnboardingProgressIndicator` → le compteur affiche exactement les étapes vraiment vues (4/4 social-with-name, 5/5 social-private-relay, 6/6 email)
4. **Unified auth model** : `authenticatedUser` + `readyToComplete` remplacent `socialUser` + `readyForSocialCompletion`. Les deux paths convergent vers `finishOnboarding()` déclenché depuis BudgetPreview comme finale unique
5. **`socialProvidedName` flag** stable (set une fois dans `configureSocialUser`) — la visibilité ne shift pas pendant que l'user tape son nom dans firstName
6. **Implicit consent** : checkbox CGU supprimée en faveur d'un disclosure inline (`OnboardingConsentText` shared component) couvrant social ET email
7. **Cold-start session recovery** via `wasEmailRegistered` flag persisté dans `OnboardingStorageData` + `AuthService.validateSession()` au mount

### Rationale

- L'option A fixerait le rejet Apple mais laisserait la duplication entre forward/backward + counter + tests — chaque future contrainte ajouterait une nouvelle paire de skips à maintenir
- L'option B unifie tout : un seul prédicat de visibilité, helpers de navigation et counter en dérivent. Ajouter une contrainte future = un seul `case` dans `isStepVisible(_:)`
- L'option C casse le `editReturnStep` round-trip (deux struct types ne partagent pas leur state observable) et duplique tout le code des étapes financières
- Le `socialProvidedName` doit être un flag stable (pas calculé depuis `firstName.isEmpty`) parce que sinon la visibilité change quand l'user tape → le compteur shift mid-flow → confusion
- Le path email n'a pas besoin d'un finale différent du path social : BudgetPreview est la célébration légitime des deux

### Consequences

- **Positive** : Rejection App Store résolue ; compteur honnête sur tous les paths ; un seul chemin de code pour ajouter des étapes conditionnelles à l'avenir
- **Positive** : Les deux paths convergent vers BudgetPreview comme finale → peak-end rule respectée pour tous les users (la dernière chose qu'ils voient avant le PIN setup, c'est leur budget, pas un form)
- **Positive** : `editReturnStep` round-trip fonctionne sur le path unifié sans branchement (l'user peut éditer Revenus/Charges/Épargne depuis BudgetPreview et revenir automatiquement)
- **Trade-off** : Consent implicite inline (`OnboardingConsentText`) au lieu d'une checkbox explicite — couvre social ET email mais à surveiller si évolution réglementaire (GDPR, FADP suisse). Documentation marketing/légale doit refléter le pattern
- **Trade-off** : Cold-start recovery email dépend de `AuthService.validateSession()` au `.task` du flow — une session expirée silencieusement reset le user à `.welcome` (acceptable, mais faut le savoir lors du debug)
- **Impact** : `OnboardingState.swift` (visibility helpers + unified auth state), `OnboardingStep.swift` (enum extrait pour SwiftLint file-length), `OnboardingFlow.swift` (consume `progressBarSteps` + cold-start recovery), `OnboardingProgressIndicator.swift` (interface refactor : `progressSteps: [OnboardingStep]` au lieu de `totalSteps: Int`), tous les `Steps/*.swift` (alignment), `OnboardingConsentText.swift` (nouveau shared component)

### Notes

- **Règle pour future onboarding work** : si tu veux ajouter une étape conditionnelle, ajoute son cas dans `isStepVisible(_:)` — ne **JAMAIS** skip inline dans `nextStep()` / `previousStep()`. Le pattern visibility est conçu pour scaler.
- **Règle Apple App Store** : ne **JAMAIS** demander une donnée que le provider social fournit déjà (firstName, email, photo). Tester systématiquement le path Apple Sign In avec un compte qui partage le nom complet avant submission.
- Le pattern visibility est extensible : KYC, documents légaux, étapes payment, A/B test variants — tous peuvent devenir conditionnels via le même mécanisme sans toucher la navigation
- Le `OnboardingStep` enum a été extrait dans son propre fichier (`OnboardingStep.swift`) pour passer la limite SwiftLint `file_length` sur `OnboardingState.swift` après le refactor
- Implémentation : commits `5e5b24b33` (unification refactor), `d70509497` (polish + lighter form), `a7c557e46` (clean code follow-up)

---

## DR-012: VariableBlur for Progressive Blur Effects

**Date**: 2026-04-10

### Problem

Les écrans d'onboarding et de login utilisent un fond en dégradé (`loginGradientBackground` : vert → dark). Un fade par `LinearGradient` vers une couleur fixe ne matche jamais le fond à toutes les positions. Un `.ultraThinMaterial` masqué par gradient crée une bande grisâtre visible sur fond sombre. Aucune API publique SwiftUI ne permet un blur à rayon variable (gaussien qui fade de max → 0).

### Decision Drivers

- Le fond est un gradient multi-couleurs — un fade monochrome crée toujours un mismatch visible
- `.ultraThinMaterial` + gradient mask testé et rejeté — rendu laid sur fond sombre (bande frosted visible)
- Apple utilise la même API privée (`CAFilter` gaussian variable sigma) dans Music, Photos, Safari
- Le package [nikstar/VariableBlur](https://github.com/nikstar/VariableBlur) (500+ stars) expose cette API

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: LinearGradient color fade | Gradient vers `onboardingFormBase` | Rejected — mismatch sur fond gradient |
| B: `.ultraThinMaterial` + gradient mask | Material blur masqué | Rejected — bande frosted visible sur fond sombre |
| C: VariableBlur (private API) | Vrai blur gaussien à rayon variable | Chosen — seule solution visuellement correcte |
| D: Pas de blur | Clipping simple du contenu | Rejected — UX inférieure |

### Decision

Ajouter `nikstar/VariableBlur` v1.3.0 comme dépendance SPM. Wrapper dans `ProgressiveBlurEdge` (composant partagé dans `Shared/Components/`) utilisé sur :
- **Login** : top overlay avec `.ignoresSafeArea(edges: .top)` pour couvrir le Dynamic Island
- **Onboarding** : bottom overlay avec `.ignoresSafeArea(edges: .bottom)` sous le floating button
- **Onboarding top** : conserve un `LinearGradient` simple (le fond à ce niveau est déjà proche de `onboardingFormBase`)

### Rationale

- `VariableBlurView` change le **rayon** du blur (max → 0), pas l'opacité d'un material fixe — transition visuellement invisible quel que soit le fond
- API privée (`CAFilter`) mais identique à ce qu'Apple utilise dans ses propres apps — approuvé App Store à ce jour
- Package léger (~200 lignes), pas de dépendances transitives, iOS 13+
- Les alternatives publiques SwiftUI ont toutes été testées et rejetées pour des raisons visuelles concrètes

### Consequences

- **Positive** : Blur progressif natif sur n'importe quel fond (gradient, image, couleur)
- **Risk** : API privée — Apple pourrait bloquer `CAFilter` en App Store review. Le package est utilisé en production par de nombreuses apps sans rejet connu, mais le risque existe.
- **Fallback** : Si rejeté, revenir au `LinearGradient` color fade (déjà implémenté comme alternative sur le top onboarding)
- **Impact** : `project.yml` (nouvelle dépendance), `ProgressiveBlurEdge.swift`, `OnboardingFlow.swift`, `LoginView.swift`

### Notes

- **iOS 26 a introduit `scrollEdgeEffectStyle(.soft, for: .bottom)`** — API native qui fait exactement le même job (blur + dim aux bords du scroll, gestion safe area + clavier automatique). Considérer une migration avec `@available(iOS 26, *)` quand le deployment target le permet.
- **Modifier ordering critique** : `.ignoresSafeArea(edges:)` doit être appliqué AVANT `.frame(height:)` pour que la vue s'étende dans la safe area. `ProgressiveBlurEdge` applique `.frame` en interne — pour les cas nécessitant `.ignoresSafeArea`, inliner `VariableBlurView` directement et respecter l'ordre.
- **Overlays séparés** : quand le blur et un bouton flottant ont des besoins de safe area différents, utiliser deux `.overlay()` distincts — un ZStack partagé absorbe `.ignoresSafeArea` sans étendre les enfants.
- Le `LinearGradient` reste utilisé pour le top onboarding où le fond est quasi-monochrome à ce niveau — pas besoin de vrai blur

---

## DR-011: iOS Swift 6 Migration & Build Optimization

**Date**: 2026-03-31

### Problem

Le projet iOS utilisait Swift 5.9 avec `SWIFT_STRICT_CONCURRENCY: complete` (warnings). Le build clean prenait ~52s avec un hotspot de type-checking de 5.2s sur `RootView.body` (133 lignes de modifiers chaînés). Plusieurs build settings n'étaient pas optimisés.

### Decision Drivers

- Swift 6 rend les violations de concurrency en erreurs — le projet était déjà prêt (0 warning)
- `RootView.body` de 133 lignes causait un bottleneck type-checker sur le chemin critique du build
- Build settings par défaut de XcodeGen n'activaient pas `EAGER_LINKING` ni `ONLY_ACTIVE_ARCH`
- `COMPILATION_CACHING` testé et évalué deux fois (Swift 5.9 et Swift 6)

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Swift 6 + build optimization | Upgrade + refactor body + build settings | Chosen |
| B: Rester en Swift 5.9 | Pas de migration, attendre Swift 6.x mature | Rejected — déjà prêt, zéro risque |
| C: `-default-isolation MainActor` (Swift 6.2) | Tout MainActor par défaut | Rejected — ratio effort/bénéfice mauvais, ~60+ types à opt-out |
| D: `COMPILATION_CACHING: YES` | Cache de compilation Xcode | Rejected — overhead scan +32% sur cached clean builds, projet trop petit (292 fichiers) |

### Decision

1. **Swift 6** : `SWIFT_VERSION: "6"` — 0 erreur app, 10 fixes tests (`nonisolated(unsafe)` pour captured vars, `Task.init` au lieu de `TaskGroup.addTask` pour contourner la limitation `sending` + `@MainActor`)
2. **Refactor `RootView.body`** : Extraction en 2 `ViewModifier` (`RootViewAlerts`, `RootViewSheets`) + méthode `handleAppStart()` — type-check 5254ms → 715ms
3. **Build settings** : `EAGER_LINKING: YES`, `ONLY_ACTIVE_ARCH: YES` dans `project.yml` base settings
4. **`Task(name:)`** (Swift 6.2) : 8 tasks stockées/cancellables nommées pour visibilité Instruments
5. **`COMPILATION_CACHING`** : évalué et **rejeté** — l'overhead de `ScanDependencies` (23s vs 10s) et `SwiftDriver` (33s vs 20s) dépasse les gains pour ce volume de code

### Rationale

- Swift 6 = 0 effort car `SWIFT_STRICT_CONCURRENCY: complete` avait déjà éliminé toutes les violations
- Le refactor ViewModifier casse la chaîne de type-checking en unités indépendantes — gain mesurable sur le chemin critique
- `-default-isolation MainActor` rejeté : retire ~44 annotations `@MainActor` (cosmétique) mais force l'ajout de `nonisolated` à ~60+ types/protocols (risque de régression sur les actors conformant aux protocols `Sendable`)
- `COMPILATION_CACHING` rejeté après 2 benchmarks (Swift 5.9 et Swift 6) : le projet à 292 fichiers Swift ne génère pas assez de cache hits pour compenser le coût de vérification. À réévaluer à 500+ fichiers.

### Consequences

- **Positive** : Clean build ~49s (vs 52s), type-check `PulpeApp.body` 86% plus rapide, Swift 6 full strict
- **Trade-off** : `nonisolated(unsafe)` dans 6 fichiers de tests — acceptable car closures séquentielles sur `@MainActor`
- **Trade-off** : `ONLY_ACTIVE_ARCH: YES` en base (toutes configs) — correct pour iOS (arm64 uniquement) mais à vérifier si un target macOS/Catalyst est ajouté
- **Impact** : `project.yml`, `PulpeApp.swift`, 10 fichiers tests, 6 fichiers stores (Task naming), 5 fichiers rules/agent

### Notes

- `ForEach(array.enumerated())` sans `Array()` : pas applicable, la conformance `Collection` de `EnumeratedSequence` est gated iOS 26.0+ et le deployment target est iOS 18.0
- Surveiller Swift 6.3+ pour une amélioration du `COMPILATION_CACHING` et une stabilisation de `-default-isolation MainActor`

---

## DR-010: Greenlight Preflight & FormTextField `hint:` Rename

**Date**: 2026-03-16

### Problem

L'outil `greenlight preflight` (scanner App Store pre-submission) flaggait deux faux positifs sur le mot "placeholder" :
1. Le paramètre `placeholder:` de `FormTextField` — détecté comme contenu placeholder user-facing
2. La méthode `placeholder(in:)` du protocol `TimelineProvider` (WidgetKit) — une méthode Apple obligatoire

### Decision Drivers

- Greenlight v0.1.0 (Homebrew) n'a pas de mécanisme d'ignore/suppress (pas de config, pas de comment inline)
- `placeholder(in:)` est requis par Apple sur `TimelineProvider`, `IntentTimelineProvider` ET `AppIntentTimelineProvider` (iOS 17+) — aucune alternative
- Le scan doit retourner 0 findings pour le CI

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Renommer `FormTextField.placeholder:` → `hint:` | Supprime le faux positif #1 | Chosen |
| B: Déplacer le fichier widget hors de `ios/` | Le scanner ne le trouve plus | Rejected — code smell |
| C: Script wrapper avec filtre `jq` | Filtre les faux positifs connus | Rejected — masque les vrais problèmes |
| D: Build greenlight from source (main) | Le `main` branch a des `ignorePatterns` pour WidgetKit | Chosen |

### Decision

1. **FormTextField** : renommer le paramètre `placeholder:` → `hint:` dans `FormTextField` et ses 7 call sites
2. **WidgetKit** : installer greenlight depuis `main` (pas la release Homebrew 0.1.0) car le code source a déjà des `ignorePatterns` pour `func placeholder(` mais ce fix n'est pas encore dans la release Homebrew

### Rationale

- `hint:` est sémantiquement correct (c'est le hint text d'un TextField) et évite le grep bête du scanner
- Le fix WidgetKit existe dans le source Go de greenlight (`internal/codescan/rules.go`) avec un `ignorePatterns` explicite pour `func\s+placeholder\s*\(`, mais le tag v0.1.0 ne l'inclut pas
- Pas de solution propre côté code Swift — la méthode `placeholder(in:)` est un requirement protocolaire Apple non-modifiable

### Consequences

- **Positive** : 0 findings greenlight avec la version `dev` buildée depuis `main`
- **Trade-off** : Dépendance à une version non-released de greenlight — surveiller la prochaine release Homebrew pour repasser sur `brew install`
- **Impact** : `FormTextField.swift`, 7 call sites renommés, `CLAUDE.md` iOS mis à jour

### Notes

- Quand greenlight publie une nouvelle release Homebrew avec les `ignorePatterns`, repasser sur `brew install revylai/tap/greenlight` et supprimer le binary custom de `/opt/homebrew/bin/`
- La version actuelle installée : `greenlight dev` (build from `main` 2026-03-16)
- Commande d'installation : `git clone https://github.com/RevylAI/greenlight.git && go build -o greenlight ./cmd/greenlight`

---

## DR-009: Signal Store Pattern with SWR

**Date**: 2026-02-13

### Problem

Les stores utilisaient des `Subject` + `concatMap` RxJS pour les mutations et affichaient un spinner plein écran à chaque refetch, même pour un refresh en arrière-plan.

### Decision Drivers

- Angular 21+ signals-first : RxJS mutation queues ajoutent de la complexité inutile
- UX : l'utilisateur préfère voir des données stales plutôt qu'un spinner à chaque navigation

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: RxJS mutation queue + spinner systématique | Conserver `Subject` + `concatMap` + `isLoading` global | Rejected — over-engineered |
| B: async/await mutations + SWR pattern | Mutations directes, `isInitialLoading` pour spinner initial uniquement | Chosen |

### Decision

Standardiser un store pattern en 6 sections (Dependencies, State, Resource, Selectors, Mutations, Private utils) avec :
- Mutations en async/await direct (plus de Subject queue)
- `isInitialLoading = computed(() => resource.status() === 'loading')` pour spinner initial uniquement
- Données stales visibles pendant le reloading

### Consequences

- **Positive** : Code plus simple, meilleure UX (pas de flash spinner)
- **Trade-off** : Pas de queueing intégré (pas nécessaire au volume actuel)
- **Impact** : `BudgetDetailsStore`, `CurrentMonthStore`, `BudgetTemplatesStore` refactorisés

---

## DR-008: Centralized ApiClient with Mandatory Zod Validation

**Date**: 2026-02-13

### Problem

Les services API injectaient `HttpClient` directement avec un error handling et une validation incohérents entre les features.

### Decision Drivers

- Pas de validation runtime des réponses API → bugs silencieux si le contrat backend change
- Error handling dupliqué dans chaque service
- Pas de normalisation des erreurs (format différent par service)

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: HttpClient direct | Chaque service gère ses erreurs et parsing | Rejected — incohérent |
| B: ApiClient centralisé avec Zod | Un service unique avec validation obligatoire | Chosen |

### Decision

Tous les appels HTTP passent par `ApiClient` (`core/api/api-client.ts`) avec un schéma Zod obligatoire. Les feature APIs (`BudgetApi`, `TemplateApi`, etc.) retournent des `Observable<T>` validés.

### Consequences

- **Positive** : Validation runtime, error handling uniforme, meilleur debugging
- **Trade-off** : Chaque endpoint nécessite un schéma Zod
- **Impact** : 10+ services migrés (BudgetApi, TransactionApi, TemplateApi, EncryptionApi, UserSettingsApi, BudgetLineApi, BudgetTemplatesApi, ProfileSetupService, DemoInitializerService)

### Notes

- `ApplicationConfiguration` est la seule exception : elle charge `config.json` (asset statique) via `HttpClient` direct car `ApiClient` dépend d'elle pour `backendApiUrl` (dépendance circulaire).

---

## DR-007: Zoneless Testing — Child Input Signal Limitation

**Date**: 2026-02-13

### Problem

Lors du durcissement des tests `reset-password.spec.ts` (remplacement des lectures de signaux privés par des assertions DOM), les assertions ciblant des composants enfants (`ErrorAlert`, `LoadingButton`) échouent systématiquement. En mode zoneless (`provideZonelessChangeDetection()`), les `input()` signal des composants enfants ne se mettent pas à jour via `fixture.detectChanges()`, même après plusieurs cycles.

### Decision Drivers

- `ErrorAlert` : `message = input<string | null>(null)` — le `@if (message())` reste faux après `detectChanges()`
- `LoadingButton` : `disabled = input(false)` — le `<button>` interne garde `disabled` à sa valeur initiale
- Comportement reproductible à 100% sur Vitest + Angular 21 + `provideZonelessChangeDetection()`

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Assertions DOM sur composants enfants | Lire `getErrorAlertText()` / `button.disabled` | Rejected — flake 100% |
| B: Assertions directes sur signaux parent | Garder `component['errorMessage']()` / `component['canSubmit']()` | Chosen |
| C: Material Harnesses | Utiliser les harnesses Angular Material | Deferred — overhead disproportionné pour ce lot |

### Decision

Conserver les lectures de signaux privés (`component['...']()`) pour les assertions qui traversent des composants enfants à `input()` signal. Limiter les assertions DOM aux éléments rendus directement dans le template du composant parent (`@if`/`@else` blocks, `data-testid` sur éléments natifs).

### Rationale

- Les assertions DOM parent fonctionnent (`[data-testid="reset-password-form"]`, `mat-spinner` présence/absence) car elles testent la visibilité conditionnelle dans le template parent
- Les assertions DOM enfant échouent car le binding `[message]="errorMessage()"` vers un `input()` signal enfant n'est pas propagé par `detectChanges()` en mode zoneless
- Le couplage signal privé est acceptable en test : il ne fuit pas dans le code de production et reste stable tant que l'API interne ne change pas

### Consequences

- **Positive** : Tests stables (57/57, 10/10 runs), pas de flakiness
- **Trade-off** : ~13 accès `component['...']` restants dans `reset-password.spec.ts` au lieu de ~8
- **Trade-off** : Dette de test documentée — révisable si Angular corrige le comportement zoneless en test

### Notes

- Limitation confirmée sur : `ErrorAlert` (`ui/error-alert`), `LoadingButton` (`ui/loading-button`)
- Pattern valide pour assertions DOM parent : `@if`/`@else` conditionals, présence/absence d'éléments natifs
- Pattern invalide pour assertions DOM enfant : `input()` signal bindings sur composants OnPush

## DR-005: Temp ID Replacement Before Toggle Cascade

**Date**: 2026-01-30

### Problem

Creating a transaction under a checked parent budget line triggered a 404 error. The store called `toggleCheck` on the parent **before** replacing the temp ID (`temp-xxx`) with the real server ID. The cascade (`calculateBudgetLineToggle`) then included temp IDs in `transactionsToToggle`, causing `POST /transactions/temp-xxx/check → 404`.

### Decision Drivers

- Optimistic updates generate temp IDs (`temp-${uuidv4()}`) for immediate UI feedback
- `calculateBudgetLineToggle` is a pure function that returns whatever IDs are in state
- API calls require real server-assigned UUIDs

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Reorder operations | Replace temp ID before triggering cascade | Chosen |
| B: Filter temp IDs in cascade | Skip `temp-*` IDs in `transactionsToToggle` | Rejected |

### Decision

In `createAllocatedTransaction()`, replace the temp ID with the server response **before** triggering the parent budget line's `toggleCheck` cascade.

### Rationale

- Option A fixes the root cause (ordering) without coupling the pure utility to ID format conventions
- Option B would leak implementation details (`temp-` prefix) into `calculateBudgetLineToggle`
- Pure functions should not know about temp ID conventions — the store controls operation ordering

### Consequences

- **Positive**: No temp IDs reach API calls; pure functions remain agnostic
- **Trade-off**: Sequential await (replace → then toggle) instead of parallel
- **Impact**: `budget-details-store.ts:519-530` reordered

### Notes

Pattern applies to any optimistic update followed by cascade: always resolve temp IDs before triggering dependent operations.

---

## DR-001: Backend-First Demo Mode

**Date**: 2025-06-15

### Problem

Needed demo mode for product exploration without signup.

### Decision Drivers

- Must behave identically to production
- Cannot maintain parallel frontend-only simulation
- Must reuse existing RLS policies

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Real ephemeral users | Create Supabase users with `is_demo: true` | Chosen |
| B: Frontend localStorage mock | Simulate state in browser | Rejected |

### Decision

Create real ephemeral Supabase users with JWT tokens.

### Rationale

- Guarantees identical behavior to production (no simulation drift)
- Reuses existing RLS policies and business logic
- Simplifies frontend (same code paths for demo/real users)

### Consequences

- **Positive**: No simulation drift, full backend validation
- **Trade-off**: Requires cleanup cron job (see DR-002)
- **Dependencies**: Supabase Auth, RLS policies

### Notes

Stack-specific: Supabase cascade delete handles cleanup of related tables automatically.

---

## DR-002: Automated Demo Cleanup Strategy

**Date**: 2025-06-15

### Problem

Need to prevent database bloat from abandoned demo users.

### Decision Drivers

- Must run automatically without manual intervention
- Should balance cleanup frequency vs DB load
- Must not affect active demo sessions

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Automated cron job | Every 6 hours, 24h retention | Chosen |
| B: Manual cleanup only | Admin triggers manually | Rejected |

### Decision

Automated cron job cleanup with:
- Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Retention: 24 hours from user creation
- Manual endpoint: Dev-only for testing/emergency cleanup

### Rationale

- 24h retention: Sufficient exploration time without excessive DB usage
- 6h interval: Balances cleanup frequency vs DB load
- Supabase cascade delete: Automatic cleanup of budgets/transactions/templates

### Consequences

- **Positive**: Zero maintenance overhead
- **Trade-off**: Users lose demo data after 24h (acceptable for demo)
- **Dependencies**: Supabase scheduled functions, cascade delete

### Notes

Consider adding warning toast at 23h mark if user session is still active.

---

## DR-003: Remove Variable Transaction Recurrence

**Date**: 2025-07-20

### Problem

Initial design included `monthly`/`one_off` recurrence for transactions, adding unnecessary complexity.

### Decision Drivers

- Aligns with "Planning > Tracking" philosophy
- Reduces frontend/backend complexity
- YAGNI principle

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Remove recurrence | Transactions always one-off | Chosen |
| B: Keep recurrence | Support recurring transactions | Rejected |

### Decision

Remove recurrence entirely from transactions:
- Budget lines: Keep frequency (`fixed`/`one_off`) for planning
- Transactions: Always one-off manual entries

### Rationale

- Budget lines = plan, transactions = reality
- Recurring patterns belong in templates/budget lines, not transactions
- Simplifies transaction model significantly

### Consequences

- **Positive**: Cleaner separation between planning and tracking
- **Trade-off**: No automated recurring transaction support
- **Impact**: Removed `recurrence` column from transaction table

### Notes

If users request recurring transactions in future, implement as "auto-generated budget lines" rather than transaction recurrence.

---

## DR-004: Typed & Versioned Storage Service

**Date**: 2025-11-10

### Problem

Bug de fuite de données entre utilisateurs (données localStorage persistantes après logout). Fix initial par nettoyage des clés `pulpe-*` mais approche fragile.

### Decision Drivers

- Type-safety required for compile-time errors
- Need automatic migrations when schema changes
- Must distinguish user-scoped vs app-scoped data

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Typed storage service | Centralized registry with versioning | Chosen |
| B: Prefix convention | Clean `pulpe-*` keys on logout | Rejected |

### Decision

Implement a typed storage service with:
- Centralized registry with strong typing
- Zod validation on read
- Versioning per key: `{ version, data, updatedAt }`
- Automatic migrations at startup
- `user-scoped` vs `app-scoped` distinction

### Rationale

- Type-safety: Compile-time errors for wrong key/value
- Evolvability: Automatic migrations on schema changes
- Maintainability: Single source of truth for all keys
- Debugging: Versioning enables state tracing

### Consequences

- **Positive**: Eliminates class of storage bugs
- **Trade-off**: Initial implementation overhead
- **Dependencies**: Zod schemas

### Notes

Implémenté. Le service est dans `core/storage/`.

---

## DR-006: Split-Key Encryption for Financial Amounts

**Date**: 2026-01-29

### Problem

L'administrateur Supabase peut lire tous les montants financiers en clair (`NUMERIC(12,2)`) via le Dashboard ou un client SQL. Pulpe revendique la confidentialité des données financières — cette promesse doit être techniquement réelle avant tout lancement public.

### Decision Drivers

- L'admin (propriétaire du projet) ne doit pas pouvoir décrypter les données utilisateurs
- Le backend doit pouvoir effectuer les calculs (rollover, sommes, soldes)
- Le code crypto côté client doit rester minimal (3 plateformes : Angular, SwiftUI, Android)
- Les 3 utilisateurs existants en production ne doivent perdre aucune donnée

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Server-side only (master key) | Backend chiffre avec une clé env var | Rejected — admin peut décrypter |
| B: Client-side E2E | Tout le chiffrement dans le navigateur/app | Rejected — backend ne peut plus calculer |
| C: Split-key (client PBKDF2 + backend HKDF) | DEK dérivée de deux parts : clientKey (mot de passe) + masterKey (env var) | Chosen |

### Decision

Architecture split-key :
- **Client** : dérive un `clientKey` depuis le code PIN via PBKDF2 (600k itérations, SHA-256)
- **Backend** : combine `clientKey` + `masterKey` via HKDF → DEK utilisée pour AES-256-GCM
- **DEK jamais stockée** : dérivée à chaque requête, jetée après traitement (cache 5 min en mémoire)
- **Table `user_encryption_key`** : stocke `salt`, `kdf_iterations`, `key_check` (canary), `wrapped_dek` (recovery)
- **Recovery key** : DEK wrappée avec une clé de récupération utilisateur (AES-256-GCM)
- **Colonnes chiffrées** : `amount`, `target_amount`, `ending_balance` sont des colonnes `text` contenant des ciphertexts base64

### Rationale

- masterKey seule insuffisante pour décrypter → admin ne peut pas lire les données at rest
- Backend voit les données en clair en mémoire pendant les requêtes → permet les calculs serveur
- PBKDF2 côté client = quelques lignes natives (Web Crypto API, CryptoKit, JCA) → pas de lib tierce

### Consequences

- **Positive** : Claim marketing "même l'admin ne peut pas décrypter sans votre code PIN" techniquement vrai
- **Trade-off** : Perte de code PIN sans recovery key = perte d'accès aux données
- **Trade-off** : Changement de mot de passe re-chiffre toutes les données (négligeable au volume actuel)
- **Trade-off** : ~300-500ms de PBKDF2 au login côté client (une seule fois)
- **Dependencies** : Web Crypto API (Angular), CryptoKit (SwiftUI), JCA (Android)

### Notes

- Issue GitHub : [#274](https://github.com/neogenz/pulpe/issues/274)
- Tables impactées : `budget_line`, `transaction`, `template_line`, `savings_goal`, `monthly_budget`
- Le re-chiffrement row-by-row est acceptable pour le volume actuel ; à batcher si >1000 users

---

*See `systemPatterns.md` for architecture patterns.*
*See `INFRASTRUCTURE.md` for deployment and CI/CD.*
