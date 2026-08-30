---
objective: "Le refactor de release est clos, ses défauts confirmés sont corrigés, et le build TestFlight iOS 1.4.3 (12) est promu puis soumis sans reconstruire un binaire différent."
status: pending
---

# Plan: Fermer le refactor de release et publier le correctif iOS

## Overview

| Field      | Value                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Intégrer la clôture documentaire, fiabiliser PostHog et la preuve staging, puis publier exactement le build iOS testé.                               |
| **Source** | Demande utilisateur du 2026-08-30, PR #703/#705/#707, runs GitHub 33333743527 et 33333821051, App Store Connect 1.4.3 et dossier de captures fourni. |

## Phases

| #   | Phase                                                  | File                         |
| --- | ------------------------------------------------------ | ---------------------------- |
| 1   | Clore le refactor historique                           | [`phase-1.md`](./phase-1.md) |
| 2   | Fiabiliser PostHog et promouvoir le binaire TestFlight | [`phase-2.md`](./phase-2.md) |
| 3   | Tolérer uniquement le 404 staging transitoire          | [`phase-3.md`](./phase-3.md) |
| 4   | Soumettre exactement iOS 1.4.3 (12)                    | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                                                              | Verified                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| https://github.com/neogenz/pulpe/pull/703                                                                           | La clôture des phases 9-10 est encore ouverte, avec sa CI verte, et doit être remise sur le `main` courant avant fusion.               |
| https://github.com/neogenz/pulpe/actions/runs/33333743527/attempts/1                                                | La première preuve staging a quitté sa boucle sur un 404 transitoire; la relance inchangée a réussi.                                   |
| https://github.com/neogenz/pulpe/actions/runs/33333821051                                                           | Le SHA `1864e97d86a38c3fd3f6214b29880382a67a7537` a produit le build 1.4.3 (12), traité `VALID` et prouvé sur le canal interne.        |
| https://eu.posthog.com/api/schema/swagger-ui/                                                                       | La création d'une release exige `project` et `version`; `hash_id` est un identifiant de release optionnel, pas l'ID du projet PostHog. |
| https://github.com/PostHog/posthog/blob/1253d466e4bfaaab1ac1f6a76f214c4185579332/cli/src/api/releases.rs            | Le CLI officiel nomme la plateforme dans `project`, dérive un hash stable du couple projet/version et relit une release déjà créée.    |
| https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/remove-a-submission-from-review | Une version retirée passe en Developer Rejected et peut être corrigée puis soumise de nouveau.                                         |

## Decisions

| Decision                                                                                                                 | Why                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conserver le build 12 et ne pas fabriquer un build 13 pour des changements de workflow.                                  | Le binaire correctif exact est déjà testé, uploadé, `VALID` et lié à une preuve immuable; reconstruire créerait un autre artefact à revalider.              |
| Fusionner d'abord #703, puis porter les correctifs dans une seule PR de hardening avec des commits séparément testables. | La PR documentaire clôt l'historique; les corrections de process restent lisibles sans mélanger leurs preuves avec cette clôture.                           |
| Implémenter le même contrat PostHog dans les deux appelants, sans nouvelle dépendance ni helper partagé.                 | La distribution checkout le SHA historique du binaire; un helper ajouté au `main` courant n'y serait pas présent. Les tests verrouillent le contrat commun. |
| Garder PostHog non bloquant après la preuve Apple, mais rendre son résultat vérifiable.                                  | Une panne analytics ne doit pas invalider un binaire Apple déjà prouvé; elle ne doit plus être masquée par un simple `echo`.                                |
| Autoriser internal → release seulement par la preuve exacte du binaire déjà uploadé.                                     | Cela promeut le binaire TestFlight réellement testé sans ouvrir un bypass générique depuis `main` ni déplacer `production`.                                 |
| Garder le « What's New » 1.4.3 inchangé.                                                                                 | Le correctif est purement iOS et le texte appartient à la version, pas au numéro de build.                                                                  |
