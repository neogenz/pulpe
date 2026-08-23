---
objective: "Sur iOS, le prénom canonique vit dans user_metadata.firstName, survit à une reconnexion Apple/Google, n’est jamais déduit d’un e-mail ni du claim name, et un compte existant sans prénom peut le saisir dans Compte."
status: implemented
---

# Plan: fiabiliser le prénom iOS quel que soit le mode d’inscription

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Un seul prénom Pulpe, persisté, pour e-mail / Apple / Google, sans régression PUL-112. |
| **Source** | [PUL-344](https://linear.app/pulpe/issue/PUL-344/fiabiliser-le-prenom-des-utilisateurs-ios-quel-que-soit-le-mode-dinscription) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Résolution canonique et API de persistance | [`phase-1.md`](./phase-1.md) |
| 2   | Capturer et attendre le prénom pendant l’onboarding | [`phase-2.md`](./phase-2.md) |
| 3   | Afficher et éditer le prénom dans Compte | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [PUL-344](https://linear.app/pulpe/issue/PUL-344/fiabiliser-le-prenom-des-utilisateurs-ios-quel-que-soit-le-mode-dinscription) | 11 CA iOS-only ; hors web, hors Nest, hors rétro-remplissage Private Relay depuis l’e-mail. |
| [PUL-112](https://linear.app/pulpe/issue/PUL-112/rejet-apple-le-prenom-est-demande-apres-sign-in-with-apple) | Ne pas redemander le prénom si Apple l’a déjà fourni ; étape sautée via `socialProvidedName`. |
| [Apple `fullName`](https://developer.apple.com/documentation/authenticationservices/asauthorizationappleidcredential/fullname) | Le nom n’est pas dans l’identity token ; il transite une fois via le credential. Perdre `givenName` est irrécupérable. |
| [WWDC20 10173](https://developer.apple.com/videos/play/wwdc2020/10173/) | Nom et e-mail uniquement à la première autorisation. |
| [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) | `given_name` = prénom ; `name` = nom complet affichable ; aucun des deux n’est garanti. |
| [Supabase Swift `update(user:)`](https://supabase.com/docs/reference/swift/auth-updateuser) | Utilisateur authentifié ; `UserAttributes(data:)` fusionne `user_metadata`. |
| Audit production (ticket) | Deux comptes Apple Private Relay sans `firstName` ; Compte n’affiche que l’e-mail relais. |

## Decisions

| Decision | Why |
| -------- | --- |
| Un resolver unique : `firstName` puis `given_name` ; jamais `name`, jamais l’e-mail | Aujourd’hui `AuthService.userInfo` lit `name` comme prénom. Google documente `name` comme nom complet. Les tests actuels verrouillent ce bug. |
| `updateUserFirstName` attendu, valeur trimée, vide refusée, `UserInfo` renvoyé et réinjecté | Le commentaire dans `SocialLoginButtons` dit que perdre le prénom Apple est acceptable. C’est faux. Fire-and-forget + log warning = succès silencieux. |
| Reprise : garder le prénom en mémoire (`OnboardingState` / champ feuille) et réessayer à la complétion d’onboarding et depuis Compte | CA10 exige un retry sans perdre la saisie. Pas de file persistante hors process : trop lourd pour iOS-only. |
| Compte (sheet Compte), pas Préférences | CA7 vise l’identité visible. Préférences est jour de paie / devise / diagnostics. Les comptes Private Relay déjà créés ne repassent pas par l’onboarding. |
| Ne pas porter le fallback web `fullName.split(' ')[0]` | Le store web le fait encore ; l’analytics web refuse déjà `name`. PUL-344 interdit ce découpage sur iOS. |
