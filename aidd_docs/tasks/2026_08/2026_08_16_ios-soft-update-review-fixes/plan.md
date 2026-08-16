---
objective: "Le prompt de mise à jour iOS reste bloqué jusqu'au contrôle « Nouveau dans Pulpe » de la session authentifiée courante, y compris après une déconnexion, et les remarques de revue encore applicables sont soldées sans réintroduire de documentation obsolète."
status: in-progress
---

# Plan: corriger les remarques de revue du prompt doux iOS

## Overview

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Réinitialiser de façon synchrone le droit aux présentations de moindre priorité quand l'authentification prend fin, empêcher un contrôle obsolète de le réactiver et expliciter la garde qui maintient une sheet déjà visible.                                                                                                                                                       |
| **Source** | Six commentaires de revue fournis dans la tâche Codex du 16 août 2026 sur la [PR #611](https://github.com/neogenz/pulpe/pull/611). Le commentaire P2 sur `WhatsNewStore` exige un correctif ; les deux suggestions sur `AppVersionStore` sont un doublon ; l'approbation n'appelle aucun changement ; les deux remarques sur `review.md` sont déjà satisfaites dans le HEAD courant. |

## Phases

| #   | Phase                                                                       | File                         |
| --- | --------------------------------------------------------------------------- | ---------------------------- |
| 1   | Isoler la priorité de présentation par session et verrouiller la régression | [`phase-1.md`](./phase-1.md) |
