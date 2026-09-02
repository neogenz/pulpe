---
status: implemented
---

# Instruction: Prioriser la maintenance sur le déverrouillage iOS

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── App/
    │   │   ├── Core/
    │   │   │   └── AppFlowReducer.swift                    ✏️ `.maintenanceChecked(true)` devient une transition globale
    │   │   ├── AppState+Maintenance.swift                  ✏️ helper de contrôle « fail-open » pour la reprise à chaud
    │   │   └── AppState+SessionReset.swift                 ✏️ la reprise à chaud teste la maintenance avant de router vers le PIN
    │   │   ├── Auth/SessionLifecycleCoordinator.swift      ✏️ `backgroundLockApplies` devient interne
    │   │   └── BiometricManager.swift                      ✏️ `.maintenance` n'est plus un verdict sur la clé
    │   ├── Core/Config/AppConfiguration.swift              ✏️ `maintenanceProbeTimeout`
    │   ├── Features/
    │   │   └── Auth/Pin/PinCryptoProtocols.swift           ✏️ `.maintenance` sort du `default` de `pinValidationMessage`
    └── PulpeTests/
        ├── App/
        │   ├── Core/AppFlowReducerTests.swift              ✏️ maintenance depuis `.locked` et les autres états
        │   ├── BiometricDefaultValidateKeyTests.swift      ✏️ le 503 de maintenance préserve l'inscription
        │   └── AppStateMaintenanceForegroundTests.swift    ✅ reprise à chaud sous maintenance
        └── Features/Auth/PinMaintenanceMessageTests.swift  ✅ mapping du message PIN
