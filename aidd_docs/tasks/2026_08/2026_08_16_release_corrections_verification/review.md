# Review: Corrections pré-release vérifiées

- **Verdict**: approve
- **Diff**: `27015f8848168853be84f8aac80cdb54a10b19ee...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_17
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Localisation web et landing

- [x] La période d’un budget de mars suit la langue d’interface EN/DE/IT — `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts:151`, `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.spec.ts:80`
- [x] Support et changelog possèdent leurs cartes sociales localisées, et le guide reste un article — `landing/components/pages/metadata.ts:17`, `landing/components/pages/metadata.ts:36`, `landing/components/pages/metadata.ts:55`, `landing/app/accessibility.test.tsx:1541`
- [x] Les liens CGU et confidentialité propagent FR/EN/DE/IT vers les bons chemins Angular — `landing/components/sections/Footer.tsx:41`, `landing/components/sections/Footer.tsx:123`, `landing/app/accessibility.test.tsx:1837`
- [x] Les suites ciblées, le type-check landing et le build Next réussissent — validation fournie : Angular budget 6/6, landing 66/66, type-check réussi, build réussi avec 21 pages

### Phase 2 — Retry sûr après confirmation de la clé de récupération

- [x] Après confirmation et échec metadata, le retry reste disponible sans réactiver le formulaire — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:246`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:278`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:429`
- [x] Le PIN, sa confirmation et `rememberDevice` restent verrouillés après confirmation — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:308`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:343`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:431`
- [x] Le retry rejoue deux écritures metadata et une seule fois chaque étape cryptographique et le dialogue — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:297`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:437`
- [x] La spec ciblée et son type-check réussissent — validation fournie : coffre Angular 43/43 et quality frontend réussie

### Phase 3 — Dernier choix de langue gagnant sur iOS

- [x] Aucune complétion obsolète ne modifie `locale`, `AppLocale`, `error` ni le timestamp, y compris après `reset` — `ios/Pulpe/Domain/Store/UserSettingsStore.swift:60`, `ios/Pulpe/Domain/Store/UserSettingsStore.swift:91`, `ios/Pulpe/Domain/Store/UserSettingsStore.swift:110`, `ios/Pulpe/Domain/Store/UserSettingsStore.swift:153`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:183`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:224`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:280`
- [x] Le service contrôlé suspend les écritures et les lectures, y compris une annulation URLSession encapsulée, sans délai temporel fragile — `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:5`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:53`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:128`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:224`
- [x] Les PUT sont sérialisés, les échecs restaurent la dernière locale confirmée et les deux ordres GET/PUT gardent `.it` publié et distant sans erreur obsolète — `ios/Pulpe/Domain/Store/UserSettingsStore.swift:166`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:128`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:158`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:183`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:224`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:247`
- [x] Swift Testing exécute la suite ciblée et Xcode réussit — validation fournie : 11/11 et `** TEST SUCCEEDED **`; SwiftLint ciblé strict réussi

### Phase 4 — Contrat atomique des mises à jour de paramètres

- [x] Un payload mêlant `locale` et préférence historique est rejeté par le schéma partagé avant le contrôleur — `shared/schemas.ts:2167`, `backend-nest/src/modules/user/infrastructure/http/dto/user-profile.dto.ts:21`, `backend-nest/src/modules/user/infrastructure/http/user.controller.ts:122`
- [x] `locale` seul et les trois préférences historiques sans `locale` restent valides — `shared/src/locale.spec.ts:61`, `shared/src/locale.spec.ts:77`
- [x] Les clients actuels émettent les deux formes autorisées et les suites shared/backend réussissent — `frontend/projects/webapp/src/app/core/i18n/language.service.ts:59`, `frontend/projects/webapp/src/app/feature/settings/settings-page.ts:572`, `ios/Pulpe/Domain/Store/UserSettingsStore.swift:131`, validation fournie : shared locale 22/22 et backend 23/23

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (15/15) |
| Files checked | Les 18 fichiers modifiés ; appelants et contrats vérifiés dans `PulpeApp.swift`, `RootViewModifiers.swift`, `SessionDataResetting.swift`, `AppState+SessionReset.swift`, `CurrentMonthView.swift`, `LanguageSettingView.swift`, `UserSettingsService.swift`, `APIClient.swift`, `APIError.swift`, `language.service.ts`, `settings-page.ts`, `user-profile.dto.ts`, `user.controller.ts`, `update-user-settings.use-case.ts` et `supabase-user.repository.ts` |
| Unchecked     | none |
| Unplanned     | none |
