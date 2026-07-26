---
objective: "Faire de l’objectif d’épargne un intervalle optionnel cohérent sur le backend, le web et iOS, borner ses prévisions et sécuriser les changements d’échéance."
status: in-progress
---

# Plan: Implémenter l’objectif d’épargne comme intervalle optionnel

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Permettre un objectif avec seulement un nom, un début, une cible et une échéance tous optionnels, puis rendre les prévisions et les interfaces cohérentes avec chaque combinaison. |
| **Source** | Linear PUL-314, PUL-312, PUL-313 et PUL-317 |
| **Feature racine** | PUL-314, seul ticket de type Feature. |
| **Travaux liés** | PUL-312 corrige la propagation depuis le Mois Type ; PUL-313 réconcilie une échéance avancée ; PUL-317 rend le lien objectif visible. Aucun n’est une sous-tâche Linear formelle. |
| **Prérequis vérifiés** | PUL-311 et PUL-316 sont déjà intégrés. |
| **Plan antérieur** | Le chemin cité dans Linear, `2026_07_25_savings-goal-as-a-unit`, n’existe dans aucun ref Git accessible ; ce plan le remplace. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Poser le contrat nullable et les calculs d’intervalle | [`phase-1.md`](./phase-1.md) |
| 2 | Borner la propagation depuis le Mois Type (PUL-312) | [`phase-2.md`](./phase-2.md) |
| 3 | Implémenter les parcours backend de l’objectif libre | [`phase-3.md`](./phase-3.md) |
| 4 | Adapter le parcours Angular aux quatre combinaisons | [`phase-4.md`](./phase-4.md) |
| 5 | Adapter le parcours iOS et sécuriser le rollout | [`phase-5.md`](./phase-5.md) |
| 6 | Rendre l’avancement d’échéance atomique côté serveur (PUL-313) | [`phase-6.md`](./phase-6.md) |
| 7 | Ajouter la confirmation d’échéance sur Angular et iOS | [`phase-7.md`](./phase-7.md) |
| 8 | Afficher l’objectif lié dans le Mois Type (PUL-317) | [`phase-8.md`](./phase-8.md) |

## Resources

- [PUL-314](https://linear.app/pulpe/issue/PUL-314) : feature racine et matrice cible/échéance/début.
- [PUL-312](https://linear.app/pulpe/issue/PUL-312) : règles de borne lors de la propagation du Mois Type.
- [PUL-313](https://linear.app/pulpe/issue/PUL-313) : choix utilisateur et atomicité lors d’une échéance avancée.
- [PUL-317](https://linear.app/pulpe/issue/PUL-317) : affordance du lien objectif dans le Mois Type et le mode Tableau.
- [PUL-311](https://linear.app/pulpe/issue/PUL-311) : garde déjà livrée lors de la génération d’un budget.
- [PUL-316](https://linear.app/pulpe/issue/PUL-316) : décomposition bornée déjà livrée pour les objectifs datés.

## Decisions

| Decision | Rationale |
| --- | --- |
| `undefined` conserve une valeur et `null` la retire sur chaque PATCH. | Une cible ou une date supprimée ne doit jamais être confondue avec un champ non modifié. |
| Ajouter `plannedProjection` au contrat de progression au lieu de redéfinir `plannedCumulative`. | Le prévu existant mesure un flux et exclut volontairement le montant de départ ; la nouvelle projection doit inclure ce stock sans casser la sémantique actuelle. |
| L’ancrage historique est stable : `max(createdAt, startDate)` ; seules les nouvelles écritures et la fenêtre restante utilisent `max(cycle courant, ancrage historique)`. | Une borne glissante sur le mois courant ferait disparaître l’historique ; les objectifs existants sans début doivent démarrer implicitement à leur création. |
| `monthlyContribution` reste facultative dans toutes les combinaisons ; seule sa suggestion exige cible et échéance. | Cela concilie « seul le nom requis » avec le commentaire Linear : daté => lignes `one_off` bornées, non daté => ligne récurrente du Mois Type. |
| PUL-312 résout les horizons une fois par opération via le port budget imposé, sans cache singleton. | Une lecture groupée évite le N+1 ; un cache partagé risquerait de mélanger les utilisateurs. |
| PUL-313 étend le PATCH existant avec une décision de réconciliation et une RPC atomique. | `PATCH` puis `generation-stop` peut laisser la nouvelle date écrite avec des prévisions incohérentes. |
| PUL-317 réutilise la liste d’objectifs cache-dédoublée ; aucune requête par ligne. | Une entrée froide dans le Mois Type peut nécessiter un unique GET, car le store Angular est limité à la route objectifs. |
| Le backend nullable ne doit être activé en production qu’après disponibilité d’un iOS qui décode les valeurs absentes. | Les builds iOS actuelles déclarent cible et échéance obligatoires et peuvent perdre toute la liste au premier objectif libre. |
