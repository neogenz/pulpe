---
objective: "L'intention affichée d'une release correspond exactement au candidat publié, le contrat expand refuse les opérations ambiguës identifiées et la CI iOS évite son second runner sans perdre de preuve."
status: implemented
---

# Plan: Durcir la release et raccourcir la CI

## Overview

| Field      | Value                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| **Goal**   | Fermer les deux écarts de sécurité constatés et tenter le seul raccourcissement CI simple mesuré. |
| **Source** | Demande utilisateur du 2026-08-31 et audit confirmé de la procédure release/CI actuelle.          |

## Phases

| #   | Phase                                       | File                         |
| --- | ------------------------------------------- | ---------------------------- |
| 1   | Lier l'intention à la release publiée       | [`phase-1.md`](./phase-1.md) |
| 2   | Durcir le contrat SQL expand                | [`phase-2.md`](./phase-2.md) |
| 3   | Réutiliser le runner iOS et mesurer le gain | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                                             | Verified                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations | Un workflow réutilisable reçoit ses valeurs déclarées par `workflow_call.inputs` via `jobs.<job_id>.with`; son contexte GitHub reste celui du caller.                |
| https://www.postgresql.org/docs/17/sql-altertable.html                                             | Sur PostgreSQL 17, `NOT VALID` évite le scan initial pour `CHECK` et `FOREIGN KEY`; les autres contraintes ne supportent pas cette option.                           |
| https://www.postgresql.org/docs/17/sql-createview.html                                             | `CREATE OR REPLACE VIEW` conserve la forme générale mais peut changer entièrement le calcul des colonnes et n'établit donc pas la compatibilité des anciens clients. |
| https://github.com/neogenz/pulpe/actions/runs/33277093564                                          | Première CI complète de référence après cutover : chaîne iOS à deux jobs et durée totale observables.                                                                |
| https://github.com/neogenz/pulpe/actions/runs/33280022235                                          | Seconde CI complète de référence après cutover : le smoke iOS recompilait sur un nouveau runner pendant environ neuf minutes.                                        |

## Decisions

| Decision                                                                                                                | Why                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Passer la branche demandée comme input requis de `production.yml`, puis la comparer à la branche déduite du SHA.        | C'est le mécanisme GitHub Actions natif et le plus petit changement qui lie l'audit visible à l'autorisation existante.     |
| Garder le validateur SQL lexical et ajouter des refus conservateurs ciblés.                                             | Un parseur SQL ajouterait une dépendance et une fausse promesse de compatibilité que la revue métier doit toujours assurer. |
| Déplacer le smoke iOS dans le job iOS existant, sans fusionner les jobs web ni ajouter de cache distant ou de sharding. | Le second runner Xcode est la seule duplication coûteuse mesurée; le chemin web ne présente qu'un faible overhead de job.   |
