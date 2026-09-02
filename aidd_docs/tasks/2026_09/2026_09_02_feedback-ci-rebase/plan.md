---
objective: "La branche de feedback iOS intègre origin/main et ses checks Workspace, Maestro smoke et CI Success sont verts."
status: reviewed
---

# Plan: Remettre la PR feedback au vert

## Overview

| Field      | Value                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Rebaser la branche sur `origin/main`, reprendre le correctif Expo et réparer uniquement les échecs CI encore reproductibles. |
| **Source** | Demande utilisateur du 2 septembre 2026 et jobs GitHub Actions `33605734541` / `33605734545`                                 |

## Phases

| #   | Phase                         | File                         |
| --- | ----------------------------- | ---------------------------- |
| 1   | Synchroniser et valider la CI | [`phase-1.md`](./phase-1.md) |

## Resources

| Source                                                                     | Verified                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| https://github.com/neogenz/pulpe/actions/runs/33605734541/job/100169157606 | Le job Android construit l’APK puis échoue pendant `Run Maestro smoke`. |
| https://github.com/neogenz/pulpe/actions/runs/33605734545/job/100169351118 | Le job Workspace échoue uniquement pendant `Check dependency graphs`.   |
| https://github.com/neogenz/pulpe/actions/runs/33605734545/job/100173799621 | `CI Success` est un échec dérivé d’un job requis en échec.              |
