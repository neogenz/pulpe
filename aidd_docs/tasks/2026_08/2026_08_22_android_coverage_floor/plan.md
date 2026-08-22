---
objective: "Le plancher de couverture Android progresse de façon monotone grâce à des tests comportementaux des parcours à risque, sans test décoratif ni baisse silencieuse de seuil."
status: implemented
---

# Plan: Faire progresser le plancher de couverture Android

## Overview

| Field      | Value                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Partir du total brut 36,33/32,90/30,13/35,99, puis relever le gate `global` sur sa population effective après chaque tranche comportementale prioritaire. |
| **Source** | Texte utilisateur du 22 août 2026 : « écrire un plan pour faire progresser le plancher ».                                    |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Verrouiller immédiatement le baseline réel                   | [`phase-1.md`](./phase-1.md) |
| 2   | Couvrir l’entrée applicative et les gates système            | [`phase-2.md`](./phase-2.md) |
| 3   | Couvrir les écrans du coffre et la saisie du PIN             | [`phase-3.md`](./phase-3.md) |
| 4   | Couvrir les deux formulaires d’écriture financière           | [`phase-4.md`](./phase-4.md) |
| 5   | Couvrir le mois courant et la création d’un budget           | [`phase-5.md`](./phase-5.md) |
| 6   | Couvrir la liste et le détail d’un budget                    | [`phase-6.md`](./phase-6.md) |
| 7   | Couvrir les mutations sensibles des objectifs et modèles     | [`phase-7.md`](./phase-7.md) |
| 8   | Couvrir la sécurité du compte et poser le plancher de sortie | [`phase-8.md`](./phase-8.md) |

## Resources

| Source                                                                 | Verified                                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Jest coverage configuration](https://jestjs.io/docs/configuration)    | `collectCoverageFrom` compte les fichiers non importés et `coverageThreshold` impose des seuils globaux, par chemin ou glob.                       |
| [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)       | `jest-expo` et React Native Testing Library sont la voie supportée pour tester les composants Expo avec React 19.                                  |
| [Expo Router testing](https://docs.expo.dev/router/reference/testing/) | Les tests de routes doivent vivre hors de `app`; le routeur en mémoire est disponible, mais les mocks directs restent valides pour un écran isolé. |

## Decisions

| Decision                                                                                                    | Why                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Relever chaque métrique au plancher entier de la population effective de `global`, sans jamais la diminuer | Jest soustrait de `global` les fichiers ayant leur propre seuil ; le total brut reste une mesure de reporting et ne doit pas être copié dans le gate. |
| Prioriser disponibilité, coffre et écritures financières avant les écrans faciles à rendre                  | Une ligne couverte sur un flux qui peut bloquer l’app ou écrire de l’argent vaut davantage qu’une ligne couverte uniquement pour le compteur. |
| Réutiliser Jest, `jest-expo` et RNTL déjà installés                                                         | La CI exécute déjà `pnpm test:unit`; aucun reporter, script de ratchet ni dépendance supplémentaire n’est nécessaire.                         |
| Conserver les seuils ciblés session, vault et API                                                           | Ils empêchent le global de masquer une régression locale dans les trois frontières déjà fortement couvertes.                                  |
