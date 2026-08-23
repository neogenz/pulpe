---
objective: "Après un signup Apple/Google, un échec de persist firstName est visible sur l’étape suivante, et un succès d’update ne peut plus effacer le givenName déjà en mémoire."
status: implemented
---

# Plan: surfacer l’échec de persist prénom et ne plus perdre le givenName Apple

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger les 2 warnings PUL-344 : bannière d’erreur social jamais vue, prénom in-memory droppé si l’API omet `firstName`. |
| **Source** | [review.md](../2026_08_23_pul-344-ios-firstname-reliability/review.md) (verdict `changes-requested`) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Persister sans perdre le prénom, montrer l’échec | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [Supabase Auth `updateUser` / `data`](https://supabase.com/docs/reference/swift/auth-updateuser) | `UserAttributes(data:)` fusionne `user_metadata` ; pas de SQL sur `auth.users`. |
| [Supabase Apple — persist `fullName` via `updateUser`](https://supabase.com/docs/guides/auth/social-login/auth-apple) | Le nom Apple n’arrive qu’à la 1re autorisation ; l’écrire tout de suite dans `user_metadata`. |
| [Apple — name only on first authorization](https://developer.apple.com/documentation/sign_in_with_apple/authenticating-users-with-sign-in-with-apple) | `fullName` hors identity token ; le stocker immédiatement. |
| [PUL-112](https://linear.app/pulpe/issue/PUL-112/rejet-apple-le-prenom-est-demande-apres-sign-in-with-apple) | Ne pas redemander le prénom si `givenName` est déjà là. |

## Decisions

| Decision | Why |
| -------- | --- |
| Rester sur `user_metadata.firstName` via `auth.update` | Scope Auth documenté. Pas de table `profiles`, pas d’`ALTER auth.users`. |
| Avancer l’onboarding même si le persist échoue, et poser l’erreur sur `OnboardingState.error` | La session existe déjà ; rester sur Welcome ferait retaper Apple → chemin `existingUser`. `OnboardingStepView` affiche déjà `state.error`. |
| Fusionner `UserInfo` API avec le `givenName` mémoire (`normalized(api) ?? name`) | Un metadata de retour incomplet ne doit pas casser le skip PUL-112. |
