---
objective: "Un événement produit porte le même nom sur iOS et sur le web, ce nom vient d'une source unique, et il est lisible dans PostHog sans consulter le code."
status: pending
---

# Plan: Taxonomie analytics cross-plateforme

## Overview

| Field      | Value                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| **Goal**   | Une taxonomie unique, appliquée à la compilation côté web, documentée dans PostHog, et étendue à l'usage récurrent |
| **Source** | Analyse de couverture du 2026-08-05 — 30 jours d'événements PostHog confrontés au code des deux plateformes |

## Phases

| #   | Phase                              | File                         |
| --- | ---------------------------------- | ---------------------------- |
| 1   | Source unique et noms unifiés      | [`phase-1.md`](./phase-1.md) |
| 2   | Documentation PostHog              | [`phase-2.md`](./phase-2.md) |

Ce plan traite les noms des événements existants. Ce qu'il faudrait mesurer et qu'on ne mesure pas relève d'un plan distinct : [`2026_08_05_habit-measurement`](../2026_08_05_habit-measurement/plan.md). Les deux sont indépendants — les nouveaux événements y sont nommés depuis `ANALYTICS_EVENTS` quel que soit l'ordre de livraison.

## Resources

| Source                                                              | Verified                                                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog projet 87621, 30 jours, événements hors `$`                   | 40 noms d'événements, 46 couples nom × plateforme. 4 concepts portent deux noms selon la plateforme. Les volumes déséquilibrés (`budget_created` 4 iOS / 0 web) relèvent de l'instrumentation manquante, pas du nommage — voir le plan de mesure. |
| MCP PostHog `event-definition-update`                                 | `description`, `tags`, `verified`, `hidden` sont modifiables par événement. Aucun événement Pulpe n'en porte aujourd'hui.                                     |
| `shared/src/feature-flags.ts:34` et `shared/index.ts:214`             | `ANALYTICS_EVENTS` existe, se déclare « cross-platform source of truth », ne contient que 2 événements, et est déjà réexporté par la barrel partagée.        |
| `frontend/.../core/analytics/posthog.ts:249`                          | `captureEvent(event: string)` — non typé. Rien n'empêche un littéral divergent.                                                                              |
| Libellés produit des deux plateformes + `docs/ENCRYPTION.md`          | Le terme montré à l'utilisateur est « code PIN », des deux côtés — `PinEntryView.swift:7`, `SecuritySettingsView.swift:20`, `settings-page.ts:307`, `enter-vault-code.spec.ts:422`. `ENCRYPTION.md` : 40 « PIN » contre 7 « vault ». Le nom hors vocabulaire est le `vault_code_*` **du web**. |
| Insights PostHog sauvegardés, 4 produit                               | `JSF0dx5J` est **déjà** cross-plateforme, uniquement parce que `signup_completed` / `first_budget_created` / `transaction_created` portent le même nom partout. `llNtbtMN` et `hy17GAOj` sont deux funnels séparés uniquement parce que l'écran d'accueil en porte deux. `t8swMkM8` utilise déjà `onboarding_step_completed { step }`. Aucun insight ne référence `pin_*` ni `vault_code_*`. |

## Decisions

| Decision                                                                                      | Why                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le nom d'événement vit dans `shared/`, et le web est typé sur cette constante                   | Le typage transforme la divergence en erreur de compilation. C'est la seule application gratuite ; la documentation seule a déjà échoué, puisque le catalogue décrivait la règle 6 pendant que 4 noms divergeaient. |
| Une Action PostHog n'est créée que pour l'écran d'accueil                                        | PostHog ne réécrit pas l'historique, mais seuls `llNtbtMN` et `hy17GAOj` référencent un nom perdant. Les renommages `pin_*` et `profile_step*` ne sont mesurés nulle part : les couvrir d'une Action serait de la cérémonie. |
| Aucune génération de code Swift depuis le TypeScript                                            | Un pipeline de codegen pour ~40 chaînes coûte plus que la dérive qu'il évite. iOS reste synchronisé à la main, avec un test qui verrouille les raw values.                                                   |
| La couverture de l'usage récurrent sort de ce plan                                              | Son périmètre dépend de questions produit, pas de la taxonomie. Mêlées ici, elles auraient rendu ce plan non chiffrable alors que ses deux phases, elles, le sont entièrement.                              |
