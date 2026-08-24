---
objective: "Les findings de la review MCP que personne d'autre ne bloque sont soldés : aucune audience vide ne passe, un échec de lecture ne se lit plus comme un échec d'écriture, et le plugin Claude Code ne fige plus ses utilisateurs sur la version du jour."
status: in-progress
---

# Plan: Solder les findings traitables de la review MCP

## Overview

| Field      | Value                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **Goal**   | Trois correctifs, un faux positif consigné, et la review remise sur l'état réel                         |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_23_pulpe-mcp-agent-connector/review.md`, section `Findings`, lignes 🟢 |

## Phases

| #   | Phase                                    | File                         |
| --- | ---------------------------------------- | ---------------------------- |
| 1   | Durcir le garde et le diagnostic backend | [`phase-1.md`](./phase-1.md) |
| 2   | Dépiner le plugin Claude Code            | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                     | Verified                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://code.claude.com/docs/en/plugins-reference (schéma `plugin.json`)   | `version` est **optionnel**, et le déclarer **épingle** le plugin : « existing users of those sources keep the cached copy, because Claude Code sees the same version ». Seul `name` est requis                                            |
| https://code.claude.com/docs/en/plugin-marketplaces (Version management)   | Sur une source git, `version` omis => Claude Code prend le SHA du commit résolu, « the simplest setup for internal or actively developed plugins ». Le `version` de `marketplace.json` est le « marketplace manifest version », pas un pin |
| `backend-nest/src/app.module.ts:337` + `client-key-cleanup.interceptor.ts` | `ClientKeyCleanupInterceptor` est monté en `APP_INTERCEPTOR`, donc global : il zéroise `request.user.clientKey` sur `/mcp` comme sur toute autre route. Le finding « clientKey non zéroisé » est un faux positif                           |
| `grep MCP_CONNECTION_SAVE_FAILED` sur `frontend/`, `ios/`, `shared/`       | Aucun client ne lit ce code : le renommer ne casse aucun contrat de surface                                                                                                                                                                |

## Decisions

| Decision                                                                              | Why                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retirer `version` de `plugin.json` plutôt que de le brancher sur le script de release | La doc décrit l'omission comme le réglage normal d'un plugin activement développé sur source git : le SHA devient le signal de mise à jour, et le champ ne peut plus dériver puisqu'il n'existe plus. Le synchroniser demanderait un script de plus |
| Un seul code d'erreur neutre plutôt qu'un code par opération                          | Le champ `operation` part déjà dans les logs, qui sont l'endroit du diagnostic. Trois codes pour un 500 que nul client ne lit seraient trois constantes à maintenir sans lecteur                                                                    |
| Ne pas « corriger » la zéroisation du `clientKey` dans le garde                       | L'intercepteur global couvre le chemin nominal. Le seul endroit où il ne peut rien est l'échec du coffre, avant que `request.user` existe, et le garde y zéroise déjà à la main. Un second `fill(0)` serait du bruit, pas une garantie de plus      |
