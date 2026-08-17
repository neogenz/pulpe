---
objective: "Depuis le détail d’une prévision liée, un seul tap affiche immédiatement un choix de suppression dont chaque action nomme exactement les mois concernés."
status: implemented
---

# Plan: Corriger le dialogue iOS de suppression des prévisions liées

## Overview

| Field      | Value                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Présenter la confirmation sur la page visible et remplacer les libellés ambigus sans changer les deux portées métier existantes. |
| **Source** | [PUL-336](https://linear.app/pulpe/issue/PUL-336/corriger-la-confirmation-de-suppression-des-previsions-liees-sur-ios), issu du signalement utilisateur et consolidé dans [`debug.md`](./debug.md). |

## Phases

| #   | Phase                                                   | File                         |
| --- | ------------------------------------------------------- | ---------------------------- |
| 1   | Présenter et verrouiller le choix sur le détail visible | [`phase-1.md`](./phase-1.md) |
