# Audit Android — Tests

- Date : 2026-08-21
- Périmètre : Jest, couverture, Maestro et intégration CI Android
- Santé : **bonne exécution, signal de couverture trop optimiste**

## Findings

| Sev | Category    | Location                                                | Issue                                                                                                                                                                                                                                                                     | Suggested fix                                                                                                                                                                              | Effort |
| --- | ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 🟡  | Coverage    | `android/jest.config.js:2`                              | Jest n'a ni `collectCoverageFrom` ni seuil. Le 81,49 % de lignes ne porte que sur 78 modules importés, sur 229 fichiers de production; routes et composants jamais importés disparaissent du dénominateur.                                                                | Collecter `src/**/*.{ts,tsx}` avec exclusions explicites, publier le vrai baseline puis poser des seuils progressifs sur auth/vault/calculs.                                               | M      |
| 🟡  | Test design | `android/src/core/system/detail-query-states.spec.ts:5` | 40 des 103 fichiers de spec lisent le source brut et cherchent des chaînes/ordres. Ces guards détectent certains refactors, mais peuvent passer sans exécuter l'UI et casser sur un changement équivalent; les transitions session/vault restent notamment non intégrées. | Garder les rares contrats statiques utiles et convertir d'abord les parcours à risque en tests comportementaux ou Maestro : restore session, sign-out/purge, gate, mutations destructives. | M      |

## Top actions

1. Rendre le dénominateur de couverture honnête avant d'augmenter un seuil.
2. Tester le cycle de vie session/vault avec listeners réels et stockage retardé.
3. Remplacer seulement les source-string tests des chemins critiques; ne pas réécrire tout le catalogue.

## Coverage

- Exécuté : 103 suites Jest, 649 tests, 0 snapshot — tous passent; couverture affichée 80,49 % statements, 80,40 % branches, 70,62 % functions, 81,49 % lines.
- Vérifié statiquement : cinq flows Maestro; le smoke CI compose login/vault, i18n et pointage à font scale 1,3; aucun test `.skip`/`.todo` trouvé.
- Limites : Maestro/emulateur et onboarding réel non exécutés pendant cet audit; Watchman a dû être désactivé dans l'environnement sandbox.
