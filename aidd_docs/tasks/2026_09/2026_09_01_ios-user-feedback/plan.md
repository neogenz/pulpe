---
objective: "Une personne utilisant Pulpe sur iOS peut envoyer un avis général et des précisions facultatives en moins d'une minute, depuis le menu Compte ou une unique sollicitation après un usage régulier."
status: implemented
---

# Plan: Recueillir un avis iOS rapide et actionnable

## Overview

| Field      | Value                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Recueillir à la fois la satisfaction générale et les points à améliorer, sans interrompre le parcours financier.  |
| **Source** | [Linear PUL-357](https://linear.app/pulpe/issue/PUL-357/permettre-de-partager-un-avis-rapidement-depuis-lapp-ios) |

## Phases

| #   | Phase                                               | File                         |
| --- | --------------------------------------------------- | ---------------------------- |
| 1   | Enregistrer un retour first-party en écriture seule | [`phase-1.md`](./phase-1.md) |
| 2   | Offrir le formulaire rapide depuis le menu Compte   | [`phase-2.md`](./phase-2.md) |
| 3   | Solliciter une seule fois après un usage régulier   | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                                                           | Verified                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Apple — ScenePhase.active](https://developer.apple.com/documentation/swiftui/scenephase/active)                 | SwiftUI expose l'état actif de la scène pour enregistrer un vrai retour au premier plan sans dépendre d'un numéro de version. |
| [Apple — UserDefaults](https://developer.apple.com/documentation/foundation/userdefaults)                        | `UserDefaults` convient à un petit état local persistant composé de dates et de booléens, injectable en test.                 |
| [Apple — Ratings and reviews](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews) | Le retour interne doit rester visuellement et sémantiquement distinct d'une demande de note App Store.                        |
| [Apple — App container migration](https://developer.apple.com/library/archive/technotes/tn2285/_index.html)      | Une mise à jour remplace le bundle mais conserve le conteneur de données de l'app, donc l'état de sollicitation local.        |
| [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)           | Les droits SQL et les policies RLS doivent être configurés ensemble et testés pour chaque opération exposée.                  |

## Decisions

| Decision                                                                                            | Why                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stocker les retours dans Supabase via un endpoint Pulpe, pas dans PostHog Surveys.                  | Le formulaire reste disponible après désactivation du partage de diagnostics et le commentaire libre ne devient pas une propriété analytics.     |
| Exposer uniquement `POST /v1/feedback`, avec `INSERT` comme seul privilège du rôle `authenticated`. | L'app n'a aucun besoin de lecture, modification ou suppression ; l'absence de ces capacités réduit directement la surface d'accès.               |
| Persister l'éligibilité dans `UserDefaults` sous une clé propre à l'identifiant du compte.          | L'état survit aux relances et mises à jour sans mélanger deux comptes utilisés sur le même appareil ni ajouter une table serveur de tracking.    |
| Réutiliser une seule sheet SwiftUI depuis Compte et depuis l'accueil.                               | Les deux portes d'entrée gardent exactement la même validation, la même microcopy, la même accessibilité et le même comportement en cas d'échec. |
