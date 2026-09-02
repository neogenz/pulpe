---
objective: "Après installation du hotfix, le tip expliquant le pointage par le rond redevient éligible même si son ancienne version était invalidée, sans réinitialiser les autres aides, puis suit ses règles de masquage existantes."
status: implemented
---

# Plan: Hotfix iOS — réafficher l’aide de pointage

## Overview

| Field      | Value                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **Goal**   | Donner une nouvelle identité TipKit à l’aide de pointage remaniée en 1.4.3, sans changer son interface |
| **Source** | Demande texte de Maxime (2026-09-02) : montrer l’aide aux utilisateurs ayant mis l’app à jour          |

## Phases

| #   | Phase                                                | File                         |
| --- | ---------------------------------------------------- | ---------------------------- |
| 1   | Versionner l’identité persistante du tip de pointage | [`phase-1.md`](./phase-1.md) |

## Resources

| Source                                                                      | Verified                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| https://developer.apple.com/documentation/tipkit/tip/id                     | Le nom du type conforme à `Tip` est l’identifiant par défaut ; un `id` personnalisé crée une identité distincte.    |
| https://developer.apple.com/documentation/tipkit/tips                       | `Tips.configure` charge l’état persistant des tips ; `resetDatastore` remettrait tout le catalogue à zéro.          |
| https://developer.apple.com/documentation/tipkit/tip/maxdisplaycount        | `MaxDisplayCount(3)` invalide automatiquement le tip après trois affichages.                                        |
| https://developer.apple.com/documentation/tipkit/tip/reseteligibility%28%29 | La rééligibilité individuelle existe, mais seulement sur les OS récents ; Pulpe doit rester compatible avec iOS 18. |

## Decisions

| Decision                                                                                    | Why                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Déclarer un `id` explicite et versionné sur `CheckingTip`                                   | Le type `CheckingTip` existe depuis avril : son identifiant par défaut porte déjà les fermetures, actions et trois affichages de l’ancienne aide.                |
| Ne jamais appeler `Tips.resetDatastore()` et ne pas ajouter de migration `UserDefaults`     | Le reset global réafficherait toutes les aides ; un marqueur ajouté maintenant ne peut pas reconstituer rétroactivement ce qui a été vu en 1.4.3.                |
| Accepter qu’une partie des utilisateurs ayant déjà vu le texte de la 1.4.3 puisse le revoir | TipKit expose l’éligibilité et la raison d’invalidation, mais ni la version du contenu affiché ni sa date ; l’ancien et le nouveau texte partagent le même `id`. |
| Conserver la copie, l’ancrage, les règles et `MaxDisplayCount(3)`                           | Le défaut porte sur la persistance entre versions, pas sur l’interface validée lors de la refonte.                                                               |
