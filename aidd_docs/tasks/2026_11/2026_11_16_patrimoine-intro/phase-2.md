---
status: done
---

# Instruction: iOS : feuille d'explication

## Architecture projection

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Features/
    │   │   └── NetWorth/
    │   │       ├── NetWorthView.swift ✏️
    │   │       └── Intro/
    │   │           ├── NetWorthIntroGate.swift ✅
    │   │           ├── NetWorthIntroContent.swift ✅
    │   │           ├── NetWorthIntroSheet.swift ✅
    │   │           └── NetWorthIntroScene.swift ✅
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── NetWorth/
                ├── NetWorthIntroGateTests.swift ✅
                └── NetWorthIntroContentTests.swift ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Supabase local lancé (`cd backend-nest && supabase start`, depuis le dépôt principal si un autre worktree l'utilise déjà) et backend `pnpm dev:backend` sur :3000 ; compte du seed, dont le patrimoine est vide (`seed.sql` ne crée aucun avoir) ; `xcodegen generate --use-cache` ; tests sur le simulateur dédié « Pulpe Tests » (`xcrun simctl list devices | grep Pulpe`), jamais sur le simulateur interactif ; `defaults write` de `pulpe.feature_flags.net_worth` à `true` dans le domaine de l'app (PostHog n'est pas initialisé en local, la valeur tient) ; clé `hasSeenNetWorthIntro` absente | Onglet Patrimoine visible | system |
| Happy path | Ouvrir l'onglet Patrimoine | La feuille s'ouvre une fois les données chargées, étape 1 animée, `net_worth_intro_viewed` avec `source=auto` | system |
| Setup | Patrimoine rempli : à jouer après le scénario « patrimoine vide », qui se termine par l'ajout d'un compte via le formulaire, ce qui donne l'état rempli des scénarios suivants | Une ligne dans le patrimoine | system |
| Happy path | « Suivant » ×2 puis « Compris » sur un patrimoine rempli | La feuille se ferme, `completed` avec `action=close` ; rouvrir l'onglet ne la remontre pas | system |
| Edge case | Patrimoine vide, dernière étape | Le bouton dit « Ajouter mon premier compte » et ouvre `AssetFormSheet` après la fermeture de la feuille | system |
| Edge case | Glisser la feuille vers le bas à l'étape 2 | `skipped` avec `step=1`, la clé passe à vu | system |
| Edge case | Toucher « ? » | La feuille s'ouvre à l'étape 1, `source=help` | system |
| Edge case | Reduce Motion actif | Fondus courts, aucun déplacement ni défilement de compteur | system |
| Edge case | Chargement en erreur | La feuille ne s'ouvre pas | system |
| Edge case | Taille de texte AX3 (Dynamic Type) | Le texte passe à la ligne, la feuille défile, le bouton principal reste atteignable | system |
| Edge case | VoiceOver | La scène est lue comme une phrase par étape ; « Plus tard », titre, texte et bouton sont atteignables dans cet ordre | system |
| Edge case | Devise EUR | Les montants d'exemple suivent la devise de l'utilisateur | system |
| Teardown | Effacer `hasSeenNetWorthIntro` et supprimer le compte ajouté | État de départ | system |

## Wireframe

```txt
┌─────────────────────────────────────┐
│ (1) Mon patrimoine         [?] [+]* │
├─────────────────────────────────────┤
│        page actuelle inchangée       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ (2)                       Plus tard │
├─────────────────────────────────────┤
│ (3) Scène animée                     │
│  ┌───────────────────────────────┐  │
│  │ Compte courant      3 200     │  │
│  │ Épargne            12 000     │  │
│  │ Placements          8 000     │  │
│  │ Voiture             9 000     │  │
│  │ ─────────────────────────     │  │
│  │ Tout ce que j'ai   32 200     │  │
│  └───────────────────────────────┘  │
│ (4) Titre de l'étape                 │
│     Texte court, 2 lignes max        │
│ (5)          ● ○ ○                   │
│ (6) [        Suivant          ]      │
└─────────────────────────────────────┘
```

1. En-tête de la page : bouton « ? » ajouté avant « Ajouter », visible sur l'état vide et l'état rempli (pas en chargement ni en erreur). `*` : « Ajouter » reste masqué sur l'état vide, comme aujourd'hui.
2. Fermeture « Plus tard », masquée à la dernière étape.
3. Scène (carte marquée « Exemple ») : étape 1, quatre éléments éparpillés (Compte courant, Épargne, Placements, Voiture, chacun avec son icône) glissent et se rangent dans une seule carte « Tout ce que j'ai », le total monte jusqu'à 32 200 (défilement sur iOS et Android, fondu sur le web) ; étape 2, « Ce que j'ai 32 200 » et « Ce que je dois · Crédit −6 000 », la dette grignote la barre en ambre, puis un bloc vert foncé « Fortune nette 26 200 » (libellé du héros iOS) apparaît en rebond ; étape 3, la ligne « Épargne · Mis à jour il y a 2 mois · 12 000 » reçoit un appui sur le crayon, passe à 12 500 et « Mis à jour aujourd'hui », la fortune nette passe à 26 700, puis une mention en pointillé « 500 mis de côté dans ton budget → je te propose +500 ici. » apparaît.
4. Titre et texte de l'étape (copie ci-dessous).
5. Indicateur d'étape, 3 points.
6. Bouton principal : « Suivant » aux étapes 1 et 2 ; à l'étape 3, « Ajouter mon premier compte » si le patrimoine est vide, sinon « Compris ».

Copie (FR, validée par `slopcheck-fr` : 0 BLOCK, 0 WARN ; à traduire en en, de, it) :
- Étape 1 : « Tout ton argent, au même endroit » / « Comptes, épargne, placements, mais aussi ta voiture ou ton appart : ajoute tout ce que tu possèdes. »
- Étape 2 : « Ta situation en un coup d'œil » / « J'enlève ce que tu dois, crédit ou leasing. Il reste un chiffre : ta fortune nette, l'état réel de tes finances. »
- Étape 3 : « Garde-la à jour en un geste » / « Une valeur change ? Tu la mets à jour. Et quand tu mets de l'argent de côté dans ton budget, je te propose de l'ajouter ici. »

## Tasks to do

### `1)` Gate « déjà vue »

> Décision testable sans vue, sur le modèle de `SavingsGoalsIntroGate`.

1. Créer `NetWorthIntroGate` : `storageKey = "hasSeenNetWorthIntro"`, `shouldPresentIntro(hasSeen:isLoaded:) -> Bool` vrai seulement si non vue et données chargées (vide ou rempli, jamais en chargement ni en erreur).
2. Test Swift Testing des quatre combinaisons.

### `2)` Contenu pur

> Toute la logique de l'intro, testable sans vue.

1. `NetWorthIntroContent.swift` : `enum NetWorthIntroStep: Int, CaseIterable { case overview, netWorth, update }` ; `enum NetWorthIntroAction { case next, done, add }` ; `static func primaryAction(step:isEmpty:)` ; `struct NetWorthIntroSample` en `Decimal` (avoirs : compte courant 3 200, épargne 12 000, placements 8 000, voiture 9 000 ; dette : crédit 6 000 ; épargne 12 000 → 12 500 ; suggestion budget 500) avec `gross`, `netBefore`, `netAfter` calculés à partir des lignes ; `struct NetWorthIntroCompletion` dont `mutating func finish(_:) -> NetWorthIntroOutcome?` rend l'issue (`completed` + action, ou `skipped` + étape) la première fois et `nil` ensuite.
2. `NetWorthIntroContentTests` (Swift Testing, paramétré) : 32 200 / 26 200 / 26 700, action par étape et par état vide, un second `finish` rend `nil` (un seul événement de fin, règle posthog-events étape 4).

### `3)` Scène animée

> Montrer, pas décrire ; la vue lit le contenu et n'additionne rien.

1. `NetWorthIntroScene(step:currency:)` : carte `pulpeSurfaceCard()` avec un sous-vue par étape (`switch step`) : étape 1, quatre lignes à icône qui convergent ; étape 2, avoirs, barre de dette et bloc fortune nette ; étape 3, une ligne mise à jour et la mention du budget.
2. Animation : un `@State phase` par étape remis à zéro par `.id(step)` et déroulé dans `.task(id: step)` (une étape, un `withAnimation`, un `Task.sleep`) ; entrées via `staggeredEntrance(isVisible:index:)` existant ; totaux en `contentTransition(.numericText())` ; Reduce Motion → valeurs finales directes et `easeOut(fast)`.
3. Montants formatés avec `asAmount(for:)` dans la devise de l'utilisateur, jamais concaténés.
4. Libellés : réutiliser « Ce que j'ai », « Ce que je dois », « Fortune nette » (libellé du héros iOS), « Exemple », « Plus tard » déjà présents dans `Localizable.xcstrings` ; ajouter les autres chaînes françaises comme clés.
5. `accessibilityElement(children: .ignore)` + un libellé qui lit l'étape en phrase.

### `4)` Feuille à 3 étapes

> Une aide qu'on rouvre : `.sheet` + `.standardSheetPresentation()`.

1. `NetWorthIntroSheet(source:isEmpty:currency:onFinish:)` : « Plus tard », scène, titre, texte, 3 points, bouton principal donné par `primaryAction(step:isEmpty:)` ; contenu dans un `ScrollView` pour Dynamic Type, bouton principal hors du défilement.
2. Analytics : `viewed` à l'apparition ; le bouton principal et `onDisappear` (glissement compris) passent par `NetWorthIntroCompletion.finish`, qui n'envoie qu'un seul `completed` ou `skipped`.
3. Ajouter les chaînes FR et leurs traductions en, de, it dans `Localizable.xcstrings`.

### `5)` Brancher dans `NetWorthView`

> Ouverture auto une fois, puis via « ? ».

1. `@AppStorage(NetWorthIntroGate.storageKey)`, `@State introSource: IntroSource?` (`auto` | `help`).
2. Ouvrir en auto quand `content` passe à `.empty` ou `.loaded` et que la gate le permet ; marquer vue dès la fermeture.
3. Sortir la condition du `.toolbar` : `ToolbarItem` « ? » (`questionmark.circle`, libellé « Comprendre mon patrimoine ») pour `.empty` et `.loaded`, « Ajouter » toujours pour `.loaded` seul.
4. Le CTA « Ajouter mon premier compte » ouvre `form = .create` dans le `onDismiss` de la feuille, jamais pendant son animation.
5. Après ajout des fichiers : `xcodegen generate --use-cache`, puis `xcodebuild test -scheme PulpeLocal -configuration Local -derivedDataPath <explicite>` sur le simulateur de test dédié, sans `CODE_SIGNING_ALLOWED=NO`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `NetWorthIntroGateTests` passe : vrai seulement pour non vue et chargée |
| 2 | `NetWorthIntroContentTests` passe : 32 200 / 26 200 / 26 700, la bonne action par étape, une seule issue par ouverture |
| 3 | La scène montre ces montants dans la devise de l'utilisateur ; avec Reduce Motion, aucun mouvement |
| 4 | Un seul événement de fin par ouverture ; « Plus tard » absent à l'étape 3 ; lisible en AX3 |
| 5 | Première visite → feuille ouverte ; visites suivantes → rien ; « ? » → feuille ; CTA vide → formulaire de création ouvert |
