# Audit Android — Architecture

- Date : 2026-08-21
- Périmètre : frontières `app/core/features/shared`, ADR, release et dépendances de modules
- Santé : **fair**, à cause d'un défaut isolé de versionnement de release

## Findings

| Sev | Category             | Location                                                 | Issue                                                                                                                                                                                                                                                                                                                       | Suggested fix                                                                                                                                                    | Effort |
| --- | -------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🔴  | Release architecture | `android/app.json:5`                                     | Android est en `0.45.1` dans `app.json` et `android/package.json`, contre `0.46.0` à la racine. `.changeset/config.json:5` exclut `pulpe-android` et aucun CI ne vérifie l'égalité, malgré `RELEASE.md:69`. Cela fausse la version du gate, les trains OTA `appVersion` et peut produire un binaire immédiatement obsolète. | Définir une seule source de version, synchroniser les deux manifestes dans le workflow de release et ajouter un test CI d'égalité avec la version racine.        | S      |
| 🟡  | Decision drift       | `android/src/core/system/system-store.ts:103`            | Une erreur réseau transitoire transforme `ok` en `offline`, puis `SystemGateScreen` bloque toute l'app. Cela contredit l'ADR accepté `docs/adr/0017-server-driven-minimum-version-gate.md:20`, qui impose un échec initial fail-open.                                                                                       | Sur erreur transitoire sans verdict confirmé, conserver `ok`; ne préserver que les gates déjà confirmés. Verrouiller la sémantique avec le test de l'ADR.        | S      |
| 🟢  | Couplage             | `android/src/features/onboarding/onboarding-store.ts:15` | Madge détecte trois cycles `store ↔ selectors ↔ analytics`. Les retours vers le store sont aujourd'hui `import type`, donc effacés à l'exécution, mais le modèle de dépendances est déjà circulaire et fragile à une conversion en import runtime.                                                                          | Déplacer `OnboardingState` dans un module de types neutre ou réduire les entrées des selectors/analytics; ajouter le scan circulaire au contrôle d'architecture. | S      |

## Top actions

1. Bloquer toute release dont les trois versions Android/racine divergent.
2. Réaligner le gate réseau sur l'ADR-0017.
3. Casser le cycle de types de l'onboarding avant qu'il ne devienne runtime.

## Coverage

- Scannés : ADR-0017/0018, documentation Android, release EAS, Turbo/pnpm, imports `core/features/app` et graphe Madge.
- Vérifiés : `core` ne dépend pas des features en production; les contrats et calculateurs viennent bien de `pulpe-shared`; trois cycles Madge, tous limités à l'onboarding.
- Limite : aucun build AAB/Play ni OTA EAS réel; l'export Expo de production a toutefois réussi.
