# 0018 — Build Android with Expo and React Native

**Status:** Proposed
**Date:** 2026-08-12
**Deciders:** Pulpe team

## Context

Pulpe needs an Android client with functional parity to the native SwiftUI app. The project is
maintained by one developer, and business contracts and calculators already live in a strict
TypeScript workspace consumed by the web and backend.

## Proposed decision

Add an `android/` pnpm workspace built with Expo and React Native in strict TypeScript.

- Consume `pulpe-shared` schemas and calculators directly instead of creating a third formula
  implementation.
- Use the Supabase SDK directly for authentication, but route product data through the NestJS
  API with the existing JWT and `X-Client-Key` contract.
- Use Expo development builds from the start because PIN derivation and secure storage require
  native modules.
- Keep iOS native and use it as the primary parity reference; Android widgets are outside v1.

## Consequences

- Shared contracts and formulas reduce parity work and avoid a Kotlin business-logic mirror.
- Expo/EAS reduces Android build and release operations for a solo project.
- React Native introduces a second UI implementation and native-module compatibility risk;
  device-level crypto, biometrics, deep links, and release gates require real-device tests.

## Alternatives considered

Kotlin/Compose is not selected because it would duplicate contracts and formulas. Kotlin
Multiplatform and a cross-platform rewrite of iOS are not selected because they add migration
cost without improving the existing SwiftUI product.

## References

- `aidd_docs/tasks/2026_08/2026_08_11_android-expo-port/plan.md`
- ADR-0016, ADR-0017
