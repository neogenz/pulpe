---
objective: "Le flow d'onboarding Android n'a plus de copie d'état morte ni de doublon de vérité d'auth, il rapporte son entonnoir à PostHog sous le contrat cross-plateforme existant, et le sélecteur de mois du détail budget cesse de porter l'affordance d'un filtre."
status: pending
---

# Plan: Onboarding Android — code mort, entonnoir PostHog, sélecteur de mois

## Overview

| Field      | Value                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Les quatre suites de la revue `/impeccable` du 2026-08-14, plus la capture du sélecteur de mois fournie le 2026-08-15                       |
| **Source** | Bloc `### Follow-up suggestions` de la revue onboarding + capture émulateur du détail budget (`Août / Septembre / Octobre / Novembre`)      |

## Phases

| #   | Phase                                                             | Portée                                                                              |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Retirer le code mort du flow                                      | `onboarding-selectors.ts`, `onboarding-step.ts`, `onboarding-store.ts`              |
| 2   | `isAuthenticated` projeté depuis la session, plus recopié         | `session-store.ts`, `onboarding-store.ts`, `draft-storage.ts`                       |
| 3   | Entonnoir onboarding vers PostHog, sous contexte plateforme       | `core/observability/analytics.ts`, `features/onboarding/onboarding-analytics.ts`    |
| 4   | Sélecteur de mois : onglets de navigation, plus puces de filtre   | `features/budget-details/components/month-pager.tsx`, `app/(main)/budget/[id].tsx`  |

Ordre : 1 avant 2 parce que la suppression réduit la surface que 2 doit reprendre ; 2 avant 3 parce que `auth_method` et `was_authenticated` sont des propriétés d'événement lues sur cet état ; 4 est indépendant et passe en dernier, seul à demander une vérification visuelle sur appareil.

## Resources

| Source                                                                       | Ce qu'elle verrouille                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `shared/src/feature-flags.ts:34-107`                                         | Les noms d'événements et leurs propriétés — contrat cross-plateforme, aucun nom local n'a le droit d'exister à côté          |
| `ios/Pulpe/Core/Analytics/AnalyticsService.swift:75-82,366-400`              | `appContextProperties` (`platform`, `environment`, `app_version`, `build_number`) et la liste de mots financiers filtrés     |
| `ios/Pulpe/Features/Onboarding/OnboardingState.swift:286-309`                | Le contrat exact de `onboarding_step_completed` : `step`, `step_index` 1-based, `step_total`, `auth_method`                  |
| `ios/Pulpe/Features/Onboarding/OnboardingFlow.swift:256-297`                 | Les espaces de valeurs de `exit_method` et l'idempotence de `onboarding_started` / `onboarding_abandoned`                    |
| `ios/Pulpe/App/Auth/OnboardingBootstrapper.swift:111-122`                    | `first_budget_created` : `signup_method`, `has_pay_day`, `charges_count`, `custom_transactions_count`                        |
| `.claude/rules/05-workflows-and-processes/posthog-events.md`                 | Alias retirés à ne jamais réémettre, interdiction des montants et libellés libres, `snake_case` statique                     |
| `android/src/app/_layout.tsx:81-90`                                          | Le layout rend `null` tant que la session charge — aucun écran d'onboarding ne peut lire l'auth avant qu'elle soit tranchée |
| `android/src/features/budget-details/components/details-filter-bar.tsx`      | Les puces que le sélecteur de mois imite aujourd'hui alors qu'elles filtrent, sur le même écran                              |

## Decisions

| Décision                                                                                              | Pourquoi                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isAuthenticated` reste un champ de `OnboardingState`, mais avec un seul écrivain : la session        | Supprimer le champ rendrait les sélecteurs impurs et non testables sans store. Un écrivain unique supprime quand même la classe de bug : plus aucune fonction du flow n'écrit sa propre vérité d'auth |
| `wasEmailRegistered` disparaît avec la recopie                                                        | Son unique lecteur était la ligne qui devinait `isAuthenticated` au restore. Sans elle, c'est un champ écrit et jamais lu — le même défaut que la phase 1 retire ailleurs                             |
| Aucun nom d'événement local : `ANALYTICS_EVENTS` est importé de `pulpe-shared`                        | Le catalogue parallèle est précisément ce que la revue a signalé. `analyticsName` des étapes reste local, car c'est une *valeur de propriété*, pas un nom d'événement                                |
| Le filtre de propriétés d'iOS est porté tel quel, mots pour mots                                      | Deux listes qui divergent laisseraient un montant passer d'un seul côté. Un test source interdit `capture(` hors du module qui filtre                                                                 |
| Pas d'`identify` sur Android dans ce lot                                                              | L'entonnoir tient sur un `distinct_id` anonyme unique par appareil, et l'app n'interroge aucun feature flag. Ajouter l'identité, c'est ajouter les propriétés personne — un autre lot                  |
| Le sélecteur de mois devient une barre d'onglets, pas une rangée de puces                             | Sur le même écran, une puce pleine verte veut dire « filtre actif » deux blocs plus bas. Naviguer entre mois frères est ce qu'Android met dans des onglets défilants (Revolut, Airbnb, Linear font ça) |
| Le titre d'app bar passe à l'année quand la barre d'onglets est là                                    | Sinon « Août » est écrit deux fois à trois centimètres d'écart. Année + mois reproduit la hiérarchie que la liste des budgets utilise déjà (en-tête d'année, cartes de mois)                          |
| Pas de balayage entre mois dans ce lot                                                                | Cela demande de paginer l'écran entier, pas de changer un composant. Les onglets règlent l'affordance ; le geste est une suite                                                                        |

## Acceptance

- `progressPercentage`, `isOptionalStep`, `resumeEmailUserAfterRegistration`, `isMovingForward`, `wasEmailRegistered` n'existent plus ; `pnpm run quality` et `npx jest` passent.
- Aucune fonction du flow n'écrit `isAuthenticated` ; un test prouve qu'une session qui tombe repasse l'étape `registration` en navigable.
- Les sept événements de l'entonnoir partent avec les propriétés du contrat iOS, chacun couvert par un test d'émission et de non-doublon ; un test source prouve qu'aucun montant ne peut être attaché.
- Chaque événement porte `platform: "android"`, `environment`, `app_version`, `build_number`.
- Le détail budget montre une barre d'onglets défilante, vérifiée sur émulateur en clair et en sombre.
