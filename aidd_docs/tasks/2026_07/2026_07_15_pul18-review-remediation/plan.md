---
objective: "Toutes les fenêtres d'historique respectent le contrat, les écritures mêlant tags et données métier sont atomiques, les tags sont accessibles au clavier et la PR #502 ne référence qu'un HEAD entièrement validé."
status: implemented
---

# Plan: Fermer la revue finale de PUL-18

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les cinq avertissements et le point mineur de la revue locale sans régresser les objectifs d'épargne, le chiffrement, le lissage ou l'isolation tenant. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_15_pul18-tag-completion/review.md` + demande utilisateur du 2026-07-15 |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Fermer le contrat historique et l'accessibilité | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre les mises à jour unitaires atomiques | [`phase-2.md`](./phase-2.md) |
| 3 | Rendre le bulk template atomique | [`phase-3.md`](./phase-3.md) |
| 4 | Valider et remettre la PR à niveau | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://www.postgresql.org/docs/current/plpgsql-transactions.html | Une fonction PL/pgSQL ne crée pas de frontière de commit; une erreur non interceptée annule les écritures de l'appel englobant. |
| https://github.com/neogenz/pulpe/pull/502 | La PR cible `preview`, mais son HEAD distant est six commits derrière le HEAD local revu et son body décrit encore l'ancien périmètre. |

## Decisions

| Decision | Why |
| --- | --- |
| Trois RPCs d'update typés par table remplacent l'ordre séquentiel tags/scalaires; aucun RPC générique à SQL dynamique. | Les trois shapes et erreurs métier diffèrent; des fonctions explicites conservent RLS, contraintes, nullabilité et lisibilité de l'audit SQL. |
| Le repository bulk appelle un wrapper SQL unique qui compose les deux RPCs existants dans la même transaction. | Cela corrige la mutation partielle sans recopier les ~350 lignes durcies de `apply_template_line_operations` ni maintenir une compensation incomplète. |
| Le chiffrement reste exclusivement dans les repositories avant l'appel RPC. | Les fonctions SQL ne manipulent que les ciphertexts déjà produits par `ENCRYPTION_PORT`, conformément à `docs/ENCRYPTION.md`. |
| Aucun push avant une nouvelle revue approuvée et la validation complète du HEAD final. | Les checks actuels de GitHub portent sur un ancien commit et ne prouvent rien sur les corrections locales. |
