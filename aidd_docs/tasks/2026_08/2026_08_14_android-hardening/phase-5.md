---
status: done
---

# Instruction: Télémétrie & variables de build EAS

`@sentry/react-native` et PostHog sont installés, plugin déclaré, **jamais importés** : zéro crash report, zéro analytics — trompeur pour qui lit `package.json`. Et un build EAS planterait au boot : `env.ts:22-30` jette sans `EXPO_PUBLIC_*`, qu'aucun `eas.json`/workflow ne fournit. Cette phase rend un build EAS viable et observable. (La création du projet EAS lui-même = humain, phase 9.)

## Architecture projection

```txt
android/
├── eas.json                              ✏️ env EXPO_PUBLIC_* par profil (dev/preview/production)
├── app.json                              ✏️ hooks/plugin Sentry complétés si manquants (org/project via env)
└── src/
    ├── core/observability/
    │   ├── sentry.ts                     ✅ init conditionnée (désactivée en dev), beforeSend scrubbe montants/headers
    │   └── analytics.ts                  ✅ PostHog init + capture d'écrans de base, opt-out lu depuis le store
    ├── app/_layout.tsx                   ✏️ wrap Sentry + init analytics au boot
    └── app/(main)/settings/index.tsx     ✏️ toggle « Partager les données d'usage » (opt-out, défaut aligné iOS/web)
```

## User Journey

```mermaid
flowchart TD
  A[Build EAS preview] -->|avant| B[Crash au boot : env.ts jette]
  A -->|après| C[App démarre, DSN/keys injectées par profil]
  C --> D[Crash en prod] --> E[Événement Sentry sans donnée financière]
  C --> F[Réglages → opt-out] --> G[Plus aucune capture PostHog]
```

## Tasks to do

### `1)` Env par profil

1. `eas.json` : bloc `env` par profil pour chaque `EXPO_PUBLIC_*` requis par `env.ts` (URLs backend/Supabase, clés publiques) ; secrets sensibles via `eas env` (documenté, pose humaine en phase 9)
2. Garde-fou : `env.ts` garde son throw (fail-fast voulu) mais le message liste la variable manquante et le profil

### `2)` Sentry

1. `Sentry.init` via `core/observability/sentry.ts`, activé hors `__DEV__` seulement ; `beforeSend` retire headers d'auth et tout montant ; source maps par le plugin Expo
2. Test de fumée documenté : crash volontaire en build preview → événement visible

### `3)` PostHog + opt-out

1. Init + capture minimale (écrans, pas de propriétés financières) ; clé par env
2. Toggle réglages persistant (MMKV) branché sur `optOut()` ; respected dès le boot suivant
3. Aligner le défaut et le wording sur iOS/webapp (vérifier les deux avant d'écrire)

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `eas build --profile preview` (une fois le projet EAS créé, phase 9) démarre sans throw ; en attendant : `npx expo start` avec env de prod simulée boote |
| 2    | Événement Sentry de test reçu, sans header auth ni montant dans le payload (payload joint à la PR)                                                       |
| 3    | Opt-out ON → zéro requête PostHog (vérifié au proxy/logs) ; OFF → captures visibles ; le choix survit au relaunch                                        |
