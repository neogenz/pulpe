# Codebase Audit: Android application

La base Android est **sérieuse et déjà bien structurée** : contrats partagés, chiffrement/vault, validation Zod, cache conditionné au déverrouillage, quatre langues, design tokens, E2E Maestro et 649 tests verts. Sa santé reste **fair** à cause d'un défaut isolé mais concret de release : Android est resté en `0.45.1` pendant que le produit est en `0.46.0`, sans invariant automatique.

- Date : 2026-08-21
- Scope : application Android complète, sept piliers AIDD
- Health : **fair**
- Findings : **1 critical, 12 warnings, 3 minor**

## Findings

| Sev | Category             | Location                                                     | Issue                                                                                                                        | Suggested fix                                                                               | Effort |
| --- | -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| 🔴  | Architecture/release | `android/app.json:5`                                         | Android et son runtime OTA sont en `0.45.1`, la racine en `0.46.0`; Changesets et CI ne garantissent aucune synchronisation. | Source de version unique + sync release + invariant CI des trois manifestes.                | S      |
| 🟡  | Error handling       | `android/src/core/auth/session-store.ts:140`                 | Un rejet de restauration SecureStore laisse la session en `loading` et le splash permanent.                                  | Catch, état récupérable, retry et test de rejet storage.                                    | S      |
| 🟡  | Observabilité        | `android/src/core/api/api-client.ts:233`                     | `X-Request-Id` est généré puis perdu; les erreurs gérées ne sont ni capturées ni corrélables au backend.                     | Porter `requestId` sur `ApiError` et capturer un contexte technique filtré.                 | M      |
| 🟡  | Maintenabilité       | `android/src/app/(main)/budget/[id]/line/[lineId].tsx:69`    | Route de 595 lignes concentrant queries, mutations, dix états et overlays.                                                   | Extraire seulement la coordination actions/overlays et tester les transitions destructives. | M      |
| 🟡  | Architecture         | `android/src/core/system/system-store.ts:103`                | Une panne réseau initiale bloque toute l'app, contrairement au fail-open de l'ADR-0017.                                      | Conserver `ok` sans verdict; préserver seulement un gate déjà confirmé.                     | S      |
| 🟢  | Architecture         | `android/src/features/onboarding/onboarding-store.ts:15`     | Trois cycles Madge `store/selectors/analytics`, actuellement type-only sur les retours.                                      | Déplacer l'état partagé dans un module de types neutre.                                     | S      |
| 🟡  | Security             | `android/src/core/auth/session-store.ts:144`                 | `SIGNED_OUT` publie anonyme avant un purge en arrière-plan, doublé par le purge du `signOut()` normal.                       | Sérialiser un teardown unique et publier après nettoyage.                                   | M      |
| 🟡  | Privacy              | `android/src/core/observability/diagnostics-consent.ts:21`   | Analytics identifié opt-in par défaut; e-mail/prénom partent avant choix explicite dans les préférences.                     | Opt-in explicite ou identité pseudonyme minimale et politique documentée.                   | S      |
| 🟡  | Dependencies         | `android/package.json:29`                                    | 18 advisories de toolchain : 11 high, 6 moderate, 1 low; aucune observée dans le bundle runtime.                             | Upgrade coordonné Expo/Jest/ESLint, sans overrides incompatibles.                           | M      |
| 🟡  | Performance          | `android/src/core/user-settings/user-settings-queries.ts:13` | Changer de langue invalide et refetch toutes les queries actives.                                                            | Invalidation ciblée, voire aucune pour la copie locale.                                     | S      |
| 🟡  | Performance          | `android/src/features/budgets/budget-api.ts:23`              | Historique des budgets non borné, chargé et rendu en bloc.                                                                   | Resolver courant séparé + historique paginé/cursored.                                       | M      |
| 🟢  | Performance          | `android/src/core/system/system-store.ts:65`                 | Le timeout logique de 3 s n'annule pas le GET/retries de fond.                                                               | AbortSignal/timeout court ou single-flight.                                                 | S      |
| 🟡  | Tests                | `android/jest.config.js:2`                                   | Les 81,49 % de lignes couvrent 78 modules importés seulement, sans `collectCoverageFrom` ni seuil.                           | Dénominateur complet, baseline honnête, seuils progressifs.                                 | M      |
| 🟡  | Tests                | `android/src/core/system/detail-query-states.spec.ts:5`      | 40/103 specs inspectent le texte source au lieu d'exécuter le comportement.                                                  | Convertir d'abord les parcours session/vault/gate/destruction.                              | M      |
| 🟡  | UI/UX                | `android/src/core/ui/sheet.tsx:67`                           | Dix-sept « sheets » sont des modales centrées sans poignée ni swipe.                                                         | Valider sur appareil puis corriger l'implémentation partagée, ou assumer un dialog.         | M      |
| 🟢  | i18n/a11y            | `android/src/core/tips/tooltip.tsx:61`                       | Label TalkBack de fermeture français en dur en EN/DE/IT.                                                                     | Passer par le catalogue i18n.                                                               | S      |

## Top actions

1. **Sécuriser la release** : version unique, synchronisation `package.json/app.json`, invariant CI avant tout AAB/OTA.
2. **Rendre le cycle session atomique** : erreur de restore récupérable et purge sign-out sérialisé avant navigation.
3. **Respecter l'ADR du gate** : une panne initiale ne doit pas devenir un écran bloquant.
4. **Rendre le signal qualité honnête** : couverture sur tous les fichiers et tests comportementaux des frontières session/vault/gate.
5. **Rendre les incidents opérables** : conserver `request_id`, capter les erreurs gérées sans données financières, puis traiter cache global et historique non borné.

## Coverage

- Scannés : sept piliers, 332 fichiers TS/TSX, configuration Expo/EAS/Turbo/CI, ADR et documentation Android.
- Exécutés avec succès : build `pulpe-shared`, quality Android, 103 suites/649 tests Jest, couverture et export Expo production (3 616 modules, Hermes 9,5 Mo, export 12 Mo).
- Dépendances : 18 advisories Android de toolchain; `outdated` et compatibilité Expo consultés; aucun package direct deprecated.
- Sécurité/i18n : aucun secret privé, HTTP production, couleur applicative ou copie visuelle non cataloguée détectés; une exception TalkBack reste en français.
- Skipped : appareil/emulateur, Maestro, TalkBack, profiler, pentest, AAB/Play/OTA réel et inventaire licences (commande pnpm bloquée par un index local manquant).

Les détails et nuances par pilier sont dans `code-quality.md`, `architecture.md`, `security.md`, `dependencies.md`, `performance.md`, `tests.md` et `ui.md` dans ce dossier.
