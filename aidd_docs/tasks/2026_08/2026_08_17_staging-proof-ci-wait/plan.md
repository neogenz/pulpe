---
objective: "Rendre la preuve de staging robuste à une fusion preview autorisée pendant que sa CI canonique est encore en cours, sans affaiblir les contrôles d'identité ni la promotion de release."
status: in-progress
---

# Plan: Attente CI canonique dans la preuve de staging

## Overview

| Field      | Value                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Faire attendre `Staging Ready` sur la CI exacte de la PR fusionnée, puis certifier uniquement un run réussi et son attempt immuable.   |
| **Source** | Demande du 17 août 2026 après l'échec du run `32013917512`, déclenché par Railway alors que la CI de la PR #622 était encore en cours. |

Le run échoué reste une preuve historique, mais ne doit plus être relancé : `preview`
a avancé de `3d0f96aba` à `018b557af` pendant la planification. Le canary du correctif
produira la prochaine preuve pertinente sur la nouvelle tête de branche.

## Phases

| #   | Phase                                           | File                         |
| --- | ----------------------------------------------- | ---------------------------- |
| 1   | Ajouter l'attente bornée et ses contrats        | [`phase-1.md`](./phase-1.md) |
| 2   | Valider la course réelle et livrer le correctif | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                    | Verified                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| https://github.com/neogenz/pulpe/actions/runs/32013917512 | `Staging Ready` a sélectionné le bon run CI, puis a échoué immédiatement sur `in_progress/None`. |
| https://github.com/neogenz/pulpe/pull/622                 | La CI canonique a finalement réussi, après le déploiement Railway et l'échec de la preuve.       |

## Decisions

| Decision                                                                                                                     | Why                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conserver `deployment_status` comme déclencheur et attendre le run CI canonique dans le workflow existant.                   | Une seconde orchestration ou un nouveau service est inutile ; le workflow connaît déjà la PR, le SHA et le run exacts.                             |
| Attendre au plus 30 minutes et porter le timeout du job à 55 minutes.                                                        | La CI possède des jobs pouvant durer 25 minutes et la vérification des fournisseurs conserve sa propre marge, tout en garantissant une fin bornée. |
| Rejeter immédiatement toute CI terminée sans succès, tout état inconnu, une API indisponible ou un déplacement de `preview`. | L'attente résout uniquement l'ordre des événements ; elle ne doit jamais transformer une preuve incertaine en autorisation de promotion.           |
| Ne pas relancer la preuve historique de la PR #622 après le déplacement de `preview`.                                        | Le contrôle d'immobilité doit refuser de certifier un ancien SHA ; le prochain merge contrôlé fournira une preuve actuelle et honnête.             |
