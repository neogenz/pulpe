# Validation iOS sécurité — PUL-39 / PUL-58

## Objectif
Documenter la validation iOS des flows sécurité (PIN + biométrie + relock background), avec critères mesurables et stratégie anti-régression.

## Périmètre
- Tickets: `PUL-39`, `PUL-58`
- Scénarios `docs/SCENARIOS.md`: `1.3`, `1.6`, `1.7`, `1.8`, `8.3`, `8.4`, `10.1`
- Plateforme de référence: `iPhone 17 Pro Max / iOS 26.2`

## Critères mesurables
| Flux | Critère attendu | Mesure |
|---|---|---|
| 1.3 Login email -> PIN/biométrie -> dashboard | Après validation PIN/Face ID, accès dashboard + données déchiffrées | Transition vers `authenticated` en <= 3s hors latence réseau inhabituelle |
| 1.3 (offline) | Si `validate-key` indisponible, refus d’accès + message clair | Message réseau explicite, pas de passage `authenticated` |
| 1.6 Mot de passe oublié | Flow reset terminé, session temporaire nettoyée, reconnect obligatoire | Retour écran login + état auth nettoyé |
| 1.7 PIN oublié | Recovery key -> nouveau PIN -> nouvelle recovery key affichée | Ancienne recovery key invalide côté backend; nouvelle clé affichée une fois |
| 1.8 Logout | Nettoyage session/token/clientKey mémoire | `authState = unauthenticated` + suppression key cache |
| 8.3 Changement mot de passe | Vérification mot de passe actuel avant update | Erreur explicite si mot de passe actuel incorrect |
| 8.4 Régénération recovery key | Vérification mot de passe + nouvelle clé générée | Nouvelle clé affichée, ancien flux invalidé backend |
| 10.1 Persistance session + relock | Re-lock après `>= 5 min` en background | Retour foreground => `needsPinEntry` si seuil atteint |

## Statut par scénario (iOS)
| Scénario | Statut | Validation |
|---|---|---|
| 1.3 Se connecter email | Implémenté | Auth Supabase + PIN/biométrie + accès dashboard; comportement offline explicite (pas d'accès) |
| 1.6 Mot de passe oublié | Implémenté (iOS scope) | Reset mot de passe + nettoyage état sensible + reconnexion requise |
| 1.7 PIN oublié | Implémenté (iOS scope) | Recovery key -> nouveau PIN -> nouvelle recovery key affichée |
| 1.8 Logout | Implémenté | Nettoyage session + clientKey mémoire + routes protégées non accessibles |
| 8.3 Changer mot de passe | Implémenté | Vérification mot de passe courant, message d'erreur clair si invalide |
| 8.4 Régénérer clé secours | Implémenté | Vérification mot de passe + nouvelle clé générée et affichée |
| 10.1 Persistance session | Implémenté | Reprise session valide + relock strict à `>= 5 min` après background |

## Mapping implémentation
| Sujet | Statut | Référence code |
|---|---|---|
| PBKDF2 CommonCrypto | Implémenté | `ios/Pulpe/Core/Encryption/CryptoService.swift` |
| Header `X-Client-Key` requêtes authentifiées | Implémenté + testé | `ios/Pulpe/Core/Network/APIClient.swift`, `ios/PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift` |
| Re-lock `>= 5 min` | Implémenté + testé | `ios/Pulpe/App/AppState.swift`, `ios/PulpeTests/App/AppStateBackgroundLockTests.swift` |
| Privacy shield task switcher (déclaratif) | Implémenté | `ios/Pulpe/App/PulpeApp.swift` |
| PIN fallback après échec biométrie | Conservé (choix UX) | `ios/Pulpe/Features/Auth/Pin/PinEntryView.swift` |

## Décision produit documentée
- Seuil relock: `>= 300s` (et non `> 300s`) pour respecter strictement la règle métier "5 minutes" sans seconde implicite supplémentaire.

## Stratégie de tests
1. Unitaire prioritaire pour logique sécurité critique (stable, non flaky).
2. UI tests sécurité limités aux cas robustes (pas de simulation temporelle fragile).
3. Vérification manuelle device physique recommandée pour timing de snapshot task-switcher (risque de flash selon device/OS).

## Exécution de référence
```bash
xcodebuild test \
  -project ios/Pulpe.xcodeproj \
  -scheme PulpeTests \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2'
```
