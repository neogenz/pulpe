---
objective: "Rattacher une épargne à un objectif hors échéance est refusé par un message clair, sans jamais vider la page ni renvoyer un 500, sur le web comme sur iOS."
status: implemented
---

# Plan: Rejet d'un rattachement d'épargne hors échéance

## Overview

| Field      | Value                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Le refus métier existant remonte en 422 lisible côté web et iOS, et le picker cesse de proposer un objectif que la base refusera.           |
| **Source** | Bug reproduit sur l'environnement de preview le 2026-08-02, tracé jusqu'au log Railway `POST /api/v1/budget-lines` `statusCode=500`.        |

## Phases

| #   | Phase                                        | File                         |
| --- | -------------------------------------------- | ---------------------------- |
| 1   | Le refus horizon devient un 422              | [`phase-1.md`](./phase-1.md) |
| 2   | Le message atteint l'utilisateur             | [`phase-2.md`](./phase-2.md) |
| 3   | Le picker web cesse de proposer l'impossible | [`phase-3.md`](./phase-3.md) |
| 4   | Le picker iOS atteint la même parité         | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                | Verified                                                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Log Railway, service `backend`, environnement `preview`, 2026-08-02   | `errorCode=ERR_BUDGET_LINE_CREATE_FAILED`, `supabaseError.code=P0001`, pile dans `insert` — la cause est le mapping manquant |
| `docs/SAVINGS.md` §6                                                  | Un objectif dont l'échéance est dépassée reste `ACTIVE`, s'affiche factuellement et propose « repousser la date »           |
| `docs/SAVINGS.md` §3.5                                                | « Redistribution jamais silencieuse » — prolonger l'échéance à la place de l'utilisateur est exclu                          |

## Decisions

| Decision                                                                                            | Why                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le trigger SQL garde son rejet ; seul son transport est corrigé.                                    | Le refus est la règle métier PUL-313. L'assouplir rouvrirait le bug que PUL-311 puis PUL-316 ont fermé.                                                                          |
| Les échecs de mutation passent par la valeur de retour, jamais par le signal d'erreur de la page.   | Le motif existe déjà pour la suppression (`budget-details-store.ts`) avec cette justification écrite. On étend un motif établi au lieu d'en inventer un.                        |
| Un objectif hors horizon reste listé, désactivé, avec son motif.                                    | Un objectif absent de la liste est inexplicable pour qui le cherche. Un objectif grisé et motivé se comprend seul et n'appelle aucun support.                                    |
| Le picker du Mois Type n'est pas filtré.                                                            | Le trigger n'applique la borne qu'à `budget_line`. Filtrer `template_line` interdirait un geste légal.                                                                          |
