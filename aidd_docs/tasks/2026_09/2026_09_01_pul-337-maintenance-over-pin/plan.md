---
objective: "Une indisponibilité serveur typée MAINTENANCE conduit toujours l'utilisateur iOS vers l'écran « Maintenance en cours », jamais vers un message de code PIN incorrect, et le réessai le ramène au bon écran d'authentification."
status: implemented
---

# Plan: PUL-337 — Afficher la maintenance au lieu d'invalider le PIN sur iOS

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre le mode maintenance prioritaire sur les écrans de déverrouillage iOS, à la source commune |
| **Source** | Ticket Linear [PUL-337](https://linear.app/pulpe/issue/PUL-337)                                  |

## Phases

| #   | Phase                                            | File                         |
| --- | ------------------------------------------------ | ---------------------------- |
| 1   | Prioriser la maintenance sur le déverrouillage   | [`phase-1.md`](./phase-1.md) |

## Resources

| Source                                                                | Verified                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ios/Pulpe/App/Core/AppFlowReducer.swift`                              | `.maintenanceChecked(true)` n'est traité que par `reduceInitializing` ; aucune branche `.locked` ni `.authenticated`.       |
| `ios/Pulpe/App/AppState+FlowState.swift`                               | Un événement non réduit tombe dans `eventQueue` puis dans `handleForegroundLifecycleEvent`, qui ne traite que `.enteredBackground` — l'événement est avalé sans trace. |
| `ios/Pulpe/Features/Auth/Pin/PinCryptoProtocols.swift:92-98`           | `pinValidationMessage` ne distingue que `.rateLimited` et `.networkError` ; `.maintenance` tombe dans `default`.            |
| `ios/Pulpe/App/AppState+SessionReset.swift:20-40`                      | `handleEnterForeground()` passe de `.lockRequired` à `authState = .needsPinEntry` sans contrôle de maintenance.             |
| `ios/Pulpe/App/RootViewModifiers.swift:146-148`                        | Relance déjà `retryStartup()` sur le front `isInMaintenance` vrai→faux : CA3 tenait avant ce plan, la tâche 4 initiale reposait sur une prémisse fausse. |
| `ios/Pulpe/App/BiometricManager.swift`                                 | `isTransportFailure` ne reconnaît que `.networkError` ; le 503 `MAINTENANCE` était lu comme un verdict et déclenchait `handleStaleKey()`. |
| `ios/Pulpe/Core/Config/AppConfiguration.swift:98`                      | `requestTimeout = 10 s` borne le contrôle de maintenance ajouté sur le chemin de reprise.                                   |
| `ios/Pulpe/App/AppStateDependencies.swift:46`                          | `maintenanceChecking` est la seam injectée à utiliser ; `MaintenanceService.shared` ne doit pas être appelé en dur.          |

## Decisions

| Decision                                                                                                      | Why                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Une seule branche pour tous les états d'authentification et de déverrouillage, pas une garde par état           | La règle métier du ticket rend la maintenance prioritaire sur ces écrans. Corriger uniquement `.locked` laisserait `.securitySetup` et `.recovering` avaler le même événement. |
| `.authenticated` reste hors périmètre                                                                          | Le ticket vise les écrans d'authentification et de déverrouillage. Sortir un utilisateur en pleine session sur un 503 de rafraîchissement serait un changement de comportement non demandé. |
| Le contrôle de maintenance de la reprise à chaud échoue **ouvert** (erreur ⇒ écran PIN)                         | Le déverrouillage PIN exige déjà le réseau. Échouer fermé transformerait un 500 transitoire en écran de maintenance bloquant ; le 503 réel reste rattrapé par le routage global. |
| Un 503 `MAINTENANCE` n'est pas un verdict sur la clé biométrique                                               | `isTransportFailure` ne reconnaissait que `.networkError`, si bien que chaque fenêtre de maintenance désinscrivait Face ID et effaçait la clé client. Même raisonnement que PUL-280 pour les coupures réseau. |
| Le sondage précède la tentative de déverrouillage                                                               | Sonder après coup laissait la cohorte Face ID entrer dans l'app sur des écrans vides, et provoquait une invite Face ID et un 503 inutiles.                                       |
| Budget propre de 3 s pour le sondage                                                                            | `requestTimeout` est partagé avec le démarrage, et le sondage s'ajoute au plafond de 10 s posé par PUL-279 contre un bouclier de confidentialité figé.                          |
