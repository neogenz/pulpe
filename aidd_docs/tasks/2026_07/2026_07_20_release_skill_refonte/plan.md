---
objective: "Le skill s'appelle `release`, accepte un départ depuis `preview` ou `main`, fait valider le SHA de release sur `preview`, promeut ce même SHA vers `main`, puis publie seulement après validation de la production."
status: in-progress
---

# Plan: Refonte du skill release

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Renommer `update-changelog` → `release` et rendre la procédure de publication sûre et testable |
| **Source** | Audit de session du 2026-07-20, vérifié contre l'état du dépôt et les services de déploiement   |

## Phases

| #   | Phase                                                         | File                         |
| --- | ------------------------------------------------------------- | ---------------------------- |
| 1   | Renommer `update-changelog` → `release`                       | [`phase-1.md`](./phase-1.md) |
| 2   | Sécuriser l'ordre de publication et le SHA promu              | [`phase-2.md`](./phase-2.md) |
| 3   | Ajouter l'invariant anti-toast-périmé                          | [`phase-3.md`](./phase-3.md) |
| 4   | Aligner Changesets et la documentation de déploiement         | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                                                                                    | Use in this plan                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Railway — GitHub Autodeploys](https://docs.railway.com/deployments/github-autodeploys)                                                   | Confirme qu'un push sur la branche connectée déclenche un déploiement et que « Wait for CI » est une option distincte |
| [Vercel — Git](https://vercel.com/docs/git)                                                                                               | Confirme qu'un push sur la Production Branch crée un déploiement de production                                        |
| [GitHub — Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) | Cadre les protections de branches/tags et le rôle du bypass                                                            |
| [Changesets — `baseBranch`](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md#basebranch-git-branch-name)     | Définit la branche contre laquelle Changesets compare les changements                                                  |

## Decisions

| Decision                                                                                                         | Why                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Les départs depuis `preview` et `main` convergent vers un SHA exact poussé sur `preview`                          | Le workflow reste utilisable dans les deux situations sans contourner la validation de staging                                                       |
| La promotion utilise `$SHA:refs/heads/main`, jamais `origin/preview:refs/heads/main`                              | Le SHA validé ne peut pas être remplacé silencieusement si `preview` avance entre la CI et le push                                                    |
| Toute CI annulée, rouge ou associée à un autre SHA arrête la publication                                          | Une annulation ne prouve pas que le commit a été validé                                                                                               |
| Le tag et la GitHub Release sont créés après la CI `main` et la disponibilité des déploiements du SHA exact       | Les tags `v*` sont immuables ; publier avant la production brûlerait un numéro de version en cas d'échec                                               |
| `LATEST_WEB_VERSION` change après disponibilité du web ; `LATEST_IOS_VERSION` après disponibilité App Store      | Les gates client ne doivent jamais annoncer une version qui n'est pas encore publique                                                                |
| Le toast exige une égalité stricte, sauf version inscrite dans un registre explicite de releases silencieuses     | Une comparaison `major.minor` laisserait passer n'importe quel oubli sur un patch                                                                     |
| La branche `preview` est conservée et aucun générateur de notes ni champ `scope` n'est ajouté                     | Ces changements dépassent la correction de la procédure de release                                                                                   |
| La réédition d'une GitHub Release déjà publiée est une maintenance séparée, soumise à approbation explicite       | Elle modifie une surface publique existante et ne fait pas partie du chemin normal de publication                                                     |
