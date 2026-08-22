---
objective: "L'app Android passe de « portage juste mais inerte » à livrable : chiffres exacts partout, flux réparés, feel Android (ripple, Material, 48dp), télémétrie branchée, feed nouveautés vivant, et un chemin de release documenté."
status: blocked
blocked_by: "Huit phases sur neuf sont livrées et poussées (PR draft #608). La phase 8 reste ouverte sur trois items qu'un agent ne peut pas trancher seul : le portage gorhom et le pager animé demandent l'appareil, le back prédictif attend un correctif en amont (expo/expo#39092). Aucune vérification visuelle n'a eu lieu — la machine est restée saturée."
---

# Plan: Durcissement Android post-audit (fonctionnel + UX/UI)

## Overview

| Field      | Value                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger tout ce que l'audit du 2026-08-14 a confirmé : 1 bug d'état vécu en live, 5 fonctions de formule sans garde rollover, 5 bugs de flux, télémétrie absente, feed whats-new mort, et la couche sensorielle Android manquante (ripple, tab bar M3, 48dp, contrastes AA) |
| **Source** | Audit 6 axes du 2026-08-14 (branche `claude/android-expo-port-5387b2`) + `DESIGN_AUDIT_20260814.md` (audit statique 2 agents + live émulateur, 11 captures)                                                                                                                  |

Les findings design détaillés (mesures de contraste, inventaires, valeurs) vivent dans `DESIGN_AUDIT_20260814.md` — les phases 3, 7, 8 et 9 y renvoient au lieu de les recopier. Ce plan est la liste de travail ; l'audit est la preuve.

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Réessayer réparé & vérité des erreurs                        | [`phase-1.md`](./phase-1.md) |
| 2   | Formules partagées : gardes rollover & rapatriement          | [`phase-2.md`](./phase-2.md) |
| 3   | Sensoriel Android (ripple, tab bar M3, 48dp, contrastes)     | [`phase-3.md`](./phase-3.md) |
| 4   | Bugs de flux (undo, report, pointage, retrait, clé client)   | [`phase-4.md`](./phase-4.md) |
| 5   | Télémétrie & variables de build EAS                          | [`phase-5.md`](./phase-5.md) |
| 6   | Nouveautés Android (feed + parité release)                   | [`phase-6.md`](./phase-6.md) |
| 7   | Design system consolidé (tokens, Amount, Card, chips, heros) | [`phase-7.md`](./phase-7.md) |
| 8   | Motion & surfaces natives (bottom sheet, back prédictif)     | [`phase-8.md`](./phase-8.md) |
| 9   | Polish, hygiène docs & préparation release                   | [`phase-9.md`](./phase-9.md) |

Ordre : la valeur d'abord (1 = bug vécu par tout utilisateur dont le réseau tousse au boot ; 2 = exactitude des chiffres, cœur du produit), puis le feel critique (3), les flux (4), les bloquants de release (5-6), le raffinement (7-8), le polish et la PR (9). Les phases 3, 7, 8, 9 touchent le design : **approbation explicite par phase avant implémentation** (protocole design-audit).

## Resources

| Source                                                                      | Verified                                                                                                                                                    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN_AUDIT_20260814.md`                                                  | Audit complet : findings C1-C8 / R1-R11 / Polish, tokens à créer, mesures de contraste recalculées                                                          |
| `ios/Pulpe/Domain/Formulas/BudgetFormulas.swift:190-240` + `+Metrics.swift` | Gardes `isRollover` présentes côté Swift — la référence sur laquelle aligner le TS (lu ligne à ligne)                                                       |
| `shared/src/calculators/budget-formulas.ts`                                 | Les 5 fonctions sans garde identifiées (`#calculateEnvelopeTotal:89-105`, `calculateRealizedIncome:171-173`, `calculateRealizedExpenses:201-213`, + totaux) |
| `frontend/.../auth-interceptor` (webapp)                                    | Modèle du traitement 403 `ERR_AUTH_CLIENT_KEY` → relock, à refléter                                                                                         |
| `ios/Pulpe/.../PostponeMenuButton.swift:9-42`                               | Modèle des gardes de report (cacher/désactiver + message dédié)                                                                                             |
| `backend-nest/.../postpone-budget-line.use-case.ts:60-116`                  | Les 5 cas de refus backend du report                                                                                                                        |
| `backend-nest/.../whats-new-payload.ts:45` + `releases-data.parity.spec.ts` | Filtre `platforms.includes(platform)` + spec de parité qui verrouille le format des releases                                                                |
| Captures live                                                               | Scratchpad session `989c02e1` : 11 écrans émulateur (06→20), log backend prouvant C1                                                                        |

## Decisions

| Decision                                                                                                            | Why                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gardes rollover **côté shared**, jamais côté client                                                                 | Le Swift les a déjà ; le TS est le côté divergent. Corriger la source unique répare web ET Android d'un coup ; les filtres client Android deviennent morts et partent |
| `current-month-view-model.ts` perd son commentaire accusant iOS                                                     | Vérifié faux dans le Swift (gardes présentes) — cf. règle root-cause-honesty                                                                                          |
| Bottom sheet : brancher `@gorhom/bottom-sheet` plutôt que renommer en `Dialog`                                      | Déjà installé, `GestureHandlerRootView` déjà monté ; un formulaire 6 champs + footer épinglé est le cas d'école M3 ; 17 fichiers `*-sheet.tsx` gardent leur nom       |
| Onboarding : hero au mint constant (doctrine du dashboard)                                                          | `DESIGN.md:84` réserve le corail au dashboard hero ; PRODUCT.md promet le soulagement au premier contact                                                              |
| `tabBarVariant: "material"`, cibles 48dp, ripple systématique                                                       | Conformité M3 de base ; le 44 vient d'iOS et le commentaire qui le justifiait est factuellement faux                                                                  |
| Virtualisation : `FlatList` seulement (pas de FlashList)                                                            | Pas de dépendance nouvelle pour un besoin que la primitive RN couvre                                                                                                  |
| Feed nouveautés : tag `android` ajouté aux entrées pertinentes + entrée 0.43.0, parité élargie plutôt que dupliquée | Une release Android-only est aujourd'hui impossible (spec de parité exige `iosVersion`) ; on élargit le contrat au lieu de le contourner                              |
| Écrans humains (EAS init, Play Console, keystore, assetlinks publiés)                                               | Non scriptables : listés en checklist phase 9, jamais « faits » par un agent                                                                                          |
