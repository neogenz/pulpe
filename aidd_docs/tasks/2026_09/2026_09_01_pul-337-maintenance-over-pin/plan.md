---
objective: "Une indisponibilité serveur typée MAINTENANCE conduit toujours l'utilisateur iOS vers l'écran « Maintenance en cours », jamais vers un message de code PIN incorrect, et le réessai le ramène au bon écran d'authentification."
status: in-progress
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
| `ios/Pulpe/App/AppState+Bootstrap.swift:128-131`                       | `applyStartupResult(.maintenance)` pose `authState = .loading` ; sortir de maintenance sans relancer la résolution laisse la route sur `.loading`. |
| `ios/Pulpe/Features/Maintenance/MaintenanceView.swift:52-67`           | `checkAndRetry()` appelle `setMaintenanceMode(false)` et ne relance jamais `retryStartup()`.                                |
| `ios/Pulpe/Core/Config/AppConfiguration.swift:98`                      | `requestTimeout = 10 s` borne le contrôle de maintenance ajouté sur le chemin de reprise.                                   |
| `ios/Pulpe/App/AppStateDependencies.swift:46`                          | `maintenanceChecking` est la seam injectée à utiliser ; `MaintenanceService.shared` ne doit pas être appelé en dur.          |

## Decisions

| Decision                                                                                                      | Why                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Une seule branche pour tous les états d'authentification et de déverrouillage, pas une garde par état           | La règle métier du ticket rend la maintenance prioritaire sur ces écrans. Corriger uniquement `.locked` laisserait `.securitySetup` et `.recovering` avaler le même événement. |
| `.authenticated` reste hors périmètre                                                                          | Le ticket vise les écrans d'authentification et de déverrouillage. Sortir un utilisateur en pleine session sur un 503 de rafraîchissement serait un changement de comportement non demandé. |
| Le contrôle de maintenance de la reprise à chaud échoue **ouvert** (erreur ⇒ écran PIN)                         | Le déverrouillage PIN exige déjà le réseau. Échouer fermé transformerait un 500 transitoire en écran de maintenance bloquant ; le 503 réel reste rattrapé par le routage global. |
| `MaintenanceView.checkAndRetry()` délègue à `retryStartup()` au lieu de refaire son propre `checkStatus()`      | `checkAuthState()` recontrôle déjà la maintenance et repose `authState` ; garder les deux chemins laisse la route bloquée sur `.loading`.                                       |
