---
status: done
---

# Instruction: Connexions et révocation, iOS

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Features/Account/
    │   │   ├── Connections/                                       ✅ écran Connexions
    │   │   │   ├── ConnectionsView.swift                          ✅ liste et état vide
    │   │   │   ├── ConnectionDetailView.swift                     ✅ journal d'une connexion
    │   │   │   └── ConnectionsStore.swift                         ✅ @Observable, chargement et révocation
    │   │   └── AccountView.swift                                  ✏️ entrée vers Connexions
    │   └── Domain/Services/
    │       └── MCPConnectionsService.swift                        ✅ appels liste, journal, révocation
    └── PulpeTests/Features/Account/
        └── ConnectionsStoreTests.swift                            ✅ chargement, révocation, état vide
```

## User Journey

```mermaid
flowchart TD
  A[L'utilisateur ouvre Compte] --> B[Il touche Connexions]
  B --> C{Des agents branchés ?}
  C -->|Non| D[État vide expliquant à quoi sert la page]
  C -->|Oui| E[Liste : nom, mode accordé, date]
  E --> F[Toucher une connexion pour voir ses gestes]
  F --> G[Couper l'accès]
  G --> H[Confirmation destructive]
  H --> I[Connexion retirée de la liste]
  I --> J[Le prochain appel de l'agent échoue]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Autoriser un agent depuis le web sur le compte de test => la connexion est active: 5: system
    Ouvrir l'app iOS sur ce compte => la session est valide: 5: browser
  section Happy path
    Ouvrir Compte puis Connexions => la connexion apparaît avec son mode et sa date: 5: browser
    Toucher la connexion => ses derniers gestes sont décrits en langage lisible: 5: browser
    Couper l'accès et confirmer => la connexion disparaît de la liste: 5: browser
    Refaire appeler un outil par l'agent => l'appel échoue: 5: api
  section Edge case - aucune connexion
    Ouvrir Connexions sans agent branché => lire l'écran => un état vide explicite s'affiche: 1: browser
  section Edge case - hors ligne
    Couper le réseau => ouvrir Connexions => un message d'erreur exploitable s'affiche sans écran vide trompeur: 1: browser
  section Edge case - montants masqués
    Activer le masquage des montants => ouvrir le journal => aucune valeur chiffrée n'apparaît ni à l'écran ni en accessibilité: 1: browser
  section Teardown
    Restaurer le compte de test => état initial rétabli: 5: system
```

## Wireframe

```txt
┌────────────────────────────┐
│ ‹ Compte                   │
│                            │
│  Connexions                │
│                            │
│  ┌──────────────────────┐  │
│  │ ChatGPT           ›  │  │
│  │ Lecture et écriture  │  │
│  │ depuis le 23 août    │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ Claude            ›  │  │
│  │ Lecture seule        │  │
│  │ depuis le 21 août    │  │
│  └──────────────────────┘  │
│                            │
│  Les assistants que tu as  │
│  autorisés à accéder à     │
│  ton budget.               │
└────────────────────────────┘

┌────────────────────────────┐
│ ‹ Connexions               │
│                            │
│  ChatGPT                   │
│  Lecture et écriture       │
│  Autorisé le 23 août 2026  │
│                            │
│  DERNIÈRES ACTIONS         │
│  ┌──────────────────────┐  │
│  │ Dépense ajoutée      │  │
│  │ aujourd'hui 14:02    │  │
│  ├──────────────────────┤  │
│  │ Prévision pointée    │  │
│  │ hier 09:41           │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │    Couper l'accès    │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

## Tasks to do

### `1)` Brancher le service réseau

> Les trois appels de la phase 3, côté iOS.

1. Ajouter le service appelant la liste des connexions, le journal d'une connexion et la révocation.
2. Décoder les dates ISO nues en `String`, jamais en `Date`, conformément à l'usage du projet.
3. Laisser les erreurs remonter telles quelles jusqu'au store, sans les avaler.

### `2)` Construire le store

> Un `@Observable` qui charge, révoque et distingue vide de cassé.

1. Exposer l'état de chargement, l'état vide et l'état d'erreur séparément.
2. Sur révocation, recharger la liste plutôt que de la modifier localement.
3. Traiter l'échec de révocation comme une erreur affichée, pas comme un succès silencieux.

### `3)` Construire les écrans

> Deux vues, conformes au système de design du projet.

1. Écrire la liste avec son état vide et son texte d'explication.
2. Écrire le détail avec les derniers gestes et le bouton destructif.
3. Utiliser les extensions et formateurs partagés, le fond Pulpe et le masquage du fond de liste.
4. Ajouter l'entrée Connexions dans l'écran Compte.

### `4)` Couvrir par des tests

> Le comportement, pas le rendu.

1. Tester le chargement, l'état vide et l'état d'erreur.
2. Tester que la révocation déclenche un rechargement.
3. Lancer la suite sur le simulateur dédié aux tests, jamais sur le simulateur interactif.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Les connexions autorisées depuis le web apparaissent dans l'app iOS avec le bon mode                        |
| 2    | Une erreur réseau produit un message exploitable, jamais un écran vide qui ressemble à une absence de données |
| 3    | Couper l'accès demande une confirmation destructive et la connexion disparaît après succès                  |
| 3    | Avec le masquage des montants actif, aucune valeur chiffrée n'apparaît à l'écran ni en accessibilité         |
| 4    | `xcodebuild test` passe sur le simulateur dédié                                                             |
