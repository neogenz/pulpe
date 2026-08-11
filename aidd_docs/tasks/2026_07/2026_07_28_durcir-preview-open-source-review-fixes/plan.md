---
objective: "Les findings bloquants de la revue de durcissement sont corrigés à leur frontière commune, sans régression des parcours de coffre web/iOS, du debug preview, du support PostHog ni des workflows locaux."
status: done
---

# Plan: Fermer les failles restantes du durcissement preview

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer le bootstrap arbitraire du coffre et les contournements par cache, puis corriger les fuites de logs, les trous de sanitization analytics et les contradictions publiques confirmées, avec le plus petit diff vérifiable. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_28_durcir-preview-open-source/review.md` et exploration du flux réel `salt → validate-key/setup-recovery → cache DEK → écritures/suppression`. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Verrouiller le cycle de vie du coffre et la suppression | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre les logs preview utiles sans fuite | [`phase-2.md`](./phase-2.md) |
| 3 | Fermer les contournements analytics web et iOS | [`phase-3.md`](./phase-3.md) |
| 4 | Réparer les contrats publics et valider l’ensemble | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Rendre `validate-key`, `ensureUserDEK` et la vérification destructive stricts et non mutables quand `key_check` manque. | Corriger seulement la suppression laisserait deux contournements : bootstrap préalable via `validate-key`, puis cache d’une DEK non vérifiée par une lecture avant une écriture. |
| Réserver le seul bootstrap à `setup-recovery`, uniquement pour un coffre où `key_check` et `wrapped_dek` sont absents et où aucune donnée chiffrée n’existe. | Un coffre vide n’a encore aucun secret serveur permettant de distinguer deux clés candidates; dès qu’une donnée protégée ou une clé de récupération existe, l’initialisation arbitraire doit échouer. |
| Écrire `key_check` et `wrapped_dek` ensemble par une mise à jour conditionnelle unique. | Évite l’état partiel où une clé de récupération est stockée sans canari, ainsi que les courses entre deux initialisations, sans migration ni nouvel endpoint. |
| Réutiliser `setup-recovery` dans les parcours de création web/iOS et conserver `validate-key` pour les retours, biométrie et changements de PIN. | Maintient les routes et primitives existantes; seul leur contrat devient explicite : initialiser d’un côté, vérifier de l’autre. |
| Corriger chaque fuite dans son sanitizer ou sa frontière centrale existante. | Un garde partagé protège tous les appelants avec moins de code et moins de risque qu’une série de correctifs locaux. |
| Ne modifier aucune UI structurelle. | Les findings restants demandent du comportement, des tests, de la documentation et une phrase de landing; aucun nouveau composant ni wireframe n’est justifié. |
