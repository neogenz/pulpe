---
objective: "Une personne utilisant Pulpe sur iOS peut envoyer un avis général et des précisions facultatives en moins d'une minute, depuis le menu Compte ou une unique sollicitation après un usage régulier."
status: blocked
---

# Plan: Recueillir un avis iOS rapide et actionnable

## Overview

| Field      | Value                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Recueillir à la fois la satisfaction générale et les points à améliorer, sans interrompre le parcours financier.                                            |
| **Source** | [Linear PUL-357](https://linear.app/pulpe/issue/PUL-357/permettre-de-partager-un-avis-rapidement-depuis-lapp-ios) · [review changes requested](./review.md) |

## Phases

| #   | Phase                                               | File                         |
| --- | --------------------------------------------------- | ---------------------------- |
| 1   | Enregistrer un retour first-party en écriture seule | [`phase-1.md`](./phase-1.md) |
| 2   | Offrir le formulaire rapide depuis le menu Compte   | [`phase-2.md`](./phase-2.md) |
| 3   | Solliciter une seule fois après un usage régulier   | [`phase-3.md`](./phase-3.md) |
| 4   | Aligner les déclarations de confidentialité         | [`phase-4.md`](./phase-4.md) |
| 5   | Lever les écarts SwiftUI et design system           | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                                                                                                          | Verified                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple — ScenePhase.active](https://developer.apple.com/documentation/swiftui/scenephase/active)                                | SwiftUI expose l'état actif de la scène pour enregistrer un vrai retour au premier plan sans dépendre d'un numéro de version.                           |
| [Apple — UserDefaults](https://developer.apple.com/documentation/foundation/userdefaults)                                       | `UserDefaults` convient à un petit état local persistant composé de dates et de booléens, injectable en test.                                           |
| [Apple — Ratings and reviews](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews)                | Le retour interne doit rester visuellement et sémantiquement distinct d'une demande de note App Store.                                                  |
| [Apple — App container migration](https://developer.apple.com/library/archive/technotes/tn2285/_index.html)                     | Une mise à jour remplace le bundle mais conserve le conteneur de données de l'app, donc l'état de sollicitation local.                                  |
| [Apple — App privacy details](https://developer.apple.com/app-store/app-privacy-details/)                                       | Un texte libre conservé et lié au compte doit être déclaré comme Other User Content ; les réponses App Store Connect restent à synchroniser séparément. |
| [Apple — Privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests) | Le manifeste doit employer les valeurs Apple pour le type collecté, le lien à l'identité, le suivi et la finalité.                                      |
| [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)                          | Les droits SQL et les policies RLS doivent être configurés ensemble et testés pour chaque opération exposée.                                            |

## Decisions

| Decision                                                                                                                   | Why                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stocker les retours dans Supabase via un endpoint Pulpe, pas dans PostHog Surveys.                                         | Le formulaire reste disponible après désactivation du partage de diagnostics et le commentaire libre ne devient pas une propriété analytics.     |
| Exposer uniquement `POST /v1/feedback`, avec `INSERT` comme seul privilège du rôle `authenticated`.                        | L'app n'a aucun besoin de lecture, modification ou suppression ; l'absence de ces capacités réduit directement la surface d'accès.               |
| Persister l'éligibilité dans `UserDefaults` sous une clé propre à l'identifiant du compte.                                 | L'état survit aux relances et mises à jour sans mélanger deux comptes utilisés sur le même appareil ni ajouter une table serveur de tracking.    |
| Réutiliser une seule sheet SwiftUI depuis Compte et depuis l'accueil.                                                      | Les deux portes d'entrée gardent exactement la même validation, la même microcopy, la même accessibilité et le même comportement en cas d'échec. |
| Déclarer le commentaire comme Other User Content, lié au compte, non utilisé pour le suivi et destiné à l'analyse produit. | Le texte est conservé avec `user_id` pour comprendre les retours ; il ne remplit pas toutes les conditions Apple de divulgation facultative.     |
