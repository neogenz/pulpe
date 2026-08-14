---
objective: "Toute doc Claude chargée est vraie, atteignable et non dupliquée ; la baseline injectée à chaque tour passe sous 400 lignes."
status: implemented
---

# Plan: Nettoyage de la documentation Claude

## Overview

| Field      | Value                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Corriger les ~35 faits faux du corpus Claude, supprimer les docs mortes, dédupliquer, aligner sur les pratiques Opus 5     |
| **Source** | Audit du 2026-08-04 (194 fichiers, 17 agents) + docs officielles Claude Code / Opus 5 d'août 2026                          |

Périmètre : 48 règles `.claude/rules/`, 5 `CLAUDE.md`, `~/.claude/CLAUDE.md`, 17 `aidd_docs/memory/`, 5 agents, 3 commands, 119 mémoires auto + `MEMORY.md`, 5 READMEs de l'arbre applicatif.

## Phases

| #   | Phase                                   | File                         |
| --- | --------------------------------------- | ---------------------------- |
| 1   | Baseline toujours injectée              | [`phase-1.md`](./phase-1.md) |
| 2   | Suppression des règles mortes           | [`phase-2.md`](./phase-2.md) |
| 3   | Correctness des règles restantes        | [`phase-3.md`](./phase-3.md) |
| 4   | CLAUDE.md de package, agents, commands  | [`phase-4.md`](./phase-4.md) |
| 5   | Mémoires auto                           | [`phase-5.md`](./phase-5.md) |
| 6   | Trim du signal                          | [`phase-6.md`](./phase-6.md) |

Phases 1 à 5 = correctness et hygiène, ordre à respecter. Phase 6 = volume pur, peut être différée sans risque.

## Resources

| Source                                                                                                    | Verified                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [code.claude.com/docs/en/best-practices](https://code.claude.com/docs/en/best-practices)                   | Le test à appliquer ligne par ligne : « Would removing this cause Claude to make mistakes? If not, cut it. » Table ✅ Include / ❌ Exclude — exclut explicitement « anything Claude can figure out by reading code », « standard language conventions », « self-evident practices ». « Bloated CLAUDE.md files cause Claude to ignore your actual instructions. » Si une règle est déjà respectée sans instruction : la supprimer ou la convertir en hook. |
| [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)                                   | Cible < 200 lignes par CLAUDE.md. Les règles **sans `paths:` sont chargées au lancement avec la même priorité que `.claude/CLAUDE.md`** → confirme le coût permanent de `webapp-currency-formatting.md`. Les `@imports` **ne réduisent pas le contexte** (chargés au lancement). Les commentaires HTML de bloc sont **retirés avant injection** (coût zéro). `MEMORY.md` : 200 lignes / 25 KB, au-delà tout est ignoré. Deux règles contradictoires → « Claude may pick one arbitrarily ». |
| [platform.claude.com — Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) | « Claude Opus 5 verifies its own work without being told to. If your prompt contains explicit verification instructions […] **remove them** […] removing them reduces wasted tokens with no loss in quality. The same applies to legacy harness scaffolding. » Idem pour « double-check your answer ». Opus 5 délègue aux subagents plus volontiers → plafonner explicitement. Opus 5 élargit le périmètre → la contrainte de scope explicite est recommandée (valide la section Scope Discipline existante). |

## Decisions

| Decision                                                                                                              | Why                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/rules/` devient l'owner unique de toute règle path-scopée ; les `CLAUDE.md` de package ne gardent que commandes et inventaire | Les règles sont plus détaillées et plus à jour que les CLAUDE.md de package, et ne coûtent que sur les fichiers concernés. Le CLAUDE.md de package, lui, est payé sur chaque tour du package. Là où les deux se recouvrent, c'est la copie dégradée qui paie le loyer. |
| Supprimer plutôt que réparer les 4 règles mortes                                                                       | Glob mort ou sous-ensemble strict d'une autre règle : réparer un glob ferait entrer en contexte 337 lignes jamais relues depuis janvier 2026 et jamais validées contre le code actuel.                                            |
| Ne pas soumettre `.claude/**` à prettier                                                                               | Vérifié : `pnpm format:check` ne couvre que `.github/**` plus les packages ; `.claude/` n'appartient à aucun package. Y passer prettier créerait un diff de bruit sans gate qui l'exige.                                          |
| Ne rien ajouter au corpus, sauf le plafond de délégation subagent                                                      | Le corpus souffre d'excès, pas de manque. Seule exception : Opus 5 délègue plus volontiers que 4.8 et rien dans le corpus ne le borne — c'est le seul manque que la doc officielle d'août 2026 rend actionnable.                   |
