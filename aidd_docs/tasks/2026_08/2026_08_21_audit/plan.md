---
objective: "L’application Android possède un processus de release fiable, un cycle session atomique, des erreurs opérables, des données bornées, des tests honnêtes et des surfaces accessibles validées sur appareil."
status: implemented
---

# Plan: Assainir durablement la codebase Android

## Overview

| Field      | Value                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger les 16 constats de l’audit Android sans changer la stack Expo 57 ni dupliquer les contrats partagés. |
| **Source** | [`report.md`](./report.md) et les sept rapports spécialisés du 21 août 2026.                                  |

## Phases

| #   | Phase                                                          | File                         |
| --- | -------------------------------------------------------------- | ---------------------------- |
| 1   | Verrouiller la version produit et la release Android           | [`phase-1.md`](./phase-1.md) |
| 2   | Rendre la restauration et la sortie de session atomiques       | [`phase-2.md`](./phase-2.md) |
| 3   | Corréler les erreurs et réaligner le gate système              | [`phase-3.md`](./phase-3.md) |
| 4   | Borner le cache langue et l’historique des budgets             | [`phase-4.md`](./phase-4.md) |
| 5   | Rendre les tests, dépendances et métriques de qualité honnêtes | [`phase-5.md`](./phase-5.md) |
| 6   | Réduire le couplage de la route de détail                      | [`phase-6.md`](./phase-6.md) |
| 7   | Assumer le formulaire modal et terminer l’accessibilité        | [`phase-7.md`](./phase-7.md) |

## Resources

| Source                                                                                                              | Verified                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Changesets configuration](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md)          | Un groupe `fixed` synchronise ses membres et les packages privés doivent être explicitement versionnés.     |
| [Expo CLI dependency validation](https://docs.expo.dev/more/expo-cli/)                                              | `expo install --check` est le contrôle de compatibilité prévu pour React Native/Expo et peut échouer en CI. |
| [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)                                                    | `jest-expo` et React Native Testing Library sont la voie supportée avec React 19.                           |
| [Expo Router testing](https://docs.expo.dev/router/reference/testing/)                                              | Les tests de routes vivent hors de `app/` et peuvent utiliser le routeur en mémoire.                        |
| [TanStack infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)         | `initialPageParam`, `getNextPageParam` et `fetchNextPage` couvrent un historique chargé à la demande.       |
| [Supabase range](https://supabase.com/docs/reference/javascript/using-modifiers-range)                              | Une plage offset est inclusive et doit suivre un ordre déterministe.                                        |
| [Bottom Sheet Reanimated 4 changelog](https://github.com/gorhom/react-native-bottom-sheet/blob/master/CHANGELOG.md) | Le support Reanimated 4 existe dans la branche courante.                                                    |
| [Bottom Sheet RN 0.86 Android issue](https://github.com/gorhom/react-native-bottom-sheet/issues/2721)               | Une course de montage reste ouverte sur la matrice exacte RN 0.86, Fabric, Hermes et Reanimated 4.          |

## Decisions

| Decision                                                                                                        | Why                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Ajouter `pulpe-android` au groupe Changesets fixe tout en gardant `package.json` racine comme autorité          | Le runtime OTA et les deux manifestes Android ne doivent plus pouvoir dériver du produit.                                                  |
| Publier `unauthenticated` uniquement après un purge local sérialisé                                             | Une nouvelle session ne doit jamais être effacée par le nettoyage tardif du compte précédent.                                              |
| Capturer une seule erreur par appel API logique, avec un identifiant de requête et un contexte technique filtré | Le backend et PostHog deviennent corrélables sans message, identifiant métier ni donnée financière.                                        |
| Utiliser une pagination offset additive et une requête annuelle séparée pour le mois courant                    | Le contrat reste compatible avec les clients déployés et le démarrage ne dépend plus de tout l’historique.                                 |
| Conserver le consentement diagnostics actuel mais retirer e-mail et prénom de l’identité Android                | Le risque de minimisation baisse sans introduire une politique différente et silencieuse sur une seule plateforme.                         |
| Formaliser les surfaces existantes comme formulaires modaux, pas comme bottom sheets                            | La primitive native est stable et accessible ; la dépendance gestuelle disponible présente un risque ouvert sur la stack exacte du projet. |
