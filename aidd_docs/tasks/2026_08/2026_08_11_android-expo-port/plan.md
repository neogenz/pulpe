---
objective: "Pulpe tourne sur Android via une app Expo/React Native dans le monorepo, avec parité features 1:1 avec l'app iOS, publiée sur le Play Store."
status: pending
---

# Plan: Portage Android de Pulpe (Expo / React Native)

## Overview

| Field      | Value                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Nouvelle app `android/` (Expo, RN, TS strict) dans le monorepo, parité 1:1 avec les ~60 écrans iOS, data via backend-nest    |
| **Source** | Brainstorm du 2026-08-11 (stack verrouillée : Expo/RN, pas d'IAP, iOS SwiftUI définitif) + inventaire iOS/web/backend/shared |

Stack verrouillée : Expo SDK · Expo Router · Zustand · TanStack Query · MMKV · Reanimated · Gesture Handler · expo-haptics · Sentry · PostHog · EAS (Build/Update/Workflows) · Maestro. `pulpe-shared` consommé directement (schemas Zod + calculators) — le miroir de formules reste à 2 sens (shared ↔ iOS).

L'app iOS est la référence de parité : chaque écran, flow et comportement est spécifié par `ios/Pulpe/`. La webapp sert de référence secondaire pour les flows auth/vault. Copy produit en français (cf. vocabulaire AGENTS.md).

## Phases

| #   | Phase                                                  | File                           |
| --- | ------------------------------------------------------ | ------------------------------ |
| 1   | Fondations Expo dans le monorepo                       | [`phase-1.md`](./phase-1.md)   |
| 2   | Core transverse (API client, session, design system)   | [`phase-2.md`](./phase-2.md)   |
| 3   | Auth & coffre (login, PIN, biométrie, recovery)        | [`phase-3.md`](./phase-3.md)   |
| 4   | Onboarding (7 étapes) + passation                      | [`phase-4.md`](./phase-4.md)   |
| 5   | Accueil (dashboard du mois)                            | [`phase-5.md`](./phase-5.md)   |
| 6   | Budgets — liste & création                             | [`phase-6.md`](./phase-6.md)   |
| 7   | Budget détail — cœur                                   | [`phase-7.md`](./phase-7.md)   |
| 8   | Budget détail — spread, retrait épargne, undo          | [`phase-8.md`](./phase-8.md)   |
| 9   | Objectifs d'épargne (+ simulateur)                     | [`phase-9.md`](./phase-9.md)   |
| 10  | Modèles de budget                                      | [`phase-10.md`](./phase-10.md) |
| 11  | Compte & réglages                                      | [`phase-11.md`](./phase-11.md) |
| 12  | Système & polish transverse                            | [`phase-12.md`](./phase-12.md) |
| 13  | Release (Maestro, EAS, Play Store)                     | [`phase-13.md`](./phase-13.md) |

## Resources

| Source                                                                  | Verified                                                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.expo.dev/guides/monorepos/                                 | SDK 57 confirmé (template `default@sdk-57`) ; Expo supporte les deps **isolées pnpm depuis SDK 54** (`nodeLinker: hoisted` = fallback seulement) ; autolinking aligné Metro par défaut en monorepo depuis SDK 55 ; Metro auto-configuré (ne PAS configurer watchFolders à la main) |
| https://github.com/margelo/react-native-quick-crypto                    | `pbkdf2()` et `subtle.deriveBits` PBKDF2-SHA256 dispo sous Hermes (JSI) ; plugin config Expo + `expo prebuild` requis               |
| https://supabase.com/docs/guides/auth/quickstarts/react-native          | supabase-js RN + adapter SecureStore ; deep links OAuth/reset via expo-auth-session + `setSession` depuis l'URL                     |
| https://github.com/FormidableLabs/victory-native-xl                     | Charts RN actifs (push 2026-07, non archivé — l'ancien `victory-native` est archivé) ; D3+Skia+Reanimated                          |
| https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md            | `Intl.NumberFormat`/`DateTimeFormat` supportés sous Hermes Android (shared `currency-format.ts` n'utilise que des options basiques) ; variance du séparateur de milliers selon version Android |
| https://github.com/mrousavy/react-native-mmkv                           | MMKV actif (push 2026-07), compatible Expo dev builds                                                                              |
| https://docs.expo.dev/versions/latest/sdk/local-authentication/         | Biométrie (BiometricPrompt via expo-local-authentication)                                                                         |
| https://maestro.mobile.dev/                                             | E2E YAML (onboarding, login, pointage)                                                                                            |
| https://docs.expo.dev/eas/                                              | Build cloud, OTA updates, workflows                                                                                               |

## Decisions

| Decision                                                                                                   | Why                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo/RN plutôt que Kotlin natif                                                                            | Réutilisation directe de `pulpe-shared` (miroir de formules à 2 sens au lieu de 3), solo dev qui review en TS, EAS supprime l'ops de release |
| App dans `android/`, package pnpm du monorepo, workspace isolé conservé                                     | Cohérence Turbo (`build:shared` avant), une seule CI ; Expo gère l'isolé depuis SDK 54 ; escalade documentée : `nodeLinker: hoisted` (avec non-régression des autres apps) puis exclusion du workspace en dernier recours |
| Data via backend-nest uniquement, auth via Supabase SDK direct                                             | Reproduit le contrat iOS (`APIClient` + `AuthGuard` JWT + `X-Client-Key`), zéro changement d'architecture backend                             |
| Dev builds Expo dès la phase 1 (pas d'Expo Go)                                                             | `react-native-quick-crypto` (PBKDF2) et `expo-secure-store` sont des modules natifs                                                            |
| Pas de widgets Android en v1                                                                               | Les widgets iOS (WidgetKit/App Group) exigeraient du natif Glance/Kotlin ; feature isolée, traitée après la release                            |
| Backend : étendre `appVersionResponseSchema` + `whats-new` pour `android`                                  | Le schéma est fermé sur `ios`+`web` ; force-update et nouveautés en dépendent (phase 3, petit périmètre)                                     |
| Miroir de formules : Android consomme `shared/src/calculators/` tel quel                                   | Aucune réécriture, aucun risque de divergence ; la règle AGENTS.md reste shared ↔ iOS                                                         |
