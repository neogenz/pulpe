---
objective: "Les 5 findings de review.md sont levés, sans changer le comportement servi par GET /api/v1/app/version."
status: implemented
---

# Plan: Lever les findings de review de la PR #564

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Passer le verdict de `changes-requested` à `approve` en corrigeant 2 warnings et 3 minors, sans toucher au payload servi |
| **Source** | [`review.md`](./review.md) — 0 critical, 2 warning, 3 minor sur `origin/preview...cb7b94b4f` |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Isoler les tests du réseau et dédupliquer le SemVer | [`phase-1.md`](./phase-1.md) |
| 2   | Aligner la doc sur le comportement réel             | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                        | Verified                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `node -e "R.test(...)"` sur `/^\d+\.\d+\.\d+$/` | Regex sans flag `g` : `lastIndex` reste 0 sur appels répétés, donc partager l'objet entre `environment.ts` et le service est sans état partagé |
| `https://itunes.apple.com/lookup?id=6758464920` | Renvoie `1.3.0`, identique au `LATEST_IOS_VERSION` de prod : aucun des correctifs de ce plan ne peut changer le payload servi |

## Decisions

| Decision                                                                                  | Why                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutraliser l'appel réseau côté spec (`IOS_STORE_URL` sans identifiant) plutôt que de conditionner la pré-chauffe sur `NODE_ENV` dans le service | Garder le service ignorant de l'environnement de test ; le court-circuit sans identifiant existe déjà et est couvert par un test, donc aucun code de production nouveau |
| Laisser `whats-new/domain/whats-new-payload.ts` garder sa propre regex SemVer | Sa couche `domain/` n'a pas le droit d'importer `@common/utils`, et sa regex sert `compareSemver` (tri de releases), pas `isVersionAtMost` : mutualiser coupleraient deux features sans rapport pour faire tomber un compteur d'occurrences |
