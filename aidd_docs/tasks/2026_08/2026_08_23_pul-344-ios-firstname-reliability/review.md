# Review: pul-344-ios-firstname-reliability

- **Verdict**: changes-requested
- **Diff**: `origin/preview...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026-08-23
- **Findings**: 0 critical, 2 warning, 2 minor

## Phases

### Phase 1 — Résolution canonique et API de persistance

- [x] Un metadata sans `firstName` ni `given_name` produit nil, même si `name` ou un e-mail est présent — `ios/Pulpe/Core/Auth/FirstNameResolver.swift:25`
- [x] `AuthService.userInfo` et les lectures recovery n’utilisent plus `name` comme prénom — `ios/Pulpe/Core/Auth/AuthService+UserInfo.swift:6`
- [x] Un persist avec `"  Marie  "` écrit `"Marie"` ; `""` / `"   "` n’appelle pas Supabase — `ios/Pulpe/Core/Auth/AuthService.swift:311`
- [x] `AuthServiceUserInfoTests` échoue si quelqu’un réintroduit le fallback `name` — `ios/PulpeTests/Core/Auth/AuthServiceUserInfoTests.swift:45`

### Phase 2 — Capturer et attendre le prénom pendant l’onboarding

- [x] Un échec `updateUserFirstName` n’est plus avalé par un `Task` détaché ; le prénom Apple reçu reste en mémoire — `ios/Pulpe/Features/Auth/Components/SocialLoginButtons.swift:177`
- [x] Après inscription e-mail, `user_metadata.firstName` contient le prénom saisi avant la fin d’onboarding — `ios/Pulpe/Features/Onboarding/Steps/RegistrationStep.swift:138`
- [x] Apple/Google sans givenName : on ne quitte pas l’étape Prénom avec un champ vide ; la valeur saisie est persistée comme l’e-mail — `ios/Pulpe/Features/Onboarding/OnboardingState.swift:123`
- [x] Apple avec givenName : l’étape Prénom n’apparaît pas. Google `name` n’alimente pas `UserInfo.firstName` — `ios/Pulpe/Features/Onboarding/OnboardingState.swift:164`
- [x] Reconnexion Apple/Google sans nom : un `firstName` déjà persisté reste (CA9) — `ios/Pulpe/Features/Auth/Components/SocialLoginButtons.swift:105`

### Phase 3 — Afficher et éditer le prénom dans Compte

- [x] Un compte sans `firstName` montre « Ajouter un prénom » et l’e-mail, pas un prénom inventé — `ios/Pulpe/Features/Account/AccountView.swift:83`
- [x] Enregistrer écrit `user_metadata.firstName` et `currentUser.firstName` ; après dismiss, PIN et avatar voient la valeur sans relogin — `ios/Pulpe/Features/Account/EditFirstNameSheet.swift:59`
- [x] Un update réseau en échec laisse le champ rempli et permet un second Enregistrer — `ios/Pulpe/Features/Account/EditFirstNameViewModel.swift:46`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | fit | 2 | `ios/Pulpe/Features/Auth/Components/SocialLoginButtons.swift:94` | Persist failure is assigned to `errorMessage` after `onAuthenticated`, and Welcome already calls `nextStep()`, so the social banner never appears. Apple-with-name then has no error until the last-chance persist on the budget CTA. | Set and surface the persist error before navigating, or pass it into `OnboardingState.error` inside `onAuthenticated` so the next step shows it. |
| 🟡 | code | 2 | `ios/Pulpe/Features/Auth/Components/SocialLoginButtons.swift:189` | On persist success, `user` is replaced by the API `UserInfo`. If the returned metadata omits `firstName`, the in-memory Apple/Google given name is dropped and PUL-112 skip can fail. `persistFirstName` already coalesces with `?? name`. | Keep `user.firstName = FirstNameResolver.normalized(updated.firstName) ?? name` after a successful update, same as `OnboardingState.persistFirstName`. |
| 🟢 | code | 1 | `ios/Pulpe/Core/Auth/AuthErrorLocalizer.swift:94` | `.emptyFirstName` is classified as `nil` then special-cased again in `catalogKey`. Two paths for one error. | Return a dedicated kind from `classifyTypedError`, or map `.emptyFirstName` only in `catalogKey` and drop the classify case. |
| 🟢 | rot | 2 | `ios/Pulpe/Features/Onboarding/OnboardingFlow.swift:337` | Last-chance `persistFirstName` always PATCHes, even when signup/social already wrote `firstName`. Harmless overwrite, extra network. | Skip the call when `FirstNameResolver.normalized(user.firstName)` is already set and matches the in-memory name, unless a prior persist in this session failed. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (12/12)                                      |
| Files checked | `FirstNameResolver.swift`, `AuthService.swift`, `AuthService+UserInfo.swift`, `AuthTypes.swift`, `AuthErrorLocalizer.swift`, `SocialLoginButtons.swift`, `AppleSignInCoordinator.swift`, `GoogleSignInCoordinator.swift`, `OnboardingState.swift`, `OnboardingFlow.swift`, `FirstNameStep.swift`, `RegistrationStep.swift`, `WelcomeStep.swift`, `AccountView.swift`, `EditFirstNameSheet.swift`, `EditFirstNameViewModel.swift`, `FormTextField.swift`, `PulpeApp.swift`, `FirstNameResolverTests.swift`, `AuthServiceUserInfoTests.swift`, `AuthErrorLocalizerTests.swift`, `OnboardingSocialSignupTests.swift`, `EditFirstNameViewModelTests.swift`, `ProfileAvatarTests.swift` |
| Unchecked     | none |
| Unplanned     | none |
