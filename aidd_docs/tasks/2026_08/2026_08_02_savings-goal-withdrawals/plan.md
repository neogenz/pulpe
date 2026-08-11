---
objective: "Un revenu peut provenir d'un objectif d'épargne sans jamais permettre de retirer plus que le solde confirmé, avec un lien durable et navigable entre les deux côtés."
status: pending
---

# Plan: utiliser un objectif d'épargne comme source d'un revenu

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter à un revenu libre une origine facultative « objectif d'épargne », diminuer atomiquement le solde réel de cet objectif, puis rendre ce lien visible et navigable sur le web et iOS, y compris après suppression de l'objectif. |
| **Source** | Brainstorm produit validé le 02.08.2026, double vérification UX avec les patterns Impeccable, lissage, tags et objectifs existants, et le classeur « Prévisions économies maison.xlsx » comme contexte métier initial. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Figer le contrat métier et les formules de progression | [`phase-1.md`](./phase-1.md) |
| 2 | Poser le modèle PostgreSQL et les mutations atomiques | [`phase-2.md`](./phase-2.md) |
| 3 | Exposer les parcours backend et protéger toutes les mutations | [`phase-3.md`](./phase-3.md) |
| 4 | Livrer le parcours web et ses liens actifs ou cassés | [`phase-4.md`](./phase-4.md) |
| 5 | Livrer le parcours iOS natif et accessible | [`phase-5.md`](./phase-5.md) |
| 6 | Prouver le parcours de bout en bout et fermer les régressions | [`phase-6.md`](./phase-6.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Le lien est porté par la transaction libre via `sourceSavingsGoalId`, avec un unique identifiant et un nom snapshot en lecture seule. | Un seul objectif peut financer un revenu. Le champ unique rend cette cardinalité structurelle, tandis que le snapshot conserve le contexte si l'objectif est supprimé. |
| Un retrait est un mouvement de stock : `confirmé = montant initial + contributions confirmées − retraits`. Il ne modifie ni les prévisions d'épargne ni le rythme des contributions. | L'utilisateur retire réellement de son pot sans réécrire son plan futur ; il pourra ajuster ce plan séparément avec les outils existants. |
| Le montant soustrait est le montant normalisé dans la devise du compte, après conversion éventuelle du revenu. | L'objectif et les budgets utilisent la devise du compte ; comparer ou retirer le montant saisi dans une autre devise rendrait le contrôle de solde incohérent. |
| Les créations, changements de montant et suppressions de revenus liés passent par des RPC atomiques et une `balance_revision` de l'objectif. | Les montants sont chiffrés et PostgreSQL ne peut pas recalculer le solde. Le backend le calcule en clair, puis la révision et le verrou garantissent que ce calcul n'est pas devenu obsolète avant l'écriture. |
| La révision est invalidée de façon conservative par toute écriture susceptible de changer le stock ou sa chronologie. | Une contribution pointée, un montant initial, une transaction allouée ou un retrait concurrent ne doit jamais laisser passer un retrait fondé sur un solde périmé. Les faux conflits sont préférables à un découvert silencieux. |
| Le lien d'origine est immuable : aucune API d'édition ne permet de le retirer, de le remplacer ou de transformer le revenu en un autre type. | C'est l'historique de provenance du revenu. Modifier le montant synchronise le retrait ; supprimer le revenu l'annule. Un changement d'objectif sera traité plus tard comme supprimer puis recréer. |
| Supprimer un objectif conserve toujours les revenus liés, met leur identifiant de source à `null` et garde le dernier nom de l'objectif. | L'utilisateur a autorisé la suppression de l'objectif, mais la transaction du budget reste une réalité comptable. Le lien cassé explique son origine sans proposer une navigation impossible. |
| Les objectifs `ACTIVE`, `PAUSED` et `COMPLETED` sont éligibles dès que leur solde confirmé est strictement positif ; un retrait ne change jamais automatiquement leur statut. | Le statut décrit une décision de l'utilisateur. Un objectif atteint peut être utilisé puis rouvert manuellement si nécessaire. |
| Le parcours reste dans « Ajouter un revenu » avec l'option « Ce revenu vient d'un objectif d'épargne ». Aucune deuxième action nommée « Retirer » n'est ajoutée. | Cette formulation décrit directement l'origine de l'argent et évite la collision avec l'ancien parcours qui crée automatiquement un remboursement le mois suivant. |
| L'ancien parcours PUL-292 devient « Couvrir ce mois avec mon épargne » avec « À remettre le mois prochain ». | Il reste un mécanisme revenu M + remboursement M+1 et ne doit pas être confondu avec le retrait réel et durable d'un objectif. |
| Aucun module métier supplémentaire n'est créé : le module transaction reste propriétaire de l'écriture et le module objectif expose la politique de solde et les lectures. | Le lien traverse deux agrégats, mais les responsabilités actuelles suffisent. Un nouveau module ne ferait que déplacer les mêmes dépendances et élargir le diff. |
| Le partage d'un objectif entre comptes, la réparation d'un lien cassé et la réaffectation vers un autre objectif restent hors V1. | Ces capacités changeraient le modèle d'autorisation et l'historique. Elles ne sont pas nécessaires au besoin validé. |