```

## User Journey

```mermaid
flowchart TD
  A[Session authentifiée, app en arrière-plan] --> B{Délai de verrouillage dépassé ?}
  B -- Non --> C[Retour direct dans l'app]
  B -- Oui --> D[Contrôle du mode maintenance]
  D -- Maintenance --> E[Écran « Maintenance en cours »]
  D -- Erreur ou service disponible --> F[Écran de saisie du code PIN]
  F --> G{Réponse de la validation}
  G -- 503 MAINTENANCE --> E
  G -- Code faux --> H[« Ce code ne semble pas correct »]
  G -- Code correct --> C
  E --> I[Réessayer] --> J[Résolution de démarrage relancée]
  J --> K[Écran d'authentification adapté]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Injecter un AppState dont maintenanceChecking est contrôlé => état de départ déterministe: 5: system
  section Happy path
    Réduire maintenanceChecked(true) depuis l'état verrouillé => l'état devient maintenance: 5: system
    Reprendre au premier plan après le délai de verrouillage sous maintenance => isInMaintenance vaut vrai et authState ne passe pas à needsPinEntry: 5: system
    Mapper APIError.maintenance en message de validation PIN => le message n'est jamais « Ce code ne semble pas correct »: 5: system
  section Edge case - code PIN réellement faux
    Une erreur PIN non typée maintenance => demander le message de validation => le message d'erreur PIN existant est conservé: 1: system
  section Edge case - contrôle de maintenance en échec
    maintenanceChecking lève une erreur => reprendre au premier plan => l'app route vers la saisie du code PIN comme aujourd'hui: 1: system
  section Edge case - sortie de maintenance
    Le service ne répond plus maintenance => appuyer sur Réessayer => la résolution de démarrage est relancée et la route quitte l'écran de chargement: 1: system
```

## Tasks to do

### `1)` Rendre la maintenance prioritaire sur les écrans de déverrouillage

> Un `503 MAINTENANCE` reçu pendant l'authentification ou le déverrouillage doit basculer l'app en maintenance.

1. Dans `AppFlowReducer`, faire de `.maintenanceChecked(true)` une transition vers `.maintenance` depuis `.initializing`, `.unauthenticated`, `.securitySetup`, `.locked` et `.recovering`, en un seul point plutôt qu'une garde recopiée dans chaque `reduce*`.
2. Laisser `.authenticated` inchangé : hors périmètre du ticket, un 503 en pleine session ne doit pas éjecter l'utilisateur.
3. Laisser `.maintenanceChecked(false)` aux états concernés : `reduceMaintenance` garde son retour vers `.initializing`.
4. Ne toucher à aucun autre événement.

### `2)` Ne jamais présenter la maintenance comme une erreur de saisie

> Le message affiché sous l'écran PIN doit dire la vérité.

1. Dans `APIError.pinValidationMessage`, ajouter un `case .maintenance` renvoyant un message de maintenance passé par `AppLocale.string`, aligné sur le vocabulaire de `MaintenanceView`.
2. Conserver `.rateLimited`, `.networkError` et le `default` existants inchangés.

### `3)` Contrôler la maintenance avant de demander le code PIN

> La reprise à chaud ne doit pas ouvrir l'écran PIN quand le serveur est en maintenance.

1. Dans `AppState+Maintenance.swift`, ajouter un helper qui appelle `maintenanceChecking()` et renvoie `false` sur toute erreur — surtout pas la sémantique « fail-closed » de `checkMaintenanceStatus()`.
2. Dans `AppState.handleEnterForeground()`, sur `.lockRequired` et `.staleKeyLockRequired`, appeler ce helper avant de poser `authState = .needsPinEntry`.
3. Quand il renvoie `true`, envoyer `.maintenanceChecked(isInMaintenance: true)` et ne pas poser `.needsPinEntry`.
4. Ne pas ajouter ce contrôle sur `.noLockNeeded` ni `.biometricUnlockSuccess` : aucun écran PIN n'y est affiché.

### `4)` Ne pas lire une maintenance comme un verdict sur la clé biométrique

> Une fenêtre de maintenance ne doit pas désinscrire Face ID.

Cette tâche remplace celle qui était prévue ici. La tâche initiale supposait qu'une sortie de maintenance laissait l'app sur un écran de chargement : c'est faux, `RootViewModifiers.swift:146-148` relance déjà `retryStartup()` sur le front `isInMaintenance` vrai→faux, et CA3 tenait déjà avant ce plan.

Le défaut réel, découvert en revue : `BiometricManager.isTransportFailure` ne reconnaît que `.networkError`, donc le 503 `MAINTENANCE` renvoyé par `defaultValidateKey` tombe dans le `catch` « verdict serveur définitif » → clé jugée périmée → `SessionLifecycleCoordinator.swift:105` → `handleStaleKey()` → `clientKeyManager.clearAll()` et `isEnabled = false`. Chaque fenêtre de maintenance désinscrivait Face ID et effaçait la clé client de tous les utilisateurs biométriques, le dommage que PUL-280 avait écarté pour les coupures réseau.

1. Ajouter `.maintenance` à côté de `.networkError` dans `isTransportFailure` : le serveur est joignable mais volontairement indisponible, il n'a jamais examiné la clé.
2. Vérifier que le second appelant de `handleStaleKey` (`BiometricManager.swift:181`) passe par la même source et n'a donc pas besoin de garde propre.
3. Sonder la maintenance **avant** la tentative de déverrouillage plutôt qu'après, en réutilisant `backgroundLockApplies(authState:)` : sous maintenance, aucune invite Face ID, aucun 503 vers `validateKey`, aucune entrée dans l'app.
4. Borner le sondage par une constante propre (`maintenanceProbeTimeout`), plus courte que `requestTimeout` qui est partagée avec le démarrage : il s'ajoute au plafond de 10 s posé par PUL-279.
5. Placer `guard !Task.isCancelled` après le sondage, sur les deux branches : `AppRuntimeCoordinator` annule le run à chaque réactivation, et un run abandonné ne doit pas écrire d'état derrière le run vivant.

### `5)` Couvrir les régressions par des tests

> Chaque défaut corrigé doit être tenu par un test qui échoue sans le correctif.

1. Étendre `AppFlowReducerTests` : `.maintenanceChecked(true)` depuis `.locked`, `.unauthenticated`, `.securitySetup` et `.recovering` donne `.maintenance` ; depuis `.authenticated` il reste sans effet ; `.maintenanceChecked(false)` depuis `.maintenance` donne toujours `.initializing`.
2. Créer un test de reprise à chaud : `maintenanceChecking` renvoyant `true` ⇒ `isInMaintenance` vrai et `authState != .needsPinEntry` ; `maintenanceChecking` levant une erreur ⇒ `authState == .needsPinEntry`.
3. Créer un test de message : `APIError.maintenance.pinValidationMessage` diffère du message d'un code faux, et une erreur non typée maintenance garde le message existant.
4. Suivre les conventions du projet : Swift Testing, `nonisolated(unsafe)` pour les compteurs de test, locale épinglée pour toute assertion sur un texte.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Un `.maintenanceChecked(true)` reçu alors que l'app est verrouillée bascule sur l'écran de maintenance ; la sortie de maintenance reste possible.                |
| 2    | Un `503 MAINTENANCE` pendant la validation du PIN n'affiche jamais « Ce code ne semble pas correct » ; un code réellement faux affiche toujours ce message.       |
| 3    | Avec le serveur en maintenance, un retour au premier plan après le délai de verrouillage affiche la maintenance sans demander le code PIN ; un contrôle en échec continue d'afficher l'écran PIN. |
| 4    | Une fenêtre de maintenance laisse Face ID inscrit et la clé client intacte ; sous maintenance aucune invite Face ID n'apparaît, et le sondage reste borné bien en deçà du plafond de PUL-279. |
| 5    | La suite iOS s'exécute et chaque test ajouté échoue si l'on annule le correctif qu'il couvre.                                                                    |
