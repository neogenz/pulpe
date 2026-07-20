---
objective: "La PR #522 teste la version produit réellement utilisée par le toast et refuse toute base de release où `preview` et `main` ne sont pas dans la bonne relation d'ascendance avant toute modification de release ou mutation distante."
status: implemented
---

# Plan: Corriger les findings de review du skill release

## Overview

| Field      | Value                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| **Goal**   | Fermer les deux findings P2 sans élargir le workflow de release                                             |
| **Source** | Commentaires de diff utilisateur sur la PR GitHub `neogenz/pulpe#522`, confirmés contre le code de la branche |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Tester la version produit réellement injectée dans le toast  | [`phase-1.md`](./phase-1.md) |
| 2   | Bloquer une divergence `preview` / `main` dès le preflight   | [`phase-2.md`](./phase-2.md) |
| 3   | Garder le scénario de divergence indépendant des releases     | [`phase-3.md`](./phase-3.md) |
| 4   | Identifier précisément chaque dérive de métadonnées            | [`phase-4.md`](./phase-4.md) |
